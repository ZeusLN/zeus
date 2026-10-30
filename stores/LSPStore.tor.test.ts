// Every Flow and LSPS1 REST request must go over Tor when the node has Tor
// enabled. Mocks only the transports, so the real networkFetch picks one.
jest.mock('react-native-blob-util', () => ({ fetch: jest.fn() }));
jest.mock('../utils/TorUtils', () => ({
    doTorRequest: jest.fn(),
    doTorRequestRaw: jest.fn(),
    RequestMethod: { GET: 'GET', POST: 'POST', DELETE: 'DELETE' }
}));
jest.mock('../lndmobile/LndMobileInjection', () => ({
    __esModule: true,
    default: { index: {}, channel: {} }
}));
jest.mock('../storage', () => ({
    __esModule: true,
    default: { getItem: jest.fn(), setItem: jest.fn() }
}));
jest.mock('../utils/LndMobileUtils', () => ({
    LndMobileEventEmitter: { addListener: jest.fn() }
}));
jest.mock('../utils/LspUtils', () => ({ verifyWrappedInvoice: jest.fn() }));
jest.mock('../utils/ClientInfoUtils', () => ({ getClientInfo: jest.fn() }));
jest.mock('../utils/BackendUtils', () => ({
    supportsSimpleTaprootChannels: () => false
}));
jest.mock('../utils/LocaleUtils');
jest.mock('./SettingsStore', () => ({
    __esModule: true,
    default: class {},
    getLspConfigForNetwork: () => ({
        flowHost: 'https://flow.test',
        lsps1Rest: 'https://lsps1.test'
    })
}));

import ReactNativeBlobUtil from 'react-native-blob-util';

import LSPStore from './LSPStore';
import { doTorRequestRaw } from '../utils/TorUtils';

const blobFetch = ReactNativeBlobUtil.fetch as jest.Mock;
const torFetch = doTorRequestRaw as jest.Mock;

const makeStore = (enableTor: boolean) =>
    new LSPStore(
        { implementation: 'lnd', settings: {}, enableTor } as any,
        { channels: [] } as any,
        { nodeInfo: { nodeId: '03cd' }, getNodeInfo: jest.fn() } as any
    );

const order = {
    lspBalanceSat: 100000,
    clientBalanceSat: 0,
    requiredChannelConfirmations: '0',
    confirmsWithinBlocks: '6',
    channelExpiryBlocks: '13000',
    token: '',
    refundOnchainAddress: '',
    announceChannel: false
};

const sites: Array<
    [string, (store: LSPStore) => Promise<any>, string, string]
> = [
    [
        'getLSPInfo',
        (store) => store.getLSPInfo(),
        'GET',
        'https://flow.test/api/v1/info'
    ],
    [
        'getZeroConfFee',
        (store) => store.getZeroConfFee(1000) as Promise<any>,
        'POST',
        'https://flow.test/api/v1/fee'
    ],
    [
        'getZeroConfInvoice',
        (store) =>
            store.getZeroConfInvoice('lnbc1', {
                feeSats: 0,
                feeId: 'fee'
            }) as Promise<any>,
        'POST',
        'https://flow.test/api/v1/proposal'
    ],
    [
        'lsps1GetInfoREST',
        (store) => store.lsps1GetInfoREST(),
        'GET',
        'https://lsps1.test/api/v1/get_info'
    ],
    [
        'lsps1CreateOrderREST',
        (store) => store.lsps1CreateOrderREST(order),
        'POST',
        'https://lsps1.test/api/v1/create_order'
    ],
    [
        'lsps1GetOrderREST',
        (store) => store.lsps1GetOrderREST('o1', 'https://lsps1.test'),
        'GET',
        'https://lsps1.test/api/v1/get_order?order_id=o1'
    ]
];

describe('LSPStore REST requests and Tor', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        torFetch.mockResolvedValue({ status: 200, body: '{}' });
        blobFetch.mockResolvedValue({
            info: () => ({ status: 200 }),
            json: () => ({}),
            text: () => '{}',
            data: '{}'
        });
    });

    afterEach(() => jest.restoreAllMocks());

    it.each(sites)(
        '%s goes over Tor when Tor is enabled',
        async (_name, call, method, url) => {
            await call(makeStore(true)).catch(() => {});

            expect(torFetch).toHaveBeenCalledTimes(1);
            expect(torFetch.mock.calls[0][0]).toBe(url);
            expect(torFetch.mock.calls[0][1]).toBe(method);
            expect(blobFetch).not.toHaveBeenCalled();
        }
    );

    it.each(sites)(
        '%s goes direct when Tor is disabled',
        async (_name, call, method, url) => {
            await call(makeStore(false)).catch(() => {});

            expect(blobFetch).toHaveBeenCalledTimes(1);
            expect(blobFetch.mock.calls[0][0].toUpperCase()).toBe(method);
            expect(blobFetch.mock.calls[0][1]).toBe(url);
            expect(torFetch).not.toHaveBeenCalled();
        }
    );
});
