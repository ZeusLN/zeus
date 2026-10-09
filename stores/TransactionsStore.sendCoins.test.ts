jest.mock('../stores/Stores', () => ({}));
jest.mock('react-native-blob-util', () => ({}));
jest.mock('bitcoinjs-lib', () => ({}));
jest.mock('react-native-randombytes', () => ({
    randomBytes: (n: number) => jest.requireActual('crypto').randomBytes(n)
}));
jest.mock('./SettingsStore', () => ({}));
jest.mock('./NodeInfoStore', () => ({}));
jest.mock('./ChannelsStore', () => ({}));
jest.mock('./BalanceStore', () => ({}));
jest.mock('./ModalStore', () => ({}));
jest.mock('../utils/BackendUtils', () => ({
    __esModule: true,
    default: {
        isLNDBased: jest.fn(() => true),
        supportsOnchainSendMax: jest.fn(() => true),
        sendCoins: jest.fn(),
        getTransactions: jest.fn()
    }
}));
jest.mock('../utils/GraphSyncUtils', () => ({
    checkGraphSyncBeforePayment: jest.fn(() => true)
}));
jest.mock('../utils/LocaleUtils', () => ({
    localeString: (s: string) => s
}));
jest.mock('../utils/ErrorUtils', () => ({
    errorToUserFriendly: (error: any) =>
        typeof error === 'string' ? error : error?.message
}));
jest.mock('../utils/UrlUtils', () => ({
    __esModule: true,
    default: {}
}));

import TransactionsStore from './TransactionsStore';
import BackendUtils from '../utils/BackendUtils';
import { SEND_LABEL_PREFIX } from '../utils/OnchainSendUtils';

const isLNDBased = BackendUtils.isLNDBased as jest.Mock;
const sendCoins = BackendUtils.sendCoins as jest.Mock;
const getTransactions = BackendUtils.getTransactions as jest.Mock;

const newStore = (currentBlockHeight = 800000) =>
    new TransactionsStore(
        { implementation: 'lnd', settings: {} } as any,
        { nodeInfo: { currentBlockHeight } } as any,
        {} as any,
        { getCombinedBalance: jest.fn() } as any,
        {} as any
    );

const request = () => ({
    addr: 'bc1qrecipient',
    amount: '100000',
    sat_per_vbyte: '2'
});

// runs the send, then every lookup and the 5s waits between them
const settle = async () => {
    for (let i = 0; i < 4; i++) await jest.advanceTimersByTimeAsync(5000);
};

describe('TransactionsStore.sendCoins', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        isLNDBased.mockReset().mockReturnValue(true);
        sendCoins.mockReset();
        getTransactions.mockReset();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('labels sends on LND backends', async () => {
        sendCoins.mockResolvedValue({ txid: 'abc' });
        newStore().sendCoins(request());
        await settle();

        const sent = sendCoins.mock.calls[0][0];
        expect(sent.label.startsWith(SEND_LABEL_PREFIX)).toBe(true);
        expect(sent).toMatchObject(request());
    });

    it('does not label sends on other backends', async () => {
        isLNDBased.mockReturnValue(false);
        sendCoins.mockResolvedValue({ txid: 'abc' });
        newStore().sendCoins(request());
        await settle();

        expect(sendCoins.mock.calls[0][0]).not.toHaveProperty('label');
    });

    it('reports a send that answers in time', async () => {
        sendCoins.mockResolvedValue({ txid: 'abc' });
        const store = newStore();
        store.sendCoins(request());
        await settle();

        expect(store.publishSuccess).toBe(true);
        expect(store.txid).toBe('abc');
        expect(getTransactions).not.toHaveBeenCalled();
    });

    it('reports a timed out send that was broadcast as sent', async () => {
        sendCoins.mockRejectedValue(
            new Error('lnrpc.Lightning.SendCoins timed out after 60000ms')
        );
        getTransactions.mockImplementation(async () => ({
            transactions: [
                {
                    tx_hash: 'broadcast',
                    label: sendCoins.mock.calls[0][0].label
                }
            ]
        }));
        const store = newStore();
        store.sendCoins(request());
        await settle();

        expect(store.publishSuccess).toBe(true);
        expect(store.txid).toBe('broadcast');
        expect(store.error).toBe(false);
        expect(store.sendOutcomeUnknown).toBe(false);
        expect(store.loading).toBe(false);
    });

    it('only looks in recent blocks and unconfirmed transactions', async () => {
        sendCoins.mockRejectedValue(new Error('Request timeout'));
        getTransactions.mockResolvedValue({ transactions: [] });
        newStore(800000).sendCoins(request());
        await settle();

        expect(getTransactions).toHaveBeenCalledWith({
            start_height: 799994
        });
    });

    it('looks through all transactions when the height is unknown', async () => {
        sendCoins.mockRejectedValue(new Error('Request timeout'));
        getTransactions.mockResolvedValue({ transactions: [] });
        newStore(0).sendCoins(request());
        await settle();

        expect(getTransactions).toHaveBeenCalledWith(undefined);
    });

    it('offers no retry when a timed out send cannot be found', async () => {
        sendCoins.mockRejectedValue(new Error('Request timeout'));
        getTransactions.mockResolvedValue({
            transactions: [{ tx_hash: 'older', label: 'ZEUS send ffff' }]
        });
        const store = newStore();
        store.sendCoins(request());
        await settle();

        expect(getTransactions).toHaveBeenCalledTimes(3);
        expect(store.publishSuccess).toBe(false);
        expect(store.error).toBe(true);
        expect(store.sendOutcomeUnknown).toBe(true);
        expect(store.error_msg).toBe(
            'stores.TransactionsStore.sendOutcomeUnknown'
        );
        expect(store.loading).toBe(false);
    });

    it('offers no retry when the lookups fail too', async () => {
        sendCoins.mockRejectedValue(new Error('Request timeout'));
        getTransactions.mockRejectedValue(new Error('Request timeout'));
        const store = newStore();
        store.sendCoins(request());
        await settle();

        expect(store.sendOutcomeUnknown).toBe(true);
        expect(store.error).toBe(true);
    });

    it('shows a node error as before, without looking it up', async () => {
        sendCoins.mockRejectedValue(
            new Error('insufficient funds available to construct transaction')
        );
        const store = newStore();
        store.sendCoins(request());
        await settle();

        expect(getTransactions).not.toHaveBeenCalled();
        expect(store.error).toBe(true);
        expect(store.sendOutcomeUnknown).toBe(false);
        expect(store.error_msg).toBe(
            'insufficient funds available to construct transaction'
        );
    });

    it('offers no retry for a timeout on backends that do not label', async () => {
        // e.g. CLN's withdraw past the 30s REST timeout
        isLNDBased.mockReturnValue(false);
        sendCoins.mockRejectedValue(new Error('Request timeout'));
        const store = newStore();
        store.sendCoins(request());
        await settle();

        expect(getTransactions).not.toHaveBeenCalled();
        expect(store.sendOutcomeUnknown).toBe(true);
        expect(store.error).toBe(true);
        expect(store.loading).toBe(false);
        expect(store.error_msg).toBe(
            'stores.TransactionsStore.sendOutcomeUnknown'
        );
    });

    it('shows a node error as before on backends that do not label', async () => {
        isLNDBased.mockReturnValue(false);
        sendCoins.mockRejectedValue(new Error('insufficient funds'));
        const store = newStore();
        store.sendCoins(request());
        await settle();

        expect(store.sendOutcomeUnknown).toBe(false);
        expect(store.error_msg).toBe('insufficient funds');
    });

    it('drops a lookup result that lands after a reset', async () => {
        sendCoins.mockRejectedValue(new Error('Request timeout'));
        getTransactions.mockImplementation(async () => ({
            transactions: [
                {
                    tx_hash: 'old',
                    label: sendCoins.mock.calls[0][0].label
                }
            ]
        }));
        const store = newStore();
        store.sendCoins(request());
        // the send has timed out and the lookup is waiting on its first call
        store.reset();
        await settle();

        expect(store.txid).toBe(null);
        expect(store.publishSuccess).toBe(false);
        expect(store.loading).toBe(false);
    });

    it('drops an unknown outcome that lands after a reset', async () => {
        sendCoins.mockRejectedValue(new Error('Request timeout'));
        getTransactions.mockResolvedValue({ transactions: [] });
        const store = newStore();
        store.sendCoins(request());
        await jest.advanceTimersByTimeAsync(0);
        store.reset();
        await settle();

        expect(store.sendOutcomeUnknown).toBe(false);
        expect(store.error).toBe(false);
        expect(store.error_msg).toBe(null);
    });

    it("does not report an earlier send's txid for a newer send", async () => {
        sendCoins.mockRejectedValueOnce(new Error('Request timeout'));
        let answerLookup: (result: any) => void = () => undefined;
        getTransactions.mockReturnValueOnce(
            new Promise((resolve) => {
                answerLookup = resolve;
            })
        );
        const store = newStore();
        store.sendCoins(request());
        await jest.advanceTimersByTimeAsync(0);
        expect(getTransactions).toHaveBeenCalledTimes(1);

        // the newer send is still waiting on the node when the earlier
        // send's lookup finds it
        sendCoins.mockReturnValueOnce(new Promise(() => undefined));
        store.sendCoins(request());
        answerLookup({
            transactions: [
                { tx_hash: 'old', label: sendCoins.mock.calls[0][0].label }
            ]
        });
        await settle();

        expect(store.txid).toBe(null);
        expect(store.publishSuccess).toBe(false);
        expect(store.loading).toBe(true);
    });

    it("does not end a newer send with an earlier send's error", async () => {
        let rejectFirst: (error: Error) => void = () => undefined;
        sendCoins.mockReturnValueOnce(
            new Promise((_, reject) => {
                rejectFirst = reject;
            })
        );
        const store = newStore();
        store.sendCoins(request());

        sendCoins.mockReturnValueOnce(new Promise(() => undefined));
        store.sendCoins(request());
        rejectFirst(new Error('insufficient funds'));
        await settle();

        expect(store.error).toBe(false);
        expect(store.error_msg).toBe(null);
        expect(store.loading).toBe(true);
    });

    it('clears an unknown outcome when the next send starts', async () => {
        sendCoins.mockRejectedValue(new Error('Request timeout'));
        getTransactions.mockResolvedValue({ transactions: [] });
        const store = newStore();
        store.sendCoins(request());
        await settle();
        expect(store.sendOutcomeUnknown).toBe(true);

        sendCoins.mockReturnValue(new Promise(() => undefined));
        store.sendCoins(request());
        expect(store.sendOutcomeUnknown).toBe(false);
    });

    it('clears an unknown outcome on reset', async () => {
        sendCoins.mockRejectedValue(new Error('Request timeout'));
        getTransactions.mockResolvedValue({ transactions: [] });
        const store = newStore();
        store.sendCoins(request());
        await settle();

        store.reset();
        expect(store.sendOutcomeUnknown).toBe(false);
    });
});
