// Import-time scaffolding for the native modules EmbeddedLND.ts and its LND
// base class pull in. listPeers only touches lndMobile.index.listPeers.
jest.mock('react-native-blob-util', () => ({
    __esModule: true,
    default: { fetch: jest.fn(), config: jest.fn() }
}));
jest.mock('../stores/Stores', () => ({
    settingsStore: { settings: {} },
    nodeInfoStore: { nodeInfo: {} }
}));
jest.mock('../utils/TorUtils', () => ({
    doTorRequest: jest.fn(),
    isOnionHttpsUrl: jest.fn(),
    RequestMethod: {}
}));
jest.mock('../lndmobile/LndMobileInjection', () => ({
    __esModule: true,
    default: {
        index: { listPeers: jest.fn() },
        channel: {},
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
jest.mock('../utils/LndMobileUtils', () => ({
    checkLndStreamErrorResponse: jest.fn(),
    LndMobileEventEmitter: { addListener: jest.fn() }
}));

import Long from 'long';
import lndMobile from '../lndmobile/LndMobileInjection';
import { lnrpc } from '../proto/lightning';
import EmbeddedLND from './EmbeddedLND';
import Peer from '../models/Peer';

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
