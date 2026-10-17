jest.mock('../stores/Stores');
const mockBlobFetch = jest.fn((..._args: any[]) =>
    Promise.resolve({
        json: () => ({ status: 'OK' }),
        text: () => ''
    })
);
jest.mock('react-native-blob-util', () => ({
    __esModule: true,
    default: {
        fetch: (...args: any[]) => mockBlobFetch(...args)
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
        supportsFlowLSP: jest.fn(() => false),
        createInvoice: jest.fn()
    }
}));
jest.mock('../utils/LocaleUtils');

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

    // what Receive reads: onChainAddress for the QR, creatingInvoice for the
    // spinner, error_msg for the error banner
    const expectAddressShown = (
        store: InvoicesStore,
        result: string | undefined,
        address = 'bcrt1qtest'
    ) => {
        expect(result).toBe(address);
        expect(store.onChainAddress).toBe(address);
        expect(store.creatingInvoice).toBe(false);
        expect(store.error_msg).toBeNull();
    };

    // a store that is mid-request with a leftover address and error
    const dirtyStore = () => {
        const store = newStore();
        store.onChainAddress = 'bcrt1qold';
        store.error_msg = 'old error';
        return store;
    };

    it('honors an account-derived walletrpc address type for non-default accounts', async () => {
        const store = dirtyStore();
        const result = await store.getNewAddress({
            account: 'SeedSigner',
            type: 'TAPROOT_PUBKEY'
        });

        expect(BackendUtils.getNewAddress).toHaveBeenCalledWith({
            account: 'SeedSigner',
            type: 'TAPROOT_PUBKEY'
        });
        expectAddressShown(store, result);
    });

    it('normalizes walletrpc numeric address types from the embedded proto decode', async () => {
        const store = dirtyStore();
        const result = await store.getNewAddress({
            account: 'SeedSigner',
            type: 4
        });

        expect(BackendUtils.getNewAddress).toHaveBeenCalledWith({
            account: 'SeedSigner',
            type: 'TAPROOT_PUBKEY'
        });
        expectAddressShown(store, result);
    });

    it('drops non-account address types (like the settings preference) for non-default accounts', async () => {
        const store = dirtyStore();
        const result = await store.getNewAddress({
            account: 'SeedSigner',
            type: '0'
        });

        expect(BackendUtils.getNewAddress).toHaveBeenCalledWith({
            account: 'SeedSigner'
        });
        expectAddressShown(store, result);
    });

    it('leaves the requested type untouched for the default account', async () => {
        const store = dirtyStore();
        const result = await store.getNewAddress({
            account: 'default',
            type: '0'
        });

        expect(BackendUtils.getNewAddress).toHaveBeenCalledWith({
            account: 'default',
            type: '0'
        });
        expectAddressShown(store, result);
    });

    it('marks the request in flight and hides the old address until the backend answers', async () => {
        let resolve: (value: any) => void = () => {};
        (BackendUtils.getNewAddress as jest.Mock).mockReturnValue(
            new Promise((res) => (resolve = res))
        );

        const store = dirtyStore();
        const pending = store.getNewAddress({ account: 'default' });

        expect(store.creatingInvoice).toBe(true);
        expect(store.onChainAddress).toBeNull();
        expect(store.error_msg).toBeNull();

        resolve({ address: 'bcrt1qtest' });
        expectAddressShown(store, await pending);
    });

    it.each([
        ['LND / LDK Node / LNC (address)', { address: 'bcrt1qtest' }],
        ['CLN bech32', { bech32: 'bcrt1qtest' }],
        ['CLN p2tr', { p2tr: 'bcrt1qtest' }],
        ['LndHub /getbtc array', [{ address: 'bcrt1qtest' }]]
    ])('reads the address from the %s response shape', async (_, data) => {
        (BackendUtils.getNewAddress as jest.Mock).mockResolvedValue(data);

        const store = newStore();
        const result = await store.getNewAddress({ account: 'default' });

        expectAddressShown(store, result);
    });

    it('prefers address over bech32 and p2tr when a response carries several', async () => {
        (BackendUtils.getNewAddress as jest.Mock).mockResolvedValue({
            address: 'bcrt1qaddress',
            bech32: 'bcrt1qbech32',
            p2tr: 'bcrt1pp2tr'
        });

        const store = newStore();
        const result = await store.getNewAddress({ account: 'default' });

        expectAddressShown(store, result, 'bcrt1qaddress');
    });

    it('clears onChainAddress but leaves creatingInvoice and error_msg to createInvoice for unified requests', async () => {
        const store = newStore();
        store.onChainAddress = 'bcrt1qold';
        store.creatingInvoice = true;
        store.error_msg = 'createInvoice owns this';

        const result = await store.getNewAddress({
            account: 'default',
            unified: true
        });

        expect(result).toBe('bcrt1qtest');
        expect(store.onChainAddress).toBeNull();
        expect(store.creatingInvoice).toBe(true);
        expect(store.error_msg).toBe('createInvoice owns this');
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

        const store = dirtyStore();
        store.error = true;
        store.loading = true;
        const result = await store.getNewAddress({ account: 'SeedSigner' });

        expect(result).toBeUndefined();
        expect(store.onChainAddress).toBeNull();
        expect(store.error_msg).toBe('Error: account not found');
        expect(store.creatingInvoice).toBe(false);
        // getNewAddress reports through error_msg only
        expect(store.error).toBe(true);
        expect(store.loading).toBe(true);
    });

    it('falls back to the generic message when the rejection stringifies to nothing', async () => {
        (BackendUtils.getNewAddress as jest.Mock).mockRejectedValue('');

        const store = newStore();
        await store.getNewAddress({ account: 'default' });

        expect(store.error_msg).toBe(
            'stores.InvoicesStore.errorGeneratingAddress'
        );
        expect(store.creatingInvoice).toBe(false);
        expect(store.onChainAddress).toBeNull();
    });

    it('clears the previous error and shows the new address when a retry succeeds', async () => {
        (BackendUtils.getNewAddress as jest.Mock)
            .mockRejectedValueOnce(new Error('timeout'))
            .mockResolvedValueOnce({ address: 'bcrt1qtest' });

        const store = newStore();
        await store.getNewAddress({ account: 'default' });
        expect(store.error_msg).toBe('Error: timeout');

        const result = await store.getNewAddress({ account: 'default' });
        expectAddressShown(store, result);
    });

    it('drops the previous address when a later call fails', async () => {
        (BackendUtils.getNewAddress as jest.Mock)
            .mockResolvedValueOnce({ address: 'bcrt1qfirst' })
            .mockRejectedValueOnce(new Error('node offline'));

        const store = newStore();
        await store.getNewAddress({ account: 'default' });
        expect(store.onChainAddress).toBe('bcrt1qfirst');

        await store.getNewAddress({ account: 'default' });
        expect(store.onChainAddress).toBeNull();
        expect(store.error_msg).toBe('Error: node offline');
        expect(store.creatingInvoice).toBe(false);
    });

    // A backend rejecting with undefined/null makes the catch handler throw
    // on error.toString() (getNewChangeAddress uses error?.toString()), so
    // creatingInvoice stays true and error_msg stays null: Receive spins
    // forever with no error shown.
    it.todo(
        'clears creatingInvoice and sets error_msg when the backend rejects with undefined'
    );

    // A response with none of address / bech32 / p2tr / [0].address resolves
    // with undefined and leaves error_msg null, so Receive shows neither an
    // address nor an error.
    it.todo(
        'sets error_msg when the backend response carries no recognizable address'
    );
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

describe('InvoicesStore.createInvoice LSP decision', () => {
    const lspStoreMock = () => ({
        resetFee: jest.fn(),
        info: { pubkey: 'lsp', connection_methods: [] },
        getZeroConfFee: jest.fn(() => Promise.resolve()),
        zeroConfFee: 0,
        flow_error: false
    });

    const create = async (enableLSP: boolean, params: any) => {
        const lspStore = lspStoreMock();
        const store = new InvoicesStore(
            { settings: { enableLSP } } as any,
            lspStore as any,
            {} as any,
            {} as any
        );
        (BackendUtils.supportsFlowLSP as jest.Mock).mockReturnValue(true);
        // stop right after the LSP fee step
        (BackendUtils.createInvoice as jest.Mock).mockResolvedValue({
            error: true,
            message: 'stop'
        });
        await store.createInvoice({
            memo: '',
            value: '50000',
            expirySeconds: '3600',
            ...params
        });
        return lspStore;
    };

    afterEach(() => {
        (BackendUtils.supportsFlowLSP as jest.Mock).mockReturnValue(false);
    });

    it('takes the LSP path when the caller asks for it before settings.enableLSP has been written', async () => {
        // Receive: switch flipped on, enableLSP write still queued
        const lspStore = await create(false, { useLsp: true, noLsp: false });
        expect(lspStore.getZeroConfFee).toHaveBeenCalledWith(50000000);
    });

    it('skips the LSP when the caller says no, even with enableLSP set', async () => {
        const lspStore = await create(true, { useLsp: false, noLsp: true });
        expect(lspStore.getZeroConfFee).not.toHaveBeenCalled();
    });

    it('falls back to settings.enableLSP when the caller does not decide', async () => {
        expect((await create(true, {})).getZeroConfFee).toHaveBeenCalled();
        expect((await create(false, {})).getZeroConfFee).not.toHaveBeenCalled();
        expect(
            (await create(false, { forceLsp: true })).getZeroConfFee
        ).toHaveBeenCalled();
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

        const result = await store.createInvoice({
            value: '1000',
            memo: 'x',
            lnurl: { callback, k1: 'K1', domain: 'service.example' },
            unified: true,
            noLsp: true
        } as any);

        // the callback fetch is not awaited by createInvoice
        await new Promise((res) => setTimeout(res, 20));
        return { store, result };
    };

    beforeEach(() => {
        mockBlobFetch.mockClear();
        (BackendUtils.createInvoice as jest.Mock).mockClear();
    });

    it.each([
        'http://127.0.0.1:8080/cb',
        'https://192.168.1.1/cb',
        'https://169.254.169.254/cb',
        'http://cleartext.example/cb',
        'https://１２７.０.０.１/cb'
    ])('refuses a callback at %s before creating an invoice', async (cb) => {
        const { store, result } = await withdrawTo(cb);

        expect(mockBlobFetch).not.toHaveBeenCalled();
        expect(BackendUtils.createInvoice).not.toHaveBeenCalled();
        expect(result).toBeUndefined();
        expect(store.payment_request).toBeNull();
        expect(store.creatingInvoice).toBe(false);
        expect(store.creatingInvoiceError).toBe(true);
        expect(store.error_msg).toBe('utils.lnurl.unsafeCallback');
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
});
