jest.mock('../stores/Stores', () => ({}));
jest.mock('react-native-blob-util', () => ({}));
jest.mock('react-native-randombytes', () => ({
    randomBytes: () => Buffer.alloc(32)
}));
jest.mock('./SettingsStore', () => ({}));
jest.mock('./NodeInfoStore', () => ({}));
jest.mock('./BalanceStore', () => ({}));
jest.mock('./ModalStore', () => ({}));
jest.mock('../utils/BackendUtils', () => ({
    connectPeer: jest.fn(),
    openChannelStream: jest.fn(),
    openChannelSync: jest.fn(),
    fundPsbt: jest.fn(),
    signPsbt: jest.fn(),
    fundingStateStep: jest.fn(),
    publishTransaction: jest.fn(),
    getClass: () => ({ publishTransaction: true }),
    isLNDBased: () => true
}));
jest.mock('../utils/GraphSyncUtils', () => ({
    checkGraphSyncBeforePayment: jest.fn(() => true)
}));
jest.mock('../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));
jest.mock('../utils/ErrorUtils', () => ({
    errorToUserFriendly: (e: any) => String(e)
}));
jest.mock('../utils/UrlUtils', () => ({
    __esModule: true,
    default: {}
}));

import ChannelsStore from './ChannelsStore';
import TransactionsStore from './TransactionsStore';
import BackendUtils from '../utils/BackendUtils';

const PUBKEY =
    '03cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd';
const PSBT = 'cHNidP8BAA==';

const flushPromises = () => new Promise(setImmediate);

const openRequest = (account: string) =>
    ({
        node_pubkey_string: PUBKEY,
        host: '203.0.113.7:9735',
        local_funding_amount: '100000',
        sat_per_vbyte: '2',
        account
    } as any);

// LND cannot sign for an imported account, so its own attempt to finalize
// fails and the PSBT is left for the user to sign on an external signer
const lndWaitsForSigner = (pending_chan_id: string) => {
    jest.mocked(BackendUtils.openChannelStream).mockResolvedValue({
        result: {
            pending_chan_id,
            psbt_fund: { funding_address: 'bc1qfunding', funding_amount: 1 }
        }
    });
    jest.mocked(BackendUtils.fundingStateStep).mockImplementation((step: any) =>
        step.psbt_finalize
            ? Promise.reject(new Error('not signed'))
            : Promise.resolve({})
    );
};

// The PSBT and TxHex screens hand a signed funding transaction back to LND's
// funding flow only while pending_chan_ids is set. If anything drops it while
// the PSBT is out for signing, they publish the transaction themselves and the
// funds land in the channel's 2-of-2 output outside the funding flow.
describe('ChannelsStore PSBT funding flow', () => {
    let channelsStore: ChannelsStore;
    let transactionsStore: TransactionsStore;

    beforeEach(async () => {
        jest.clearAllMocks();
        jest.mocked(BackendUtils.connectPeer).mockResolvedValue({});
        jest.mocked(BackendUtils.fundPsbt).mockResolvedValue({
            funded_psbt: PSBT
        });
        jest.mocked(BackendUtils.signPsbt).mockResolvedValue({});
        lndWaitsForSigner('chan-1');

        channelsStore = new ChannelsStore(
            { implementation: 'lnd' } as any,
            {} as any
        );
        transactionsStore = new TransactionsStore(
            { implementation: 'lnd', settings: {} } as any,
            {} as any,
            channelsStore,
            {} as any,
            {} as any
        );

        await channelsStore.connectPeer(openRequest('signer'));
        await flushPromises();
    });

    it('has the channel loaded while the PSBT is out for signing', () => {
        expect(channelsStore.funded_psbt).toBe(PSBT);
        expect(channelsStore.pending_chan_ids).toEqual(['chan-1']);
    });

    it('keeps the channel when the open channel form is reset', () => {
        // what mounting another OpenChannel screen (a node URI from a link,
        // NFC tag or shared image) or the channels pane does
        channelsStore.resetOpenChannel();

        expect(channelsStore.funded_psbt).toBe('');
        expect(channelsStore.pending_chan_ids).toEqual(['chan-1']);
    });

    it('keeps the channel when a peer is connected', async () => {
        // the silent connect from LSPStore.getLSPInfo and InvoicesStore
        await channelsStore.connectPeer(
            openRequest('default'),
            false,
            true,
            true
        );
        expect(channelsStore.pending_chan_ids).toEqual(['chan-1']);

        // connect peer only, from the form
        await channelsStore.connectPeer(openRequest('default'), false, true);
        expect(channelsStore.pending_chan_ids).toEqual(['chan-1']);
    });

    it('keeps the channel when another transaction is broadcast', async () => {
        jest.mocked(BackendUtils.publishTransaction).mockResolvedValue({});

        await transactionsStore.broadcast('00');

        expect(transactionsStore.publishSuccess).toBe(true);
        expect(channelsStore.pending_chan_ids).toEqual(['chan-1']);
    });

    it('keeps the channel when LND refuses the signed PSBT', async () => {
        await transactionsStore.finalizePsbtAndBroadcastChannel(
            PSBT,
            channelsStore.pending_chan_ids
        );

        expect(transactionsStore.error).toBe(true);
        expect(channelsStore.pending_chan_ids).toEqual(['chan-1']);
    });

    it('drops the channel once LND has finalized the signed PSBT', async () => {
        jest.mocked(BackendUtils.fundingStateStep).mockResolvedValue({});

        await transactionsStore.finalizePsbtAndBroadcastChannel(
            PSBT,
            channelsStore.pending_chan_ids
        );

        expect(BackendUtils.fundingStateStep).toHaveBeenLastCalledWith({
            psbt_finalize: { signed_psbt: PSBT, pending_chan_id: 'chan-1' }
        });
        expect(channelsStore.pending_chan_ids).toEqual([]);
    });

    it('drops the channel once LND has finalized the signed transaction', async () => {
        jest.mocked(BackendUtils.fundingStateStep).mockResolvedValue({});

        await transactionsStore.finalizeTxHexAndBroadcastChannel(
            '00',
            channelsStore.pending_chan_ids
        );

        expect(BackendUtils.fundingStateStep).toHaveBeenLastCalledWith({
            psbt_finalize: { final_raw_tx: '00', pending_chan_id: 'chan-1' }
        });
        expect(channelsStore.pending_chan_ids).toEqual([]);
    });

    it('replaces the channel when another one is opened', async () => {
        lndWaitsForSigner('chan-2');

        await channelsStore.connectPeer(openRequest('signer'));
        await flushPromises();

        expect(channelsStore.pending_chan_ids).toEqual(['chan-2']);
    });

    it('drops the channel when LND finalizes without a signer', async () => {
        jest.mocked(BackendUtils.fundingStateStep).mockResolvedValue({});

        await channelsStore.connectPeer(openRequest('signer'));
        await flushPromises();

        expect(channelsStore.channelSuccess).toBe(true);
        expect(channelsStore.pending_chan_ids).toEqual([]);
    });

    it('drops the channel when no PSBT could be funded for it', async () => {
        jest.mocked(BackendUtils.fundPsbt).mockRejectedValue(
            new Error('insufficient funds')
        );

        await channelsStore.connectPeer(openRequest('signer'));
        await flushPromises();

        expect(channelsStore.errorOpenChannel).toBe(true);
        expect(channelsStore.funded_psbt).toBe('');
        expect(channelsStore.pending_chan_ids).toEqual([]);
    });

    it('drops the channel when LND rejects the open', async () => {
        jest.mocked(BackendUtils.openChannelStream).mockRejectedValue(
            new Error('peer disconnected')
        );

        await channelsStore.connectPeer(openRequest('signer'));
        await flushPromises();

        expect(channelsStore.errorOpenChannel).toBe(true);
        expect(channelsStore.pending_chan_ids).toEqual([]);
    });

    it('drops the channel when the wallet changes', () => {
        channelsStore.reset();

        expect(channelsStore.pending_chan_ids).toEqual([]);
    });
});
