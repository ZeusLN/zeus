jest.mock('../stores/Stores', () => ({
    settingsStore: {
        host: 'localhost',
        port: 8080,
        rune: 'test-rune',
        certVerification: false,
        enableTor: false
    },
    nodeInfoStore: {
        nodeInfo: {}
    }
}));
jest.mock('../utils/VersionUtils', () => ({
    __esModule: true,
    default: {
        isSupportedVersion: jest.fn(() => true)
    }
}));
jest.mock('../utils/LocaleUtils', () => ({
    localeString: jest.fn((key: string) => key)
}));
jest.mock('react-native-blob-util', () => ({
    config: jest.fn(() => ({
        fetch: jest.fn()
    }))
}));
jest.mock('../utils/TorUtils', () => ({
    doTorRequest: jest.fn(),
    RequestMethod: {}
}));
jest.mock('./CoreLightningRequestHandler', () => ({
    getBalance: jest.fn(),
    getChainTransactions: jest.fn(),
    getOffchainBalance: jest.fn(),
    listPeers: jest.fn(),
    listClosedChannels: jest.fn(),
    listPeerChannels: jest.fn()
}));

import CLNRest from './CLNRest';

describe('CLNRest fee limits', () => {
    it('preserves explicit zero fee limits', async () => {
        const cln = new CLNRest();
        const postRequestSpy = jest
            .spyOn(cln as any, 'postRequest')
            .mockResolvedValue({});

        await cln.payLightningInvoice({
            payment_request: 'lnbc1testinvoice',
            timeout_seconds: 120,
            fee_limit_sat: 0,
            max_fee_percent: 12
        });

        expect(postRequestSpy).toHaveBeenCalledWith(
            '/v1/pay',
            expect.objectContaining({
                bolt11: 'lnbc1testinvoice',
                retry_for: 120,
                maxfee: 0
            }),
            120000
        );
        const [, request] = postRequestSpy.mock.calls[0] as [string, any, number];
        expect(request.maxfeepercent).toBeUndefined();
    });
});
