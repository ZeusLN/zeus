jest.mock('../stores/Stores');
jest.mock('react-native-blob-util', () => ({ fetch: jest.fn() }));
jest.mock('../ldknode/LdkNodeInjection', () => ({
    __esModule: true,
    default: { bolt11: { sendBolt11Probes: jest.fn() } }
}));
jest.mock('../utils/BackendUtils', () => ({
    __esModule: true,
    default: {
        decodePaymentRequest: jest.fn(),
        getNewAddress: jest.fn(),
        getNewChangeAddress: jest.fn(),
        getRoutes: jest.fn(),
        isLNDBased: jest.fn(() => false),
        supportsFlowLSP: jest.fn(() => false),
        supportsOnchainReceiving: jest.fn(() => false),
        createInvoice: jest.fn(),
        lookupInvoice: jest.fn()
    }
}));
jest.mock('../utils/LocaleUtils');

import ReactNativeBlobUtil from 'react-native-blob-util';

import InvoicesStore from './InvoicesStore';
import BackendUtils from '../utils/BackendUtils';
import LdkNodeInjection from '../ldknode/LdkNodeInjection';

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

    it('does not send LDK Node probes for an invoice that was only decoded', async () => {
        (BackendUtils.decodePaymentRequest as jest.Mock).mockResolvedValue(
            lndDecodeResponse
        );

        const store = new InvoicesStore(
            { implementation: 'ldk-node' } as any,
            {} as any,
            {} as any,
            {} as any
        );
        await store.getPayReq(paymentRequest);
        await new Promise((resolve) => setImmediate(resolve));

        expect(store.pay_req!.getRequestAmount).toBeGreaterThan(0);
        expect(LdkNodeInjection.bolt11.sendBolt11Probes).not.toHaveBeenCalled();
    });
});

describe('InvoicesStore route fee estimate', () => {
    afterEach(() => {
        (BackendUtils.isLNDBased as jest.Mock).mockReturnValue(false);
    });

    it('queries routes in whole sats, rounded up, for a msat amount', async () => {
        (BackendUtils.isLNDBased as jest.Mock).mockReturnValue(true);
        (BackendUtils.getRoutes as jest.Mock).mockResolvedValue({
            routes: []
        });
        (BackendUtils.decodePaymentRequest as jest.Mock).mockResolvedValue({
            ...lndDecodeResponse,
            num_satoshis: '1',
            num_msat: '1500'
        });

        const store = newStore();
        await store.getPayReq(paymentRequest);

        expect(store.pay_req!.getRequestAmount).toBe(1.5);
        expect(BackendUtils.getRoutes).toHaveBeenCalledWith([
            lndDecodeResponse.destination,
            2
        ]);
    });
});

describe('InvoicesStore.isInvoicePaid', () => {
    it.each([
        [{ settled: true }, true],
        [{ status: 'paid' }, true],
        [{ settled: false, state: 'OPEN' }, false],
        [false, false]
    ])('reads %j from the node as paid: %s', async (response, paid) => {
        (BackendUtils.lookupInvoice as jest.Mock).mockResolvedValue(response);

        expect(await newStore().isInvoicePaid('aa')).toBe(paid);
        expect(BackendUtils.lookupInvoice).toHaveBeenCalledWith({
            r_hash: 'aa'
        });
    });

    it('treats an invoice the node cannot find as unpaid', async () => {
        (BackendUtils.lookupInvoice as jest.Mock).mockRejectedValue(
            new Error('not found')
        );

        expect(await newStore().isInvoicePaid('aa')).toBe(false);
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
        clearFee: jest.fn(),
        info: { pubkey: 'lsp', connection_methods: [] },
        getZeroConfFee: jest.fn(() => Promise.resolve({})),
        zeroConfFee: 0,
        flow_error: false
    });

    const create = async (
        enableLSP: boolean,
        params: any,
        flowLspNotConfigured = false
    ) => {
        const lspStore = lspStoreMock();
        const store = new InvoicesStore(
            { settings: { enableLSP } } as any,
            lspStore as any,
            {} as any,
            { flowLspNotConfigured: () => ({ flowLspNotConfigured }) } as any
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
        expect(lspStore.getZeroConfFee).toHaveBeenCalledWith(
            50000000,
            expect.any(Function)
        );
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

    it('skips the LSP where it is not configured when the caller does not decide', async () => {
        // e.g. LND REST without certificate verification: no screen shows
        // the LSP switch or fee there
        expect(
            (await create(true, {}, true)).getZeroConfFee
        ).not.toHaveBeenCalled();
        expect(
            (await create(false, { forceLsp: true }, true)).getZeroConfFee
        ).not.toHaveBeenCalled();
    });

    it('lets a caller that decides use the LSP regardless', async () => {
        expect(
            (await create(false, { useLsp: true }, true)).getZeroConfFee
        ).toHaveBeenCalled();
    });

    it('does not drop a fee request in flight for an invoice without the LSP', async () => {
        // e.g. an NWC make_invoice while Receive waits for its quote
        const lspStore = await create(true, { noLsp: true });
        expect(lspStore.resetFee).not.toHaveBeenCalled();
        expect(lspStore.clearFee).toHaveBeenCalled();
    });

    it('drops a fee request in flight for an invoice that asks for its own quote', async () => {
        const lspStore = await create(true, { useLsp: true });
        expect(lspStore.resetFee).toHaveBeenCalled();
        expect(lspStore.clearFee).not.toHaveBeenCalled();
    });

    it("creates an invoice without the LSP while another request's flow_error is set", async () => {
        const lspStore = lspStoreMock();
        lspStore.flow_error = true;
        const store = new InvoicesStore(
            { settings: { enableLSP: true } } as any,
            lspStore as any,
            {} as any,
            {
                flowLspNotConfigured: () => ({ flowLspNotConfigured: false })
            } as any
        );
        (BackendUtils.supportsFlowLSP as jest.Mock).mockReturnValue(true);
        (BackendUtils.createInvoice as jest.Mock).mockReset();
        (BackendUtils.createInvoice as jest.Mock).mockResolvedValue({
            payment_request: 'lnbc-inner',
            r_hash: 'hash'
        });

        const result = await store.createInvoice({
            memo: '',
            value: '50000',
            expirySeconds: '3600',
            noLsp: true
        });

        expect(BackendUtils.createInvoice).toHaveBeenCalled();
        expect(result!.paymentRequest).toBe('lnbc-inner');
    });
});

describe('InvoicesStore.createInvoice LSP fee quote', () => {
    const lnurl = {
        callback: 'https://service.example/withdraw?x=1',
        k1: 'k1',
        domain: 'service.example',
        maxWithdrawable: 200000000
    };

    const quote = (feeSats: number, feeId = `quote-${feeSats}`) =>
        Promise.resolve({ feeSats, feeId });

    const setup = (lspStoreOverrides: any = {}) => {
        const lspStore: any = {
            resetFee: jest.fn(),
            clearFee: jest.fn(),
            info: { pubkey: 'lsp', connection_methods: [] },
            getZeroConfFee: jest.fn(() => quote(2000)),
            getZeroConfInvoice: jest.fn(() => Promise.resolve('lnbc-wrapped')),
            // another request's quote, still held by the shared store
            zeroConfFee: 40000,
            flow_error: false,
            flow_error_msg: '',
            ...lspStoreOverrides
        };
        const store = new InvoicesStore(
            { settings: { enableLSP: true } } as any,
            lspStore,
            {} as any,
            {
                flowLspNotConfigured: () => ({ flowLspNotConfigured: false })
            } as any
        );
        (BackendUtils.supportsFlowLSP as jest.Mock).mockReturnValue(true);
        (BackendUtils.createInvoice as jest.Mock).mockReset();
        (BackendUtils.createInvoice as jest.Mock).mockResolvedValue({
            payment_request: 'lnbc-inner',
            r_hash: 'hash'
        });
        (ReactNativeBlobUtil.fetch as jest.Mock).mockReset();
        (ReactNativeBlobUtil.fetch as jest.Mock).mockResolvedValue({
            json: () => ({ status: 'OK' })
        });
        return { store, lspStore };
    };

    const requestedValue = () =>
        (
            BackendUtils.createInvoice as jest.Mock
        ).mock.calls[0][0].value.toString();

    const submittedInvoice = () => {
        const calls = (ReactNativeBlobUtil.fetch as jest.Mock).mock.calls;
        if (!calls.length) return undefined;
        return new URL(calls[0][1]).searchParams.get('pr');
    };

    afterEach(() => {
        (BackendUtils.supportsFlowLSP as jest.Mock).mockReturnValue(false);
    });

    it('prices the invoice with the quote its own request returned', async () => {
        const { store } = setup();

        await store.createInvoice({
            memo: '',
            value: '50000',
            expirySeconds: '3600'
        });

        expect(requestedValue()).toBe('48000');
    });

    it('verifies the wrapped invoice against that same quote', async () => {
        const { store, lspStore } = setup();

        const result = await store.createInvoice({
            memo: '',
            value: '50000',
            expirySeconds: '3600'
        });

        expect(lspStore.getZeroConfInvoice).toHaveBeenCalledWith(
            'lnbc-inner',
            expect.objectContaining({ feeSats: 2000, feeId: 'quote-2000' }),
            expect.any(Function)
        );
        expect(result!.paymentRequest).toBe('lnbc-wrapped');
    });

    it('creates no invoice when its fee request fails or is replaced', async () => {
        // a replaced request rejects without setting flow_error
        const { store } = setup({
            getZeroConfFee: jest.fn(() => Promise.reject())
        });

        const result = await store.createInvoice({
            memo: '',
            value: '50000',
            expirySeconds: '3600'
        });

        expect(BackendUtils.createInvoice).not.toHaveBeenCalled();
        expect(result).toBeUndefined();
        expect(store.creatingInvoice).toBe(false);
    });

    it('still adds a fee above the amount on top for a regular receive', async () => {
        // shown next to the invoice before it is shared
        const { store, lspStore } = setup({
            getZeroConfFee: jest.fn(() => quote(3000))
        });

        await store.createInvoice({
            memo: '',
            value: '1000',
            expirySeconds: '3600'
        });

        expect(requestedValue()).toBe('1000');
        expect(lspStore.getZeroConfInvoice).toHaveBeenCalledWith(
            'lnbc-inner',
            expect.objectContaining({ feeSats: 3000, feeId: 'quote-3000' }),
            expect.any(Function)
        );
    });

    it('sends the fee_id of its own quote when the shared one changes while the invoice is created', async () => {
        const { store, lspStore } = setup();
        // a newer preview quote lands while the node creates the invoice
        (BackendUtils.createInvoice as jest.Mock).mockImplementation(() => {
            lspStore.zeroConfFee = 9000;
            lspStore.feeId = 'later-preview';
            return Promise.resolve({
                payment_request: 'lnbc-inner',
                r_hash: 'hash'
            });
        });

        await store.createInvoice({
            memo: '',
            value: '50000',
            expirySeconds: '3600'
        });

        expect(lspStore.getZeroConfInvoice).toHaveBeenCalledWith(
            'lnbc-inner',
            expect.objectContaining({ feeSats: 2000, feeId: 'quote-2000' }),
            expect.any(Function)
        );
    });

    it("creates the invoice with its own quote when another request's error lands meanwhile", async () => {
        const { store, lspStore } = setup({
            getZeroConfFee: jest.fn(() => {
                // e.g. a Swaps fee preview that failed
                lspStore.flow_error = true;
                return quote(2000);
            })
        });

        const result = await store.createInvoice({
            memo: '',
            value: '50000',
            expirySeconds: '3600'
        });

        expect(requestedValue()).toBe('48000');
        expect(result!.paymentRequest).toBe('lnbc-wrapped');
    });

    // Receive shows payment_request_lsp_fee next to the invoice
    describe('the fee kept with the shown invoice', () => {
        const createShown = (store: InvoicesStore, extra: any = {}) =>
            store.createUnifiedInvoice({
                memo: '',
                value: '1000',
                expirySeconds: '3600',
                skipOnchain: true,
                ...extra
            });

        it('is the fee the invoice was priced with, after a later quote replaces the shared one', async () => {
            const { store, lspStore } = setup({
                getZeroConfFee: jest.fn(() => quote(10000))
            });

            await createShown(store);
            // e.g. a Swaps fee preview
            lspStore.zeroConfFee = 2000;

            expect(store.payment_request).toBe('lnbc-wrapped');
            expect(store.payment_request_amt).toBe('1000');
            expect(store.payment_request_lsp_fee).toBe(10000);
        });

        it('is 0 for an invoice wrapped without a fee', async () => {
            const { store } = setup({
                getZeroConfFee: jest.fn(() =>
                    Promise.resolve({ feeSats: undefined, feeId: 'free' })
                )
            });

            await createShown(store);

            expect(store.payment_request_lsp_fee).toBe(0);
        });

        it('is null for an invoice the LSP does not wrap', async () => {
            const { store } = setup();
            store.payment_request_lsp_fee = 2000;

            await createShown(store, { noLsp: true });

            expect(store.payment_request).toBe('lnbc-inner');
            expect(store.payment_request_lsp_fee).toBeNull();
        });

        it('is cleared when the LSP rejects the proposal', async () => {
            const { store } = setup({
                getZeroConfInvoice: jest.fn(() => Promise.reject())
            });
            store.payment_request_lsp_fee = 2000;

            await expect(createShown(store)).rejects.toThrow();

            expect(store.payment_request).toBeNull();
            expect(store.payment_request_lsp_fee).toBeNull();
        });

        it('is cleared with the invoice on reset', async () => {
            const { store } = setup();
            await createShown(store);

            store.reset();

            expect(store.payment_request_lsp_fee).toBeNull();
        });

        it('is cleared with the invoice by clearUnified', async () => {
            const { store } = setup();
            await createShown(store);
            expect(store.payment_request_lsp_fee).toBe(2000);

            store.clearUnified();

            expect(store.payment_request).toBeNull();
            expect(store.payment_request_lsp_fee).toBeNull();
        });
    });

    describe('LNURL-withdraw', () => {
        it('asks the caller to accept the fee before creating the invoice', async () => {
            const { store } = setup();
            const confirmLspFee = jest.fn(() => {
                expect(BackendUtils.createInvoice).not.toHaveBeenCalled();
                return Promise.resolve(true);
            });

            await store.createInvoice({
                memo: '',
                value: '50000',
                expirySeconds: '3600',
                lnurl: lnurl as any,
                confirmLspFee
            });

            expect(confirmLspFee).toHaveBeenCalledWith(2000, '50000');
            expect(requestedValue()).toBe('48000');
            expect(submittedInvoice()).toBe('lnbc-wrapped');
        });

        it('creates and submits nothing when the fee is declined', async () => {
            const { store, lspStore } = setup();

            const result = await store.createInvoice({
                memo: '',
                value: '50000',
                expirySeconds: '3600',
                lnurl: lnurl as any,
                confirmLspFee: () => Promise.resolve(false)
            });

            expect(result).toBeUndefined();
            expect(BackendUtils.createInvoice).not.toHaveBeenCalled();
            expect(ReactNativeBlobUtil.fetch).not.toHaveBeenCalled();
            expect(lspStore.resetFee).toHaveBeenCalled();
            expect(store.creatingInvoice).toBe(false);
        });

        it('creates and submits nothing when no caller can show the fee', async () => {
            const { store } = setup();

            await store.createInvoice({
                memo: '',
                value: '50000',
                expirySeconds: '3600',
                lnurl: lnurl as any
            });

            expect(BackendUtils.createInvoice).not.toHaveBeenCalled();
            expect(ReactNativeBlobUtil.fetch).not.toHaveBeenCalled();
        });

        it('shows a fee of all but 1 sat to the caller and stops when declined', async () => {
            const { store } = setup({
                getZeroConfFee: jest.fn(() => quote(49999))
            });
            const confirmLspFee = jest.fn(() => Promise.resolve(false));

            await store.createInvoice({
                memo: '',
                value: '50000',
                expirySeconds: '3600',
                lnurl: lnurl as any,
                confirmLspFee
            });

            expect(confirmLspFee).toHaveBeenCalledWith(49999, '50000');
            expect(BackendUtils.createInvoice).not.toHaveBeenCalled();
            expect(ReactNativeBlobUtil.fetch).not.toHaveBeenCalled();
        });

        it.each([
            ['equal to', 50000],
            ['above', 60000]
        ])(
            'asks before adding a fee %s the amount on top',
            async (_label, fee) => {
                const { store, lspStore } = setup({
                    getZeroConfFee: jest.fn(() => quote(fee))
                });
                const confirmLspFee = jest.fn(() => Promise.resolve(true));

                await store.createInvoice({
                    memo: '',
                    value: '50000',
                    expirySeconds: '3600',
                    lnurl: lnurl as any,
                    confirmLspFee
                });

                expect(confirmLspFee).toHaveBeenCalledWith(fee, '50000');
                expect(requestedValue()).toBe('50000');
                expect(lspStore.getZeroConfInvoice).toHaveBeenCalledWith(
                    'lnbc-inner',
                    expect.objectContaining({ feeSats: fee }),
                    expect.any(Function)
                );
                expect(submittedInvoice()).toBe('lnbc-wrapped');
            }
        );

        it('stops without asking when the fee on top would exceed maxWithdrawable', async () => {
            // 50000 + 160000 is above the service's 200000 sats
            const { store, lspStore } = setup({
                getZeroConfFee: jest.fn(() => quote(160000))
            });
            const confirmLspFee = jest.fn(() => Promise.resolve(true));

            const result = await store.createInvoice({
                memo: '',
                value: '50000',
                expirySeconds: '3600',
                lnurl: lnurl as any,
                confirmLspFee
            });

            expect(result).toBeUndefined();
            expect(confirmLspFee).not.toHaveBeenCalled();
            expect(BackendUtils.createInvoice).not.toHaveBeenCalled();
            expect(ReactNativeBlobUtil.fetch).not.toHaveBeenCalled();
            expect(lspStore.flow_error).toBe(true);
            expect(lspStore.flow_error_msg).toBe(
                'stores.InvoicesStore.lspFeeAboveMaxWithdrawable'
            );
            expect(store.creatingInvoice).toBe(false);
        });

        it('asks when the fee on top reaches exactly maxWithdrawable', async () => {
            const { store } = setup({
                getZeroConfFee: jest.fn(() => quote(150000))
            });
            const confirmLspFee = jest.fn(() => Promise.resolve(true));

            await store.createInvoice({
                memo: '',
                value: '50000',
                expirySeconds: '3600',
                lnurl: lnurl as any,
                confirmLspFee
            });

            expect(confirmLspFee).toHaveBeenCalledWith(150000, '50000');
            expect(submittedInvoice()).toBe('lnbc-wrapped');
        });

        it('does not cap a deducted fee by maxWithdrawable', async () => {
            // the service is asked for the amount itself
            const { store } = setup({
                getZeroConfFee: jest.fn(() => quote(2000))
            });
            const confirmLspFee = jest.fn(() => Promise.resolve(true));

            await store.createInvoice({
                memo: '',
                value: '200000',
                expirySeconds: '3600',
                lnurl: lnurl as any,
                confirmLspFee
            });

            expect(confirmLspFee).toHaveBeenCalledWith(2000, '200000');
            expect(requestedValue()).toBe('198000');
        });

        it('sends the fee_id of the accepted quote when another quote lands during the confirmation', async () => {
            const { store, lspStore } = setup();
            const confirmLspFee = jest.fn(() => {
                lspStore.zeroConfFee = 9000;
                lspStore.feeId = 'later-preview';
                return Promise.resolve(true);
            });

            await store.createInvoice({
                memo: '',
                value: '50000',
                expirySeconds: '3600',
                lnurl: lnurl as any,
                confirmLspFee
            });

            expect(lspStore.getZeroConfInvoice).toHaveBeenCalledWith(
                'lnbc-inner',
                expect.objectContaining({ feeSats: 2000, feeId: 'quote-2000' }),
                expect.any(Function)
            );
        });

        describe('when the confirmation outlasts the quote', () => {
            let now: number;

            beforeEach(() => {
                now = 1_000_000;
                jest.spyOn(Date, 'now').mockImplementation(() => now);
            });

            afterEach(() => {
                jest.restoreAllMocks();
            });

            // the user answers after the LSP has dropped the fee_id
            const slowAnswer = (answers: boolean[]) =>
                jest.fn(() => {
                    now += 5 * 60 * 1000;
                    return Promise.resolve(answers.shift()!);
                });

            it('fetches a new quote and does not ask again for the same fee', async () => {
                const { store, lspStore } = setup({
                    getZeroConfFee: jest
                        .fn()
                        .mockReturnValueOnce(quote(2000, 'expired'))
                        .mockReturnValueOnce(quote(2000, 'fresh'))
                });
                const confirmLspFee = slowAnswer([true]);

                await store.createInvoice({
                    memo: '',
                    value: '50000',
                    expirySeconds: '3600',
                    lnurl: lnurl as any,
                    confirmLspFee
                });

                expect(confirmLspFee).toHaveBeenCalledTimes(1);
                expect(requestedValue()).toBe('48000');
                expect(lspStore.getZeroConfInvoice).toHaveBeenCalledWith(
                    'lnbc-inner',
                    expect.objectContaining({ feeSats: 2000, feeId: 'fresh' }),
                    expect.any(Function)
                );
            });

            it('asks again when the new fee is lower, since it can change the amount received', async () => {
                // 3000 was added on top of 1000; 500 would be deducted
                const { store, lspStore } = setup({
                    getZeroConfFee: jest
                        .fn()
                        .mockReturnValueOnce(quote(3000, 'expired'))
                        .mockReturnValueOnce(quote(500, 'fresh'))
                });
                const confirmLspFee = jest
                    .fn()
                    .mockImplementationOnce(() => {
                        now += 5 * 60 * 1000;
                        return Promise.resolve(true);
                    })
                    .mockImplementationOnce(() => Promise.resolve(true));

                await store.createInvoice({
                    memo: '',
                    value: '1000',
                    expirySeconds: '3600',
                    lnurl: lnurl as any,
                    confirmLspFee
                });

                expect(confirmLspFee).toHaveBeenNthCalledWith(1, 3000, '1000');
                expect(confirmLspFee).toHaveBeenNthCalledWith(2, 500, '1000');
                expect(requestedValue()).toBe('500');
                expect(lspStore.getZeroConfInvoice).toHaveBeenCalledWith(
                    'lnbc-inner',
                    expect.objectContaining({ feeSats: 500, feeId: 'fresh' }),
                    expect.any(Function)
                );
            });

            it('asks again when the new fee is higher, and stops when that is declined', async () => {
                const { store } = setup({
                    getZeroConfFee: jest
                        .fn()
                        .mockReturnValueOnce(quote(2000, 'expired'))
                        .mockReturnValueOnce(quote(2500, 'fresh'))
                });
                const confirmLspFee = slowAnswer([true, false]);

                await store.createInvoice({
                    memo: '',
                    value: '50000',
                    expirySeconds: '3600',
                    lnurl: lnurl as any,
                    confirmLspFee
                });

                expect(confirmLspFee).toHaveBeenNthCalledWith(1, 2000, '50000');
                expect(confirmLspFee).toHaveBeenNthCalledWith(2, 2500, '50000');
                expect(BackendUtils.createInvoice).not.toHaveBeenCalled();
                expect(ReactNativeBlobUtil.fetch).not.toHaveBeenCalled();
            });

            it('does not ask again when the new fee is zero', async () => {
                const { store, lspStore } = setup({
                    getZeroConfFee: jest
                        .fn()
                        .mockReturnValueOnce(quote(2000, 'expired'))
                        .mockReturnValueOnce(quote(0, 'fresh'))
                });
                const confirmLspFee = slowAnswer([true]);

                await store.createInvoice({
                    memo: '',
                    value: '50000',
                    expirySeconds: '3600',
                    lnurl: lnurl as any,
                    confirmLspFee
                });

                expect(confirmLspFee).toHaveBeenCalledTimes(1);
                expect(requestedValue()).toBe('50000');
                expect(lspStore.getZeroConfInvoice).toHaveBeenCalledWith(
                    'lnbc-inner',
                    expect.objectContaining({ feeSats: 0, feeId: 'fresh' }),
                    expect.any(Function)
                );
            });

            it('stops when the new fee on top would exceed maxWithdrawable', async () => {
                const { store, lspStore } = setup({
                    getZeroConfFee: jest
                        .fn()
                        .mockReturnValueOnce(quote(60000, 'expired'))
                        .mockReturnValueOnce(quote(160000, 'fresh'))
                });
                const confirmLspFee = slowAnswer([true, true]);

                await store.createInvoice({
                    memo: '',
                    value: '50000',
                    expirySeconds: '3600',
                    lnurl: lnurl as any,
                    confirmLspFee
                });

                expect(confirmLspFee).toHaveBeenCalledTimes(1);
                expect(BackendUtils.createInvoice).not.toHaveBeenCalled();
                expect(lspStore.flow_error_msg).toBe(
                    'stores.InvoicesStore.lspFeeAboveMaxWithdrawable'
                );
            });

            it('fetches a new quote when the user answers after more than 3 minutes', async () => {
                // leaves the node invoice and the proposal time before
                // the LSP drops the fee_id
                const { store, lspStore } = setup({
                    getZeroConfFee: jest
                        .fn()
                        .mockReturnValueOnce(quote(2000, 'old'))
                        .mockReturnValueOnce(quote(2000, 'fresh'))
                });
                const confirmLspFee = jest.fn(() => {
                    now += 3.5 * 60 * 1000;
                    return Promise.resolve(true);
                });

                await store.createInvoice({
                    memo: '',
                    value: '50000',
                    expirySeconds: '3600',
                    lnurl: lnurl as any,
                    confirmLspFee
                });

                expect(lspStore.getZeroConfFee).toHaveBeenCalledTimes(2);
                expect(lspStore.getZeroConfInvoice).toHaveBeenCalledWith(
                    'lnbc-inner',
                    expect.objectContaining({ feeId: 'fresh' }),
                    expect.any(Function)
                );
            });

            it('creates nothing when the new quote cannot be fetched', async () => {
                const { store } = setup({
                    getZeroConfFee: jest
                        .fn()
                        .mockReturnValueOnce(quote(2000, 'expired'))
                        .mockImplementationOnce(() => Promise.reject())
                });

                await store.createInvoice({
                    memo: '',
                    value: '50000',
                    expirySeconds: '3600',
                    lnurl: lnurl as any,
                    confirmLspFee: slowAnswer([true])
                });

                expect(BackendUtils.createInvoice).not.toHaveBeenCalled();
                expect(store.creatingInvoice).toBe(false);
            });
        });

        it('submits without asking when the LSP charges no fee', async () => {
            const { store } = setup({
                getZeroConfFee: jest.fn(() => quote(0))
            });
            const confirmLspFee = jest.fn(() => Promise.resolve(false));

            await store.createInvoice({
                memo: '',
                value: '50000',
                expirySeconds: '3600',
                lnurl: lnurl as any,
                confirmLspFee
            });

            expect(confirmLspFee).not.toHaveBeenCalled();
            expect(requestedValue()).toBe('50000');
            expect(submittedInvoice()).toBe('lnbc-wrapped');
        });
    });
});

describe('InvoicesStore.createUnifiedInvoice', () => {
    const deferred = () => {
        let resolve: (value: any) => void = () => {};
        const promise = new Promise((r) => (resolve = r));
        return { promise, resolve };
    };

    const newUnifiedStore = () =>
        new InvoicesStore(
            { settings: {} } as any,
            {
                resetFee: jest.fn(),
                clearFee: jest.fn(),
                flow_error: false
            } as any,
            {} as any,
            {} as any
        );

    const params = { memo: '', value: '1000', expirySeconds: '3600' };

    // Values the Receive screen could be showing, none of them defaults, so
    // a silent call that reset them would be caught.
    const seedReceiveState = (store: InvoicesStore) => {
        store.payment_request = 'lnbc-on-screen';
        store.payment_request_amt = '500';
        store.creatingInvoice = true;
        store.creatingInvoiceError = true;
        store.error_msg = 'earlier error';
        store.loading = true;
    };

    const expectReceiveStateKept = (store: InvoicesStore) => {
        expect(store.payment_request).toBe('lnbc-on-screen');
        expect(store.payment_request_amt).toBe('500');
        expect(store.creatingInvoice).toBe(true);
        expect(store.creatingInvoiceError).toBe(true);
        expect(store.error_msg).toBe('earlier error');
        expect(store.loading).toBe(true);
    };

    afterEach(() => {
        (BackendUtils.createInvoice as jest.Mock).mockReset();
    });

    it('returns each overlapping call its own payment request', async () => {
        const first = deferred();
        const second = deferred();
        (BackendUtils.createInvoice as jest.Mock)
            .mockReturnValueOnce(first.promise)
            .mockReturnValueOnce(second.promise);

        const store = newUnifiedStore();
        const a = store.createUnifiedInvoice(params);
        const b = store.createUnifiedInvoice(params);
        // both backend calls finish in the same tick
        first.resolve({ payment_request: 'lnbc-first', r_hash: 'aa' });
        second.resolve({ payment_request: 'lnbc-second', r_hash: 'bb' });

        const [resultA, resultB]: any[] = await Promise.all([a, b]);
        expect(resultA).toEqual({
            rHash: 'aa',
            paymentRequest: 'lnbc-first',
            lspFeeSats: null
        });
        expect(resultB).toEqual({
            rHash: 'bb',
            paymentRequest: 'lnbc-second',
            lspFeeSats: null
        });
    });

    it('leaves the invoice shown on the Receive screen alone when silent', async () => {
        (BackendUtils.createInvoice as jest.Mock).mockResolvedValue({
            payment_request: 'lnbc-nwc',
            r_hash: 'cc'
        });

        const store = newUnifiedStore();
        seedReceiveState(store);

        const result: any = await store.createUnifiedInvoice({
            ...params,
            noLsp: true,
            silent: true
        });

        expect(result.paymentRequest).toBe('lnbc-nwc');
        expectReceiveStateKept(store);
        // the fee quote and LSP error shown on the Receive screen stay too
        expect(store.lspStore.clearFee).not.toHaveBeenCalled();
        expect(store.lspStore.resetFee).not.toHaveBeenCalled();
    });

    it('throws the backend error instead of setting error_msg when silent', async () => {
        (BackendUtils.createInvoice as jest.Mock).mockResolvedValue({
            error: true,
            message: 'node offline'
        });

        const store = newUnifiedStore();
        seedReceiveState(store);

        await expect(
            store.createUnifiedInvoice({
                ...params,
                noLsp: true,
                silent: true
            })
        ).rejects.toThrow('node offline');
        expectReceiveStateKept(store);
    });

    it('throws a rejected backend call without touching the Receive screen when silent', async () => {
        (BackendUtils.createInvoice as jest.Mock).mockRejectedValue(
            new Error('connection refused')
        );

        const store = newUnifiedStore();
        seedReceiveState(store);

        await expect(
            store.createUnifiedInvoice({
                ...params,
                noLsp: true,
                silent: true
            })
        ).rejects.toThrow('connection refused');
        expectReceiveStateKept(store);
    });

    it('keeps the Receive screen fields when silent and the backend can receive on-chain', async () => {
        (BackendUtils.createInvoice as jest.Mock).mockResolvedValue({
            payment_request: 'lnbc-nwc',
            r_hash: 'ee'
        });
        (BackendUtils.supportsOnchainReceiving as jest.Mock).mockReturnValue(
            true
        );

        const store = newUnifiedStore();
        seedReceiveState(store);
        store.onChainAddress = 'bcrt1-on-screen';
        (store as any).getNewAddress = jest
            .fn()
            .mockResolvedValue('bcrt1-silent');

        try {
            const result: any = await store.createUnifiedInvoice({
                ...params,
                noLsp: true,
                silent: true
            });

            expect(result).toEqual({
                rHash: 'ee',
                paymentRequest: 'lnbc-nwc',
                onChainAddress: 'bcrt1-silent',
                lspFeeSats: null
            });
            expectReceiveStateKept(store);
            expect(store.onChainAddress).toBe('bcrt1-on-screen');
        } finally {
            (
                BackendUtils.supportsOnchainReceiving as jest.Mock
            ).mockReturnValue(false);
        }
    });

    it('still updates the Receive screen fields by default', async () => {
        (BackendUtils.createInvoice as jest.Mock).mockResolvedValue({
            payment_request: 'lnbc-receive',
            r_hash: 'dd'
        });

        const store = newUnifiedStore();
        await store.createUnifiedInvoice(params);

        expect(store.payment_request).toBe('lnbc-receive');
        expect(store.payment_request_amt).toBe('1000');
        expect(store.creatingInvoice).toBe(false);
    });
});

// Leaving Receive calls reset(), and a new sale or a changed amount starts
// a new request, while an older createUnifiedInvoice can still be waiting
// on the node, the LSP or the user. The older call must not reach the
// screen or the LNURL withdraw service, but still answers its own caller.
describe('InvoicesStore superseded invoice requests', () => {
    const deferred = () => {
        let resolve: (value: any) => void = () => {};
        let reject: (error: any) => void = () => {};
        const promise = new Promise((res, rej) => {
            resolve = res;
            reject = rej;
        });
        return { promise, resolve, reject };
    };

    const flush = () => new Promise((resolve) => setImmediate(resolve));

    const lnurl = (k1: string) =>
        ({
            callback: 'https://service.example/withdraw',
            k1,
            domain: 'service.example'
        } as any);

    const submittedK1s = () =>
        (ReactNativeBlobUtil.fetch as jest.Mock).mock.calls.map((call) =>
            new URL(call[1]).searchParams.get('k1')
        );

    const newStore = (lspStore: any = {}) =>
        new InvoicesStore(
            { settings: {} } as any,
            {
                resetFee: jest.fn(),
                clearFee: jest.fn(),
                flow_error: false,
                ...lspStore
            } as any,
            {} as any,
            {} as any
        );

    const params = { memo: '', value: '1000', expirySeconds: '3600' };

    // What the next Receive screen could be showing by the time the old
    // call finishes, none of it a default value
    const seedNextScreen = (store: InvoicesStore) => {
        store.payment_request = 'lnbc-next';
        store.payment_request_amt = '777';
        store.onChainAddress = 'bcrt1-next';
        store.creatingInvoice = true;
        store.creatingInvoiceError = false;
        store.error_msg = null;
        store.loading = true;
    };

    const expectNextScreenKept = (store: InvoicesStore) => {
        expect(store.payment_request).toBe('lnbc-next');
        expect(store.payment_request_amt).toBe('777');
        expect(store.onChainAddress).toBe('bcrt1-next');
        expect(store.creatingInvoice).toBe(true);
        expect(store.creatingInvoiceError).toBe(false);
        expect(store.error_msg).toBeNull();
        expect(store.loading).toBe(true);
    };

    beforeEach(() => {
        (BackendUtils.createInvoice as jest.Mock).mockReset();
        (BackendUtils.getNewAddress as jest.Mock).mockReset();
        (ReactNativeBlobUtil.fetch as jest.Mock).mockReset();
        (ReactNativeBlobUtil.fetch as jest.Mock).mockResolvedValue({
            json: () => ({ status: 'OK' })
        });
    });

    afterEach(() => {
        (BackendUtils.supportsOnchainReceiving as jest.Mock).mockReturnValue(
            false
        );
        (BackendUtils.supportsFlowLSP as jest.Mock).mockReturnValue(false);
    });

    it('returns a late invoice after reset() without showing or submitting it', async () => {
        const backend = deferred();
        (BackendUtils.createInvoice as jest.Mock).mockReturnValueOnce(
            backend.promise
        );
        const store = newStore();

        const pending = store.createUnifiedInvoice({
            ...params,
            lnurl: lnurl('old')
        });
        await flush();
        store.reset();
        seedNextScreen(store);
        backend.resolve({ payment_request: 'lnbc-old', r_hash: 'aa' });

        await expect(pending).resolves.toEqual({
            rHash: 'aa',
            paymentRequest: 'lnbc-old',
            lspFeeSats: null
        });
        await flush();
        expectNextScreenKept(store);
        expect(ReactNativeBlobUtil.fetch).not.toHaveBeenCalled();
    });

    it('shows a stored invoice in one step and keeps it from a request still running', async () => {
        const backend = deferred();
        (BackendUtils.createInvoice as jest.Mock).mockReturnValueOnce(
            backend.promise
        );
        const store = newStore();

        const pending = store.createUnifiedInvoice({
            ...params,
            lnurl: lnurl('old')
        });
        await flush();
        // a reopened POS order reuses its stored invoice
        store.showStoredInvoice({
            paymentRequest: 'lnbc-stored',
            amount: '1000',
            lspFeeSats: 10000
        });
        backend.resolve({ payment_request: 'lnbc-old', r_hash: 'aa' });

        await expect(pending).resolves.toEqual(
            expect.objectContaining({ paymentRequest: 'lnbc-old' })
        );
        await flush();
        expect(store.payment_request).toBe('lnbc-stored');
        expect(store.payment_request_amt).toBe('1000');
        expect(store.payment_request_lsp_fee).toBe(10000);
        expect(ReactNativeBlobUtil.fetch).not.toHaveBeenCalled();
    });

    it('keeps the newer invoice and withdraw when an older request finishes last', async () => {
        const older = deferred();
        const newer = deferred();
        (BackendUtils.createInvoice as jest.Mock)
            .mockReturnValueOnce(older.promise)
            .mockReturnValueOnce(newer.promise);
        const store = newStore();

        const a = store.createUnifiedInvoice({
            ...params,
            lnurl: lnurl('old')
        });
        const b = store.createUnifiedInvoice({
            ...params,
            value: '2000',
            lnurl: lnurl('new')
        });
        await flush();
        newer.resolve({ payment_request: 'lnbc-new', r_hash: 'bb' });
        await expect(b).resolves.toEqual({
            rHash: 'bb',
            paymentRequest: 'lnbc-new',
            lspFeeSats: null
        });
        older.resolve({ payment_request: 'lnbc-old', r_hash: 'aa' });
        await expect(a).resolves.toEqual({
            rHash: 'aa',
            paymentRequest: 'lnbc-old',
            lspFeeSats: null
        });
        await flush();

        expect(store.payment_request).toBe('lnbc-new');
        expect(store.payment_request_amt).toBe('2000');
        expect(store.creatingInvoice).toBe(false);
        expect(submittedK1s()).toEqual(['new']);
    });

    it('still rejects a late failure after reset() without reporting it', async () => {
        const store = newStore();
        const rejected = deferred();
        const errored = deferred();
        (BackendUtils.createInvoice as jest.Mock)
            .mockReturnValueOnce(rejected.promise)
            .mockReturnValueOnce(errored.promise);

        const thrown = store.createUnifiedInvoice(params);
        await flush();
        store.reset();
        const returned = store.createUnifiedInvoice(params);
        await flush();
        store.reset();
        seedNextScreen(store);
        rejected.reject(new Error('connection refused'));
        errored.resolve({ error: true, message: 'node offline' });

        await expect(thrown).rejects.toThrow('connection refused');
        await expect(returned).rejects.toThrow(
            'stores.InvoicesStore.errorCreatingInvoice'
        );
        expectNextScreenKept(store);
    });

    it('still rejects a late failure after a newer request without reporting it', async () => {
        const older = deferred();
        (BackendUtils.createInvoice as jest.Mock)
            .mockReturnValueOnce(older.promise)
            .mockResolvedValueOnce({
                payment_request: 'lnbc-new',
                r_hash: 'bb'
            });
        const store = newStore();

        const a = store.createUnifiedInvoice(params);
        await store.createUnifiedInvoice(params);
        older.reject(new Error('connection refused'));

        await expect(a).rejects.toThrow('connection refused');
        expect(store.payment_request).toBe('lnbc-new');
        expect(store.creatingInvoiceError).toBe(false);
        expect(store.error_msg).toBeNull();
        expect(store.creatingInvoice).toBe(false);
        expect(store.loading).toBe(false);
    });

    it('leaves the next screen alone when the on-chain address arrives after reset()', async () => {
        (BackendUtils.supportsOnchainReceiving as jest.Mock).mockReturnValue(
            true
        );
        (BackendUtils.createInvoice as jest.Mock).mockResolvedValue({
            payment_request: 'lnbc-old',
            r_hash: 'aa'
        });
        const address = deferred();
        const failedAddress = deferred();
        (BackendUtils.getNewAddress as jest.Mock)
            .mockReturnValueOnce(address.promise)
            .mockReturnValueOnce(failedAddress.promise);
        const store = newStore();

        const pending = store.createUnifiedInvoice(params);
        const failing = store.createUnifiedInvoice(params);
        await flush();
        expect(BackendUtils.getNewAddress).toHaveBeenCalledTimes(2);
        store.reset();
        seedNextScreen(store);
        address.resolve({ address: 'bcrt1-old' });
        failedAddress.reject(new Error('wallet locked'));

        await expect(pending).resolves.toEqual({
            rHash: 'aa',
            paymentRequest: 'lnbc-old',
            onChainAddress: 'bcrt1-old',
            lspFeeSats: null
        });
        await failing;
        expectNextScreenKept(store);
    });

    it('does not let a silent call and a Receive call supersede each other', async () => {
        const receive = deferred();
        const nwc = deferred();
        (BackendUtils.createInvoice as jest.Mock)
            .mockReturnValueOnce(receive.promise)
            .mockReturnValueOnce(nwc.promise)
            .mockResolvedValueOnce({
                payment_request: 'lnbc-receive-2',
                r_hash: 'cc'
            });
        const store = newStore();

        const shown = store.createUnifiedInvoice({
            ...params,
            lnurl: lnurl('receive')
        });
        const silent = store.createUnifiedInvoice({
            ...params,
            noLsp: true,
            silent: true
        });
        await flush();
        receive.resolve({ payment_request: 'lnbc-receive', r_hash: 'aa' });
        await shown;
        expect(store.payment_request).toBe('lnbc-receive');
        expect(submittedK1s()).toEqual(['receive']);

        // a Receive request that starts while the silent one is pending
        // does not stop it either
        await store.createUnifiedInvoice(params);
        nwc.resolve({ payment_request: 'lnbc-nwc', r_hash: 'bb' });
        await expect(silent).resolves.toEqual({
            rHash: 'bb',
            paymentRequest: 'lnbc-nwc',
            lspFeeSats: null
        });
        expect(store.payment_request).toBe('lnbc-receive-2');
    });

    describe('with the LSP', () => {
        const lspSetup = (overrides: any = {}) => {
            const lspStore: any = {
                info: { pubkey: 'lsp', connection_methods: [] },
                getZeroConfFee: jest.fn(() =>
                    Promise.resolve({ feeSats: 2000, feeId: 'quote' })
                ),
                getZeroConfInvoice: jest.fn(() =>
                    Promise.resolve('lnbc-wrapped')
                ),
                zeroConfFee: 2500,
                feeId: 'quote-on-screen',
                ...overrides
            };
            const store = new InvoicesStore(
                { settings: { enableLSP: true } } as any,
                {
                    resetFee: jest.fn(),
                    clearFee: jest.fn(),
                    flow_error: false,
                    ...lspStore
                } as any,
                {} as any,
                {
                    flowLspNotConfigured: () => ({
                        flowLspNotConfigured: false
                    })
                } as any
            );
            (BackendUtils.supportsFlowLSP as jest.Mock).mockReturnValue(true);
            (BackendUtils.createInvoice as jest.Mock).mockResolvedValue({
                payment_request: 'lnbc-inner',
                r_hash: 'hash'
            });
            return store;
        };

        it('drops a fee quote that arrives after reset() and asks for no other', async () => {
            const quote = deferred();
            const store = lspSetup({
                getZeroConfFee: jest.fn(() => quote.promise)
            });

            const pending = store.createUnifiedInvoice({
                ...params,
                value: '50000'
            });
            await flush();
            const isCurrent = (store.lspStore.getZeroConfFee as jest.Mock).mock
                .calls[0][1];
            expect(isCurrent()).toBe(true);
            store.reset();
            // LSPStore drops the answer and the error for this request
            expect(isCurrent()).toBe(false);
            quote.reject(undefined);

            await expect(pending).rejects.toThrow(
                'stores.InvoicesStore.errorCreatingInvoice'
            );
            expect(store.lspStore.getZeroConfFee).toHaveBeenCalledTimes(1);
            expect(BackendUtils.createInvoice).not.toHaveBeenCalled();
        });

        it('asks for no fee quote when superseded while connecting to the LSP', async () => {
            const connected = deferred();
            const store = lspSetup({
                info: {
                    pubkey: 'lsp',
                    connection_methods: [{ address: 'lsp.example', port: 9735 }]
                }
            });
            store.channelsStore = {
                connectPeer: jest.fn(() => connected.promise)
            } as any;

            const pending = store.createUnifiedInvoice({
                ...params,
                value: '50000'
            });
            await flush();
            expect(store.channelsStore.connectPeer).toHaveBeenCalled();
            store.reset();
            connected.resolve(undefined);

            await expect(pending).rejects.toThrow();
            // a quote request would drop the one the next request waits for
            expect(store.lspStore.getZeroConfFee).not.toHaveBeenCalled();
            expect(BackendUtils.createInvoice).not.toHaveBeenCalled();
        });

        it('does not ask to accept the fee for a request that was superseded', async () => {
            const quote = deferred();
            const confirmLspFee = jest.fn(() => Promise.resolve(true));
            const store = lspSetup({
                getZeroConfFee: jest.fn(() => quote.promise)
            });

            const pending = store.createUnifiedInvoice({
                ...params,
                value: '50000',
                lnurl: lnurl('old'),
                confirmLspFee
            });
            await flush();
            store.reset();
            quote.resolve({ feeSats: 2000, feeId: 'old' });

            await expect(pending).rejects.toThrow();
            expect(confirmLspFee).not.toHaveBeenCalled();
            expect(ReactNativeBlobUtil.fetch).not.toHaveBeenCalled();
        });

        it('leaves the fee state alone when a superseded request is declined', async () => {
            const answer = deferred();
            const store = lspSetup();
            const resetFee = store.lspStore.resetFee as jest.Mock;

            const pending = store.createUnifiedInvoice({
                ...params,
                value: '50000',
                lnurl: lnurl('old'),
                confirmLspFee: () => answer.promise as Promise<boolean>
            });
            await flush();
            expect(resetFee).toHaveBeenCalledTimes(1);
            store.reset();
            answer.resolve(false);

            await expect(pending).rejects.toThrow();
            // resetFee would drop the quote the next request waits for
            expect(resetFee).toHaveBeenCalledTimes(1);
        });

        it('returns the wrapped invoice of a superseded request without showing or submitting it', async () => {
            const answer = deferred();
            const store = lspSetup();

            const pending = store.createUnifiedInvoice({
                ...params,
                value: '50000',
                lnurl: lnurl('old'),
                confirmLspFee: () => answer.promise as Promise<boolean>
            });
            await flush();
            store.reset();
            seedNextScreen(store);
            answer.resolve(true);

            await expect(pending).resolves.toEqual({
                rHash: expect.any(String),
                paymentRequest: 'lnbc-wrapped',
                lspFeeSats: 2000
            });
            await flush();
            const proposalIsCurrent = (
                store.lspStore.getZeroConfInvoice as jest.Mock
            ).mock.calls[0][2];
            expect(proposalIsCurrent()).toBe(false);
            expectNextScreenKept(store);
            expect(ReactNativeBlobUtil.fetch).not.toHaveBeenCalled();
        });

        it('keeps the fee shown when a superseded proposal fails', async () => {
            const proposal = deferred();
            const store = lspSetup({
                getZeroConfInvoice: jest.fn(() => proposal.promise)
            });

            const pending = store.createUnifiedInvoice({
                ...params,
                value: '50000'
            });
            await flush();
            store.reset();
            seedNextScreen(store);
            store.lspStore.zeroConfFee = 3000;
            store.lspStore.feeId = 'next-quote';
            proposal.reject(undefined);

            await expect(pending).rejects.toThrow();
            expect(store.lspStore.zeroConfFee).toBe(3000);
            expect(store.lspStore.feeId).toBe('next-quote');
            expectNextScreenKept(store);
        });
    });
});
