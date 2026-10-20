jest.mock('../stores/Stores');
jest.mock('react-native-blob-util', () => ({ fetch: jest.fn() }));
jest.mock('../ldknode/LdkNodeInjection', () => ({}));
jest.mock('../utils/BackendUtils', () => ({
    __esModule: true,
    default: {
        decodePaymentRequest: jest.fn(),
        getNewAddress: jest.fn(),
        getNewChangeAddress: jest.fn(),
        isLNDBased: jest.fn(() => false),
        supportsFlowLSP: jest.fn(() => false),
        createInvoice: jest.fn(),
        lookupInvoice: jest.fn()
    }
}));
jest.mock('../utils/LocaleUtils');

import ReactNativeBlobUtil from 'react-native-blob-util';

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

// PaymentRequest renders pay_req and pays paymentRequest,
// so pay_req must never come from a stale decode
describe('InvoicesStore superseded decode requests', () => {
    let settle: {
        [request: string]: {
            resolve: (data: any) => void;
            reject: (error: Error) => void;
        };
    };

    beforeEach(() => {
        settle = {};
        (BackendUtils.decodePaymentRequest as jest.Mock).mockImplementation(
            ([request]: string[]) =>
                new Promise((resolve, reject) => {
                    settle[request] = { resolve, reject };
                })
        );
    });

    it('ignores a decode response that arrives after a newer getPayReq', async () => {
        const store = newStore();
        const first = store.getPayReq('lnbc-first');
        const second = store.getPayReq('lnbc-second');
        settle['lnbc-second'].resolve({ num_satoshis: '1000000' });
        settle['lnbc-first'].resolve({ num_satoshis: '10' });
        await Promise.all([first, second]);

        expect(store.paymentRequest).toBe('lnbc-second');
        expect(store.pay_req!.getPaymentRequest).toBe('lnbc-second');
        expect(store.pay_req!.getRequestAmount).toBe(1000000);
    });

    it('keeps the latest request when a repeated decode shares the earlier in-flight response', async () => {
        // restReq hands an identical request the promise already in flight,
        // so first, second, first is answered in the order first, second
        const pending: { [request: string]: Promise<any> } = {};
        (BackendUtils.decodePaymentRequest as jest.Mock).mockImplementation(
            ([request]: string[]) => {
                if (!pending[request]) {
                    pending[request] = new Promise((resolve, reject) => {
                        settle[request] = { resolve, reject };
                    });
                }
                return pending[request];
            }
        );

        const store = newStore();
        const calls = [
            store.getPayReq('lnbc-first'),
            store.getPayReq('lnbc-second'),
            store.getPayReq('lnbc-first')
        ];
        settle['lnbc-first'].resolve({ num_satoshis: '1000000' });
        settle['lnbc-second'].resolve({ num_satoshis: '10' });
        await Promise.all(calls);

        expect(store.paymentRequest).toBe('lnbc-first');
        expect(store.pay_req!.getPaymentRequest).toBe('lnbc-first');
        expect(store.pay_req!.getRequestAmount).toBe(1000000);
        expect(store.loading).toBe(false);
    });

    it('keeps a newer success when an older decode of the same string fails later', async () => {
        // backends without restReq de-duplication (embedded LND, LDK, LNC,
        // NWC) run each decode separately, e.g. Send decoding on input and
        // handleAnything decoding the same string again on submit
        const calls: Array<{
            resolve: (data: any) => void;
            reject: (error: Error) => void;
        }> = [];
        (BackendUtils.decodePaymentRequest as jest.Mock).mockImplementation(
            () =>
                new Promise((resolve, reject) => {
                    calls.push({ resolve, reject });
                })
        );

        const store = newStore();
        const first = store.getPayReq('lnbc-same');
        const second = store.getPayReq('lnbc-same');
        calls[1].resolve({ num_satoshis: '1000000' });
        calls[0].reject(new Error('decode failed'));
        await Promise.all([first, second]);

        expect(store.getPayReqError).toBeNull();
        expect(store.pay_req!.getPaymentRequest).toBe('lnbc-same');
        expect(store.pay_req!.getRequestAmount).toBe(1000000);
        expect(store.loading).toBe(false);
    });

    it('ignores a decode answer that arrives after reset', async () => {
        const store = newStore();
        const first = store.getPayReq('lnbc-first');
        store.reset();
        settle['lnbc-first'].resolve({ num_satoshis: '10' });
        await first;

        expect(store.paymentRequest).toBe('');
        expect(store.pay_req).toBeNull();
        expect(store.loading).toBe(false);
    });

    it('stays loading when only the superseded request has been answered', async () => {
        const store = newStore();
        const first = store.getPayReq('lnbc-first');
        store.getPayReq('lnbc-second');
        settle['lnbc-first'].resolve({ num_satoshis: '10' });
        await first;

        expect(store.pay_req).toBeNull();
        expect(store.loading).toBe(true);
    });

    it('ignores a decode error that arrives after a newer getPayReq', async () => {
        const store = newStore();
        const first = store.getPayReq('lnbc-first');
        const second = store.getPayReq('lnbc-second');
        settle['lnbc-second'].resolve({ num_satoshis: '1000000' });
        settle['lnbc-first'].reject(new Error('decode failed'));
        await Promise.all([first, second]);

        expect(store.getPayReqError).toBeNull();
        expect(store.pay_req!.getPaymentRequest).toBe('lnbc-second');
    });

    it('ignores a getWithdrawalReq outcome that arrives after a newer getPayReq', async () => {
        const store = newStore();
        const first = store.getWithdrawalReq('lnr-first');
        const second = store.getPayReq('lnbc-second');
        settle['lnbc-second'].resolve({ num_satoshis: '1000000' });
        settle['lnr-first'].reject(new Error('decode failed'));
        await Promise.all([first, second]);

        expect(store.getPayReqError).toBeNull();
        expect(store.pay_req!.getPaymentRequest).toBe('lnbc-second');
    });

    it('ignores a getPayReq response that arrives after a newer getWithdrawalReq', async () => {
        const store = newStore();
        const first = store.getPayReq('lnbc-first');
        const second = store.getWithdrawalReq('lnr-second');
        settle['lnr-second'].resolve({ invreq_amount_msat: 1000 });
        settle['lnbc-first'].resolve({ num_satoshis: '10' });
        await Promise.all([first, second]);

        expect(store.paymentRequest).toBe('lnr-second');
        expect(store.pay_req).toBeNull();
        expect(store.withdrawal_req).not.toBeNull();
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
            expect.objectContaining({ feeSats: 2000, feeId: 'quote-2000' })
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
            expect.objectContaining({ feeSats: 3000, feeId: 'quote-3000' })
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
            expect.objectContaining({ feeSats: 2000, feeId: 'quote-2000' })
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
                    expect.objectContaining({ feeSats: fee })
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
                expect.objectContaining({ feeSats: 2000, feeId: 'quote-2000' })
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
                    expect.objectContaining({ feeSats: 2000, feeId: 'fresh' })
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
                    expect.objectContaining({ feeSats: 500, feeId: 'fresh' })
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
                    expect.objectContaining({ feeSats: 0, feeId: 'fresh' })
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
                    expect.objectContaining({ feeId: 'fresh' })
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
