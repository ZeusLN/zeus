// Import-time scaffolding for the native modules EmbeddedLND.ts and its LND
// base class pull in. listPeers only touches lndMobile.index.listPeers;
// closeChannel and openChannelStream only use the injected stream call, the
// stream decoder and the event emitter mocked below.
jest.mock('react-native-blob-util', () => ({
    __esModule: true,
    default: { fetch: jest.fn(), config: jest.fn() }
}));
jest.mock('../stores/Stores');
jest.mock('../utils/TorUtils', () => ({
    doTorRequest: jest.fn(),
    isOnionHttpsUrl: jest.fn(),
    RequestMethod: {}
}));

const mockCloseChannel = jest.fn();
const mockSendPaymentV2Sync = jest.fn();
const mockSendKeysendPaymentV2 = jest.fn();
const mockListPayments = jest.fn();
const mockOpenChannel = jest.fn();
jest.mock('../lndmobile/LndMobileInjection', () => ({
    __esModule: true,
    default: {
        index: {
            listPeers: jest.fn(),
            listPayments: (...args: any[]) => mockListPayments(...args),
            sendPaymentV2Sync: (...args: any[]) =>
                mockSendPaymentV2Sync(...args),
            sendKeysendPaymentV2: (...args: any[]) =>
                mockSendKeysendPaymentV2(...args)
        },
        channel: {
            closeChannel: (...args: any[]) => mockCloseChannel(...args),
            openChannel: (...args: any[]) => mockOpenChannel(...args),
            // test events carry the decoded update as JSON
            decodeCloseStatusUpdate: (data: string) => JSON.parse(data),
            decodeOpenStatusUpdate: (data: string) => JSON.parse(data)
        },
        wallet: {},
        onchain: {},
        wtclient: {}
    }
}));
jest.mock('../lndmobile/onchain', () => ({
    decodeSubscribeTransactionsResult: jest.fn()
}));
jest.mock('../lndmobile/wallet', () => ({
    signMessageWithAddr: jest.fn(),
    verifyMessageWithAddr: jest.fn()
}));

const mockListeners: Array<{
    name: string;
    handler: (event: any) => void;
    removed: boolean;
}> = [];
jest.mock('../utils/LndMobileUtils', () => ({
    LndMobileEventEmitter: {
        addListener: (name: string, handler: (event: any) => void) => {
            const listener = { name, handler, removed: false };
            mockListeners.push(listener);
            return {
                remove: () => {
                    listener.removed = true;
                }
            };
        }
    },
    // reduced to the two outcomes the stream handlers distinguish: end of stream
    // and an error
    checkLndStreamErrorResponse: (_name: string, event: any) => {
        if (!event.error_code) return null;
        return event.error_desc === 'EOF' ? 'EOF' : new Error(event.error_desc);
    }
}));

import Long from 'long';
import lndMobile from '../lndmobile/LndMobileInjection';
import { lnrpc } from '../proto/lightning';
import EmbeddedLND from './EmbeddedLND';
import Peer from '../models/Peer';
import {
    isNodeResponse,
    isPaymentRefusedAsDuplicate
} from '../utils/PaymentLookupUtils';

const PUBKEY =
    '02aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

// Round-trip through the generated codec so the peer looks exactly like
// what lndmobile/utils.ts sendCommand returns: a decoded message whose
// int64 fields are Long instances.
const decodedListPeers = (peer: lnrpc.IPeer) =>
    lnrpc.ListPeersResponse.decode(
        lnrpc.ListPeersResponse.encode(
            lnrpc.ListPeersResponse.create({ peers: [peer] })
        ).finish()
    );

describe('EmbeddedLND.listPeers', () => {
    const embeddedLnd = new EmbeddedLND();
    const listPeersMock = jest.mocked(lndMobile.index.listPeers);

    afterEach(() => listPeersMock.mockReset());

    it('reads sat_sent and sat_recv from a decoded protobuf response', async () => {
        const response = decodedListPeers({
            pub_key: PUBKEY,
            address: '127.0.0.1:9735',
            bytes_sent: Long.fromNumber(1000, true),
            bytes_recv: Long.fromNumber(2000, true),
            sat_sent: Long.fromNumber(12345),
            sat_recv: Long.fromNumber(67890),
            ping_time: Long.fromNumber(150),
            flap_count: 3
        });
        expect(Long.isLong(response.peers[0].sat_sent)).toBe(true);
        listPeersMock.mockResolvedValue(response);

        const [peer] = await embeddedLnd.listPeers();

        expect(peer.sat_sent).toBe('12345');
        expect(peer.sat_recv).toBe('67890');
        expect(peer.bytes_sent).toBe('1000');
        expect(peer.bytes_recv).toBe('2000');
        expect(peer.ping_time).toBe('150');
        expect(peer.pub_key).toBe(PUBKEY);
        expect(peer.flap_count).toBe(3);

        const model = new Peer(peer);
        expect(model.sats_sent).toBe('12345');
        expect(model.sats_recv).toBe('67890');
    });

    it('reads sat_sent and sat_recv given as plain numbers or strings', async () => {
        listPeersMock.mockResolvedValue({
            peers: [{ pub_key: PUBKEY, sat_sent: 500, sat_recv: '700' }]
        } as any);

        const [peer] = await embeddedLnd.listPeers();

        expect(peer.sat_sent).toBe('500');
        expect(peer.sat_recv).toBe('700');
    });

    it('defaults sat_sent and sat_recv to "0" when absent', async () => {
        listPeersMock.mockResolvedValue({
            peers: [{ pub_key: PUBKEY }]
        } as any);

        const [peer] = await embeddedLnd.listPeers();

        expect(peer.sat_sent).toBe('0');
        expect(peer.sat_recv).toBe('0');
    });
});

describe('EmbeddedLND.closeChannel', () => {
    let lnd: EmbeddedLND;

    // the request id the backend passed for its nth close
    const requestIdOf = (n = -1) => mockCloseChannel.mock.calls.at(n)[5];
    // the native module tags each event with its stream's request id; null
    // sends an untagged event, as from a stream started without one
    const emit = (event: any, request_id: string | null = requestIdOf()) =>
        mockListeners
            .filter((l) => l.name === 'CloseChannel' && !l.removed)
            .forEach((l) =>
                l.handler(
                    request_id === null ? event : { ...event, request_id }
                )
            );
    const update = (data: any) => ({ data: JSON.stringify(data) });
    const listening = () =>
        mockListeners.some((l) => l.name === 'CloseChannel' && !l.removed);

    // Tracks the close without awaiting it, so tests can check that it is
    // still waiting
    const track = (close: Promise<any>) => {
        const state: { settled: boolean; error?: any } = { settled: false };
        close.then(
            () => (state.settled = true),
            (error) => {
                state.settled = true;
                state.error = error;
            }
        );
        return state;
    };

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        mockListeners.length = 0;
        lnd = new EmbeddedLND();
        // the native module resolves as soon as the request is handed over
        mockCloseChannel.mockResolvedValue('done');
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('resolves once LND reports the close as pending', async () => {
        const close = track(lnd.closeChannel(['txid', '1', '']));
        await jest.advanceTimersByTimeAsync(0);

        expect(close.settled).toBe(false);

        emit(update({ close_pending: { txid: 'closing-txid' } }));
        await jest.advanceTimersByTimeAsync(0);

        expect(close.settled).toBe(true);
        expect(close.error).toBeUndefined();
        expect(listening()).toBe(false);
    });

    it('passes the fee rate and delivery address for a cooperative close', async () => {
        track(lnd.closeChannel(['txid', '1', '', '10', 'tb1qdelivery']));
        await jest.advanceTimersByTimeAsync(0);

        expect(mockCloseChannel).toHaveBeenCalledWith(
            'txid',
            1,
            false,
            10,
            'tb1qdelivery',
            expect.any(String)
        );
    });

    it('drops the fee rate for a force close', async () => {
        track(lnd.closeChannel(['txid', '1', 'true', '10']));
        await jest.advanceTimersByTimeAsync(0);

        expect(mockCloseChannel).toHaveBeenCalledWith(
            'txid',
            1,
            true,
            undefined,
            undefined,
            expect.any(String)
        );
    });

    it('rejects with the error LND reports on the stream', async () => {
        const close = track(lnd.closeChannel(['txid', '1', '']));
        await jest.advanceTimersByTimeAsync(0);

        emit({
            error_code: 'Error',
            error_desc:
                'unable to gracefully close channel while peer is offline (try force closing it instead): channel link not found'
        });
        await jest.advanceTimersByTimeAsync(0);

        expect(close.error?.message).toContain(
            'unable to gracefully close channel while peer is offline'
        );
        expect(listening()).toBe(false);
    });

    it('keeps waiting on EOF and on chan_close from an earlier close', async () => {
        const close = track(lnd.closeChannel(['txid', '1', '']));
        await jest.advanceTimersByTimeAsync(0);

        emit({ error_code: 'Error', error_desc: 'EOF' });
        emit(update({ chan_close: { closing_txid: 'earlier-close' } }));
        await jest.advanceTimersByTimeAsync(0);

        expect(close.settled).toBe(false);
        expect(listening()).toBe(true);
    });

    it("ignores another close's updates and errors", async () => {
        const first = track(lnd.closeChannel(['txid', '1', '']));
        const second = track(lnd.closeChannel(['txid', '2', '']));
        await jest.advanceTimersByTimeAsync(0);
        const firstId = requestIdOf(0);
        const secondId = requestIdOf(1);
        expect(secondId).not.toEqual(firstId);

        emit({ error_code: 'Error', error_desc: 'peer offline' }, secondId);
        await jest.advanceTimersByTimeAsync(0);

        expect(second.error?.message).toEqual('peer offline');
        expect(first.settled).toBe(false);

        emit(update({ close_pending: { txid: 'other' } }), null);
        await jest.advanceTimersByTimeAsync(0);
        expect(first.settled).toBe(false);

        emit(update({ close_pending: { txid: 'first' } }), firstId);
        await jest.advanceTimersByTimeAsync(0);
        expect(first.settled).toBe(true);
        expect(first.error).toBeUndefined();
    });

    it('rejects and stops listening when the native call fails', async () => {
        mockCloseChannel.mockRejectedValue(new Error('LND not running'));

        const close = track(lnd.closeChannel(['txid', '1', '']));
        await jest.advanceTimersByTimeAsync(0);

        expect(close.error?.message).toEqual('LND not running');
        expect(listening()).toBe(false);
    });

    it('resolves after six seconds without a reply', async () => {
        const close = track(lnd.closeChannel(['txid', '1', '']));

        await jest.advanceTimersByTimeAsync(5_999);
        expect(close.settled).toBe(false);

        await jest.advanceTimersByTimeAsync(1);
        expect(close.settled).toBe(true);
        expect(close.error).toBeUndefined();
        expect(listening()).toBe(false);
    });
});

describe('EmbeddedLND payment rejections', () => {
    // lndmobile rejects with the stream's error, which may be a string
    it('tags a rejected invoice payment as a response from the node', async () => {
        mockSendPaymentV2Sync.mockRejectedValue('invoice expired');

        const error = await new EmbeddedLND()
            .payLightningInvoice({ payment_request: 'lnbc1fake' })
            .catch((e: any) => e);

        expect(error.message).toBe('invoice expired');
        expect(isNodeResponse(error)).toBe(true);
        expect(isPaymentRefusedAsDuplicate(error)).toBe(false);
    });

    it('tags an AlreadyExists rejection as a duplicate refusal', async () => {
        // checkLndStreamErrorResponse carries the natively parsed code name
        const refusal = new Error('invoice is already paid');
        (refusal as any).grpcCode = 'AlreadyExists';
        mockSendPaymentV2Sync.mockRejectedValue(refusal);

        const error = await new EmbeddedLND()
            .payLightningInvoice({ payment_request: 'lnbc1fake' })
            .catch((e: any) => e);

        expect(error.message).toBe('invoice is already paid');
        expect(isPaymentRefusedAsDuplicate(error)).toBe(true);
    });

    it('passes the payment timeout to keysend', async () => {
        mockSendKeysendPaymentV2.mockResolvedValue({ status: 'SUCCEEDED' });

        await new EmbeddedLND().sendKeysend({
            pubkey: PUBKEY,
            amt: 1000,
            timeout_seconds: 30
        });

        expect(mockSendKeysendPaymentV2).toHaveBeenCalledWith(
            expect.objectContaining({ timeout_seconds: 30 })
        );
    });

    it('tags a rejected keysend as a response from the node', async () => {
        mockSendKeysendPaymentV2.mockRejectedValue(
            new Error('insufficient local balance')
        );

        const error = await new EmbeddedLND()
            .sendKeysend({ pubkey: PUBKEY, amt: 1000 })
            .catch((e: any) => e);

        expect(error.message).toBe('insufficient local balance');
        expect(isNodeResponse(error)).toBe(true);
    });
});

describe('EmbeddedLND.lookupPayment', () => {
    const HASH = 'ab'.repeat(32);

    beforeEach(() => {
        mockListPayments.mockReset();
    });

    it('scans ascending from creation_date_start', async () => {
        const target = { payment_hash: HASH, status: 'IN_FLIGHT' };
        mockListPayments.mockResolvedValue({ payments: [target] });

        await expect(
            new EmbeddedLND().lookupPayment({
                payment_hash: HASH,
                creation_date_start: 1700000000
            })
        ).resolves.toBe(target);
        // the bound keeps newer payments from other clients from evicting
        // the tracked one from the page
        expect(mockListPayments).toHaveBeenCalledWith({
            maxPayments: 50,
            reversed: false,
            creationDateStart: 1700000000
        });
    });

    it('scans the newest page without a bound', async () => {
        mockListPayments.mockResolvedValue({ payments: [] });

        await expect(
            new EmbeddedLND().lookupPayment({ payment_hash: HASH })
        ).resolves.toBeNull();
        expect(mockListPayments).toHaveBeenCalledTimes(1);
        expect(mockListPayments.mock.calls[0][0].creationDateStart).toBe(
            undefined
        );
    });
});

describe('EmbeddedLND.openChannelStream', () => {
    let lnd: EmbeddedLND;

    // the request id the backend passed for its nth open, the last argument
    const requestIdOf = (n: number) => mockOpenChannel.mock.calls[n].at(-1);
    const emit = (event: any, request_id: string | null) =>
        mockListeners
            .filter((l) => l.name === 'OpenChannel' && !l.removed)
            .forEach((l) =>
                l.handler(
                    request_id === null ? event : { ...event, request_id }
                )
            );
    // lets the async wrapper around the stream promise settle
    const flush = () => new Promise((resolve) => setImmediate(resolve));
    const psbtFund = (psbt: string) => ({
        data: JSON.stringify({ psbt_fund: { psbt } })
    });

    const track = (open: Promise<any>) => {
        const state: { settled: boolean; value?: any; error?: any } = {
            settled: false
        };
        open.then(
            (value) => {
                state.settled = true;
                state.value = value;
            },
            (error) => {
                state.settled = true;
                state.error = error;
            }
        );
        return state;
    };

    const request = (node_pubkey_string: string) =>
        ({
            node_pubkey_string,
            local_funding_amount: '100000'
        } as any);

    beforeEach(() => {
        jest.clearAllMocks();
        mockListeners.length = 0;
        lnd = new EmbeddedLND();
        mockOpenChannel.mockResolvedValue('done');
    });

    it('passes a distinct request id to each open', async () => {
        lnd.openChannelStream(request(PUBKEY));
        lnd.openChannelStream(request(PUBKEY));
        await flush();

        expect(mockOpenChannel).toHaveBeenCalledTimes(2);
        expect(requestIdOf(0)).toEqual(expect.any(String));
        expect(requestIdOf(0)).not.toEqual('');
        expect(requestIdOf(1)).not.toEqual(requestIdOf(0));
    });

    it('settles concurrent opens with their own psbt_fund or error', async () => {
        const first = track(lnd.openChannelStream(request(PUBKEY)));
        const second = track(lnd.openChannelStream(request(PUBKEY)));
        await flush();
        const firstId = requestIdOf(0);
        const secondId = requestIdOf(1);

        emit(psbtFund('first-psbt'), firstId);
        await flush();

        expect(first.value).toEqual({
            result: { psbt_fund: { psbt: 'first-psbt' } }
        });
        expect(second.settled).toBe(false);

        // untagged events come from streams started without an id
        emit(psbtFund('untagged-psbt'), null);
        emit({ error_code: 'Error', error_desc: 'untagged' }, null);
        await flush();
        expect(second.settled).toBe(false);

        emit({ error_code: 'Error', error_desc: 'peer offline' }, secondId);
        await flush();

        expect(second.error?.message).toEqual('peer offline');
    });
});
