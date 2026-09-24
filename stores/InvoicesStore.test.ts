jest.mock('../stores/Stores', () => ({}));
const mockBlobFetch = jest.fn((..._args: any[]) =>
    Promise.resolve({
        info: () => ({ status: 200, headers: {} }),
        json: () => ({ status: 'OK' }),
        text: () => ''
    })
);
jest.mock('react-native-blob-util', () => ({
    __esModule: true,
    default: {
        config: () => ({
            fetch: (...args: any[]) => mockBlobFetch(...args)
        })
    }
}));
jest.mock('react-native', () => ({
    Alert: { alert: jest.fn() }
}));
jest.mock('../ldknode/LdkNodeInjection', () => ({}));
jest.mock('../utils/BackendUtils', () => ({
    __esModule: true,
    default: {
        decodePaymentRequest: jest.fn(),
        getNewAddress: jest.fn(),
        getNewChangeAddress: jest.fn(),
        isLNDBased: jest.fn(() => false),
        createInvoice: jest.fn(),
        supportsFlowLSP: jest.fn(() => false)
    }
}));
jest.mock('../utils/LocaleUtils', () => ({
    localeString: (s: string) => s
}));
jest.mock('../utils/ErrorUtils', () => ({
    errorToUserFriendly: (error: Error) => error.message
}));

import InvoicesStore from './InvoicesStore';
import BackendUtils from '../utils/BackendUtils';

// decodes with timestamp 1700074718 and expiry 3600 (see Bolt11Utils.test.ts)
const paymentRequest =
    'lnbcrt1230n1pj429x7pp57t97q4awqj3f529snr0pa6senk83sq5pp760qf5a4jzvd7xgwcksdqqcqzzsxqrrsssp57eqtv7vxr46arupna3w4ct0lkf2mqmz9wt044cwkks0rwlnhfr5s9qyyssqragwpwav7nfwv2xyuuamxxj4pnnpzv2hlw7j473repd3sq7st698ta9kmzmygt0w7tmncl56a6mnma0w7e5dlpqd0wy6x3v35rssldspjhh8p0';

// lnd-style decodepayreq response: expiry fields present,
// but no bolt11 string to re-decode
const lndDecodeResponse = {
    destination: '02758997f184be06f4350b136db0bed6f8',
    timestamp: '1700074718',
    expiry: '3600',
    num_satoshis: '123'
};

const newStore = () =>
    new InvoicesStore({} as any, {} as any, {} as any, {} as any);

describe('InvoicesStore.getPayReq', () => {
    it('threads the original payment request through so expiry is computable when the decode response omits the bolt11 string', async () => {
        (BackendUtils.decodePaymentRequest as jest.Mock).mockResolvedValue(
            lndDecodeResponse
        );

        const store = newStore();
        await store.getPayReq(paymentRequest);

        expect(store.getPayReqError).toBeNull();
        expect(store.pay_req).not.toBeNull();
        expect(store.pay_req!.getPaymentRequest).toBe(paymentRequest);
        expect(store.pay_req!.isExpiredNow()).toBe(true);
    });

    it('surfaces decode errors and clears pay_req', async () => {
        (BackendUtils.decodePaymentRequest as jest.Mock).mockRejectedValue(
            new Error('decode failed')
        );

        const store = newStore();
        await store.getPayReq(paymentRequest);

        expect(store.pay_req).toBeNull();
        expect(store.getPayReqError).toBe('decode failed');
    });
});

// ZEUS-2223 / ZEUS-2932: imported accounts live under a single key scope;
// lnd rejects address requests whose type doesn't match it
describe('InvoicesStore.getNewAddress', () => {
    beforeEach(() => {
        (BackendUtils.getNewAddress as jest.Mock).mockResolvedValue({
            address: 'bcrt1qtest'
        });
    });

    it('honors an account-derived walletrpc address type for non-default accounts', async () => {
        const store = newStore();
        await store.getNewAddress({
            account: 'SeedSigner',
            type: 'TAPROOT_PUBKEY'
        });

        expect(BackendUtils.getNewAddress).toHaveBeenCalledWith({
            account: 'SeedSigner',
            type: 'TAPROOT_PUBKEY'
        });
    });

    it('normalizes walletrpc numeric address types from the embedded proto decode', async () => {
        const store = newStore();
        await store.getNewAddress({ account: 'SeedSigner', type: 4 });

        expect(BackendUtils.getNewAddress).toHaveBeenCalledWith({
            account: 'SeedSigner',
            type: 'TAPROOT_PUBKEY'
        });
    });

    it('drops non-account address types (like the settings preference) for non-default accounts', async () => {
        const store = newStore();
        await store.getNewAddress({ account: 'SeedSigner', type: '0' });

        expect(BackendUtils.getNewAddress).toHaveBeenCalledWith({
            account: 'SeedSigner'
        });
    });

    it('leaves the requested type untouched for the default account', async () => {
        const store = newStore();
        await store.getNewAddress({ account: 'default', type: '0' });

        expect(BackendUtils.getNewAddress).toHaveBeenCalledWith({
            account: 'default',
            type: '0'
        });
    });

    it('leaves the caller-supplied request object untouched', async () => {
        const store = newStore();
        const params = { account: 'SeedSigner', type: '0' };
        await store.getNewAddress(params);

        expect(params).toEqual({ account: 'SeedSigner', type: '0' });
    });

    it('surfaces backend errors instead of leaving a stale address', async () => {
        (BackendUtils.getNewAddress as jest.Mock).mockRejectedValue(
            new Error('account not found')
        );

        const store = newStore();
        await store.getNewAddress({ account: 'SeedSigner' });

        expect(store.onChainAddress).toBeNull();
        expect(store.error_msg).toContain('account not found');
    });
});

describe('InvoicesStore.getNewChangeAddress', () => {
    it('sets change without mutating the caller-supplied request object', async () => {
        (BackendUtils.getNewChangeAddress as jest.Mock).mockResolvedValue({
            addr: 'bcrt1qchange'
        });

        const store = newStore();
        const params = { account: 'SeedSigner', type: 'TAPROOT_PUBKEY' };
        await store.getNewChangeAddress(params);

        expect(BackendUtils.getNewChangeAddress).toHaveBeenCalledWith({
            account: 'SeedSigner',
            type: 'TAPROOT_PUBKEY',
            change: true
        });
        expect(params).toEqual({
            account: 'SeedSigner',
            type: 'TAPROOT_PUBKEY'
        });
    });
});

// The withdraw callback is a URL the LNURL service chooses, and the wallet
// fetches it from the phone's network position. Without the allowlist a
// scanned lnurlw pointing at loopback or a LAN address turned the wallet into
// an SSRF probe; the same guard already covered the pay flow's callback.
describe('InvoicesStore lnurl-withdraw callback', () => {
    const createStore = () =>
        new InvoicesStore(
            {} as any,
            { resetFee: jest.fn() } as any,
            {} as any,
            {} as any
        );

    const withdrawTo = async (callback: string) => {
        const store = createStore();
        (BackendUtils.createInvoice as jest.Mock).mockResolvedValue({
            rHash: 'r1',
            paymentRequest: 'lnbc1invoice'
        });

        await store.createInvoice({
            value: '1000',
            memo: 'x',
            lnurl: { callback, k1: 'K1', domain: 'service.example' },
            unified: true,
            noLsp: true
        } as any);

        // the callback fetch is not awaited by createInvoice
        await new Promise((res) => setTimeout(res, 20));
        return store;
    };

    beforeEach(() => {
        mockBlobFetch.mockClear();
    });

    it.each([
        'http://127.0.0.1:8080/cb',
        'https://192.168.1.1/cb',
        'https://169.254.169.254/cb',
        'http://cleartext.example/cb'
    ])('does not fetch a callback at %s', async (callback) => {
        await withdrawTo(callback);

        expect(mockBlobFetch).not.toHaveBeenCalled();
    });

    it('still fetches a public https callback', async () => {
        await withdrawTo('https://service.example/cb');

        expect(mockBlobFetch).toHaveBeenCalled();
        const [method, url] = mockBlobFetch.mock.calls[0] as any;
        expect(method).toBe('get');
        expect(String(url)).toContain('https://service.example/cb');
        expect(String(url)).toContain('k1=K1');
        expect(String(url)).toContain('pr=lnbc1invoice');
    });

    it('does not follow a callback redirect to the LAN', async () => {
        mockBlobFetch.mockResolvedValueOnce({
            info: () => ({
                status: 307,
                headers: { location: 'http://10.0.0.1/cb' }
            }),
            json: () => ({ status: 'OK' }),
            text: () => ''
        });

        await withdrawTo('https://service.example/cb');

        expect(mockBlobFetch).toHaveBeenCalledTimes(1);
    });
});
