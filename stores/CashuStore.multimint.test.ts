jest.mock('./Stores');
jest.mock('./SettingsStore', () => ({
    DEFAULT_NOSTR_RELAYS: ['wss://relay.one']
}));
jest.mock('react-native-blob-util', () => ({}));
jest.mock('@nostr-dev-kit/ndk', () => ({
    __esModule: true,
    default: jest.fn()
}));
jest.mock('../utils/NostrUtils', () => ({}));
jest.mock('../utils/NostrMintBackup', () => ({}));
jest.mock('../utils/MigrationUtils', () => ({}));
jest.mock('../utils/ThemeUtils', () => ({}));
jest.mock('../utils/LocaleUtils');
jest.mock('../NavigationService', () => ({}));
jest.mock('../utils/Bolt11Utils', () => ({
    __esModule: true,
    default: { decode: jest.fn() }
}));
jest.mock('../cashu-cdk', () => ({
    __esModule: true,
    default: {
        isAvailable: jest.fn(() => true),
        addMint: jest.fn(),
        removeMint: jest.fn(),
        getMintUrls: jest.fn(),
        getBalances: jest.fn(),
        getTotalBalance: jest.fn(),
        createMeltQuote: jest.fn(),
        melt: jest.fn(),
        meltPartial: jest.fn(),
        restore: jest.fn(),
        listTransactions: jest.fn()
    }
}));
jest.mock('../storage', () => ({
    __esModule: true,
    default: { setItem: jest.fn(), getItem: jest.fn(), removeItem: jest.fn() },
    getRawItem: jest.fn(),
    removeRawItem: jest.fn(),
    KEY_PREFIX: 'zeus:'
}));

import CashuStore from './CashuStore';
import CashuDevKit from '../cashu-cdk';
import Storage from '../storage';
import Bolt11Utils from '../utils/Bolt11Utils';
import { MintPaymentStatus, MultinutPaymentStep } from '../utils/CashuUtils';
import * as LocaleUtils from '../utils/LocaleUtils';

const cdk = CashuDevKit as unknown as Record<string, jest.Mock>;
const storage = Storage as unknown as Record<string, jest.Mock>;
const decode = Bolt11Utils.decode as jest.Mock;

const A = 'https://a.mint';
const B = 'https://b.mint';
const C = 'https://c.mint';
const INVOICE = 'lnbc10u1multimint';
const PAYMENT_HASH = 'ab'.repeat(32);
const PREIMAGE = 'cd'.repeat(32);
const NUT15 = { nuts: { 15: [{ method: 'bolt11', unit: 'sat' }] } };

type MintReply =
    | { fee: number }
    | { status: number; body: string }
    | { networkError: true };

// Stands in for each mint's POST /v1/melt/quote/bolt11 (NUT-05 with the
// NUT-15 mpp option). `replies` maps a mint to a function of the requested
// sat amount, so a test can return different fees for the probe and a
// re-quote.
const mintApi = (
    replies: Record<string, (amountSats: number, call: number) => MintReply>
) => {
    const calls: { mintUrl: string; amountSats: number }[] = [];
    const fetchMock = jest.fn(async (url: string, init: any) => {
        const mintUrl = url.replace('/v1/melt/quote/bolt11', '');
        const body = JSON.parse(init.body);
        const amountSats = body.options.mpp.amount / 1000;
        const call = calls.filter((c) => c.mintUrl === mintUrl).length;
        calls.push({ mintUrl, amountSats });
        const reply = replies[mintUrl](amountSats, call);
        if ('networkError' in reply) throw new Error('network down');
        if ('status' in reply) {
            return {
                ok: false,
                status: reply.status,
                text: async () => reply.body
            };
        }
        return {
            ok: true,
            status: 200,
            json: async () => ({
                quote: `mpp-${mintUrl}-${amountSats}`,
                amount: amountSats,
                fee_reserve: reply.fee,
                state: 'UNPAID',
                expiry: 9999999999
            })
        };
    });
    (global as any).fetch = fetchMock;
    return { calls, fetchMock };
};

const newStore = ({
    balances,
    selected,
    mpp = [A, B, C],
    enableMultiMint = true
}: {
    balances: Record<string, number>;
    selected: string[];
    mpp?: string[];
    enableMultiMint?: boolean;
}) => {
    const modalStore = { checkAndTriggerRatingModal: jest.fn() };
    const store = new CashuStore(
        {
            implementation: 'lnd',
            lndDir: 'node1',
            settings: { ecash: { enableMultiMint } }
        } as any,
        {} as any,
        {} as any,
        modalStore as any
    );
    const mints = Object.keys(balances);
    store.cdkInitialized = true;
    store.mintUrls = mints;
    store.selectedMintUrl = mints[0];
    store.cashuWallets = Object.fromEntries(
        mints.map((m) => [
            m,
            { walletId: m, pubkey: '', errorConnecting: false }
        ])
    );
    store.mintInfos = Object.fromEntries(
        mints.map((m) => [
            m,
            {
                name: `Mint ${m.slice(8, 9).toUpperCase()}`,
                ...(mpp.includes(m) ? NUT15 : {})
            }
        ])
    ) as any;
    store.mintBalances = { ...balances };
    store.multiMintSelectedUrls = selected;
    store.payments = [];
    cdk.getBalances.mockResolvedValue({ ...balances });
    cdk.getTotalBalance.mockResolvedValue(
        Object.values(balances).reduce((s, b) => s + b, 0)
    );
    return store;
};

const invoiceFor = (fields: Record<string, any>) =>
    decode.mockReturnValue({
        payment_hash: PAYMENT_HASH,
        timestamp: Math.floor(Date.now() / 1000) - 10,
        expiry: 3600,
        ...fields
    });

const planOf = (store: CashuStore) =>
    store.meltQuotes.map(({ mintUrl, meltQuote, useRegularMelt }) => ({
        mintUrl,
        amount: meltQuote.amount,
        fee: meltQuote.fee_reserve,
        ...(useRegularMelt ? { regular: true } : {})
    }));

const flush = () => new Promise((resolve) => setImmediate(resolve));

// The shared LocaleUtils mock drops interpolation arguments, so spy on it
// to check the mint names and amounts passed to the error messages
let localeString: jest.SpyInstance;

beforeEach(() => {
    jest.clearAllMocks();
    localeString = jest.spyOn(LocaleUtils, 'localeString');
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    cdk.addMint.mockResolvedValue(undefined);
    cdk.restore.mockResolvedValue(0);
    cdk.listTransactions.mockResolvedValue([]);
    cdk.createMeltQuote.mockImplementation(async (mintUrl: string) => ({
        id: `regular-${mintUrl}`,
        amount: 1000,
        fee_reserve: 3,
        state: 'UNPAID',
        expiry: 9999999999,
        unit: 'sat',
        request: INVOICE
    }));
    storage.setItem.mockResolvedValue(true);
    storage.removeItem.mockResolvedValue(true);
    invoiceFor({ num_satoshis: '1000' });
});

afterEach(() => {
    jest.restoreAllMocks();
    delete (global as any).fetch;
});

describe('CashuStore multi-mint planning (getPayReq)', () => {
    it('splits an invoice no single mint can cover in proportion to usable balance', async () => {
        const store = newStore({
            balances: { [A]: 600, [B]: 500 },
            selected: [A, B]
        });
        const { calls } = mintApi({
            [A]: () => ({ fee: 1 }),
            [B]: () => ({ fee: 1 })
        });

        await store.getPayReq(INVOICE);

        // usable A 599, B 499 (balance minus probe fee), total 1098.
        // A's share is ceil(1000 * 599 / 1098) = 546; B covers the other 454.
        expect(planOf(store)).toEqual([
            { mintUrl: A, amount: 546, fee: 1 },
            { mintUrl: B, amount: 454, fee: 1 }
        ]);
        expect(store.getPayReqError).toBeUndefined();
        expect(store.feeEstimate).toBe(2);
        expect(store.loading).toBe(false);
        // Each mint is probed at min(balance, amount), then re-quoted for
        // its share. The mpp amount goes over the wire in msat.
        expect(calls).toEqual([
            { mintUrl: A, amountSats: 600 },
            { mintUrl: B, amountSats: 500 },
            { mintUrl: A, amountSats: 546 },
            { mintUrl: B, amountSats: 454 }
        ]);
        expect(
            JSON.parse((global as any).fetch.mock.calls[0][1].body).options
        ).toEqual({ mpp: { amount: 600000 } });
    });

    it('splits across three mints with rounding that still sums to the invoice', async () => {
        const store = newStore({
            balances: { [A]: 400, [B]: 400, [C]: 400 },
            selected: [A, B, C]
        });
        mintApi({
            [A]: () => ({ fee: 0 }),
            [B]: () => ({ fee: 0 }),
            [C]: () => ({ fee: 0 })
        });

        await store.getPayReq(INVOICE);

        // ceil(1000 / 3) = 334 for the first two, the last takes the rest
        expect(planOf(store)).toEqual([
            { mintUrl: A, amount: 334, fee: 0 },
            { mintUrl: B, amount: 334, fee: 0 },
            { mintUrl: C, amount: 332, fee: 0 }
        ]);
        expect(store.getPayReqError).toBeUndefined();
    });

    it('stops probing once one mint covers the invoice, so the others never see it', async () => {
        const store = newStore({
            balances: { [A]: 500, [B]: 5000 },
            selected: [A, B]
        });
        const { calls } = mintApi({
            [A]: () => ({ fee: 2 }),
            [B]: () => ({ fee: 2 })
        });

        await store.getPayReq(INVOICE);

        expect(calls).toEqual([{ mintUrl: B, amountSats: 1000 }]);
        expect(planOf(store)).toEqual([{ mintUrl: B, amount: 1000, fee: 2 }]);
        expect(store.feeEstimate).toBe(2);
    });

    it('uses a regular melt quote when only one selected mint has funds', async () => {
        const store = newStore({
            balances: { [A]: 2000, [B]: 0 },
            selected: [A, B]
        });
        const { fetchMock } = mintApi({});

        await store.getPayReq(INVOICE);

        expect(fetchMock).not.toHaveBeenCalled();
        expect(cdk.createMeltQuote).toHaveBeenCalledWith(A, INVOICE, undefined);
        expect(planOf(store)).toEqual([
            { mintUrl: A, amount: 1000, fee: 3, regular: true }
        ]);
        expect(store.meltQuotes[0].meltQuote.id).toBe(`regular-${A}`);
        expect(store.getPayReqError).toBeUndefined();
    });

    it('reports not enough funds when the only funded mint cannot cover amount plus fee', async () => {
        const store = newStore({
            balances: { [A]: 1002, [B]: 0 },
            selected: [A, B]
        });
        mintApi({});

        await store.getPayReq(INVOICE);

        // 1000 + 3 fee reserve > 1002
        expect(store.meltQuotes).toEqual([]);
        expect(store.getPayReqError).toBe('stores.CashuStore.notEnoughFunds');
    });

    it('reports not enough funds and keeps the partial plan when the mints fall short', async () => {
        const store = newStore({
            balances: { [A]: 300, [B]: 0, [C]: 200 },
            selected: [A, B, C]
        });
        mintApi({
            [A]: () => ({ fee: 0 }),
            [C]: () => ({ fee: 0 })
        });

        await store.getPayReq(INVOICE);

        expect(planOf(store)).toEqual([
            { mintUrl: A, amount: 300, fee: 0 },
            { mintUrl: C, amount: 200, fee: 0 }
        ]);
        expect(store.multiMintPlannerSkips).toEqual([
            { mintUrl: B, reason: 'noBalance' }
        ]);
        expect(store.getPayReqError).toBe('stores.CashuStore.notEnoughFunds');
    });

    it('skips mints that are unreachable, reject MPP, or whose fee eats the balance', async () => {
        const store = newStore({
            balances: { [A]: 900, [B]: 800, [C]: 5, 'https://d.mint': 700 },
            selected: [A, B, C, 'https://d.mint'],
            mpp: [A, B, C, 'https://d.mint']
        });
        mintApi({
            [A]: () => ({ networkError: true }),
            [B]: () => ({ status: 400, body: 'mpp not supported' }),
            [C]: () => ({ fee: 5 }),
            'https://d.mint': () => ({ fee: 1 })
        });

        await store.getPayReq(INVOICE);

        expect(store.multiMintPlannerSkips).toEqual([
            { mintUrl: A, reason: 'networkError' },
            { mintUrl: B, reason: 'mppRejected' },
            { mintUrl: C, reason: 'feeOverBalance' }
        ]);
        // D can spend its balance less the fee: 699 of 700
        expect(planOf(store)).toEqual([
            { mintUrl: 'https://d.mint', amount: 699, fee: 1 }
        ]);
        expect(store.getPayReqError).toBe('stores.CashuStore.notEnoughFunds');
    });

    it('falls back to a regular melt on the invoice mint when it refuses MPP for its own invoice', async () => {
        const store = newStore({
            balances: { [A]: 5000, [B]: 300 },
            selected: [A, B]
        });
        mintApi({
            [A]: () => ({ status: 400, body: 'internal mpp not allowed' }),
            [B]: () => ({ fee: 0 })
        });

        await store.getPayReq(INVOICE);

        expect(store.multiMintPlannerSkips).toEqual([
            { mintUrl: A, reason: 'selfSend' }
        ]);
        expect(planOf(store)).toEqual([
            { mintUrl: A, amount: 1000, fee: 3, regular: true }
        ]);
        expect(store.getPayReqError).toBeUndefined();
    });

    it('names the invoice mint when it refuses MPP and the others fall short', async () => {
        const store = newStore({
            balances: { [A]: 600, [B]: 300 },
            selected: [A, B]
        });
        mintApi({
            [A]: () => ({
                status: 400,
                body: 'Multi-Part Internal Melt Quotes are not supported'
            }),
            [B]: () => ({ fee: 0 })
        });

        await store.getPayReq(INVOICE);

        expect(store.multiMintPlannerSkips).toEqual([
            { mintUrl: A, reason: 'selfSend' }
        ]);
        expect(store.getPayReqError).toBe(
            'stores.CashuStore.notEnoughFundsSelfSend'
        );
        expect(localeString).toHaveBeenCalledWith(
            'stores.CashuStore.notEnoughFundsSelfSend',
            { mintName: 'Mint A' }
        );
        expect(cdk.createMeltQuote).not.toHaveBeenCalled();
    });

    it('shrinks a share when the re-quoted fee would overdraw the mint', async () => {
        const store = newStore({
            balances: { [A]: 600, [B]: 500 },
            selected: [A, B]
        });
        const { calls } = mintApi({
            // probe fee 1, but the re-quote for A's share comes back at 60
            [A]: (_amt, call) => ({ fee: call === 0 ? 1 : 60 }),
            [B]: () => ({ fee: 1 })
        });

        await store.getPayReq(INVOICE);

        // A's share 546 + 60 > 600, so it is re-quoted at 600 - 60 = 540
        // and B takes the remaining 460.
        expect(calls.filter((c) => c.mintUrl === A)).toEqual([
            { mintUrl: A, amountSats: 600 },
            { mintUrl: A, amountSats: 546 },
            { mintUrl: A, amountSats: 540 }
        ]);
        expect(planOf(store)).toEqual([
            { mintUrl: A, amount: 540, fee: 60 },
            { mintUrl: B, amount: 460, fee: 1 }
        ]);
        expect(store.feeEstimate).toBe(61);
        expect(store.getPayReqError).toBeUndefined();
    });

    it('rejects an invoice amount that is not a whole number of sats', async () => {
        const store = newStore({
            balances: { [A]: 600, [B]: 500 },
            selected: [A, B]
        });
        const { fetchMock } = mintApi({});
        invoiceFor({ millisatoshis: '1000500' });

        await store.getPayReq(INVOICE);

        expect(fetchMock).not.toHaveBeenCalled();
        expect(store.meltQuotes).toEqual([]);
        expect(store.getPayReqError).toBe(
            'stores.CashuStore.invalidMultimintPaymentAmount'
        );
    });

    it('does not send an expired invoice to any mint', async () => {
        const store = newStore({
            balances: { [A]: 600, [B]: 500 },
            selected: [A, B]
        });
        const { fetchMock } = mintApi({});
        invoiceFor({
            num_satoshis: '1000',
            timestamp: Math.floor(Date.now() / 1000) - 7200
        });

        await store.getPayReq(INVOICE);

        expect(fetchMock).not.toHaveBeenCalled();
        expect(cdk.createMeltQuote).not.toHaveBeenCalled();
        expect(store.meltQuotes).toEqual([]);
    });

    it('quotes the single selected mint, not the receive mint, when one mint is selected', async () => {
        const store = newStore({
            balances: { [A]: 100, [B]: 5000 },
            selected: [B]
        });
        const { fetchMock } = mintApi({});

        await store.getPayReq(INVOICE);

        expect(fetchMock).not.toHaveBeenCalled();
        expect(cdk.createMeltQuote).toHaveBeenCalledWith(B, INVOICE, undefined);
        expect(store.meltQuote?.quote).toBe(`regular-${B}`);
        expect(store.meltQuotes).toEqual([]);
        expect(store.getPayReqError).toBeUndefined();
    });

    it('ignores the multi-mint selection when multi-mint is turned off', async () => {
        const store = newStore({
            balances: { [A]: 100, [B]: 5000 },
            selected: [A, B],
            enableMultiMint: false
        });
        const { fetchMock } = mintApi({});

        await store.getPayReq(INVOICE);

        expect(fetchMock).not.toHaveBeenCalled();
        expect(cdk.createMeltQuote).toHaveBeenCalledWith(A, INVOICE, undefined);
        // the receive mint holds 100 sats, so the payment cannot go ahead
        expect(store.getPayReqError).toBe('stores.CashuStore.notEnoughFunds');
    });

    it('currently gives up without the single-mint fallback when no selected mint advertises MPP', async () => {
        const store = newStore({
            balances: { [A]: 5000, [B]: 300 },
            selected: [A, B],
            mpp: []
        });
        const { fetchMock } = mintApi({});

        await store.getPayReq(INVOICE);

        // A alone could pay with a regular melt (that is what the planner
        // does when A is the only funded mint), but with no MPP candidates
        // it returns before reaching the fallback.
        expect(fetchMock).not.toHaveBeenCalled();
        expect(cdk.createMeltQuote).not.toHaveBeenCalled();
        expect(store.meltQuotes).toEqual([]);
        expect(store.getPayReqError).toBe('stores.CashuStore.notEnoughFunds');
    });

    it('currently gives up without the fallback when the invoice mint refuses MPP and no other mint can probe', async () => {
        const store = newStore({
            balances: { [A]: 5000, [B]: 300 },
            selected: [A, B],
            mpp: [A]
        });
        mintApi({
            [A]: () => ({ status: 400, body: 'internal mpp not allowed' })
        });

        await store.getPayReq(INVOICE);

        // Same invoice and balances as the fallback test above, except B
        // does not advertise NUT-15. A could still pay alone.
        expect(cdk.createMeltQuote).not.toHaveBeenCalled();
        expect(store.getPayReqError).toBe(
            'stores.CashuStore.notEnoughFundsSelfSend'
        );
    });

    it('currently leaves unprobed mints out when a probed mint fails its re-quote', async () => {
        const store = newStore({
            balances: { [A]: 600, [B]: 500, [C]: 500 },
            selected: [A, B, C]
        });
        const { calls } = mintApi({
            [A]: (_amt, call) =>
                call === 0 ? { fee: 0 } : { status: 500, body: 'busy' },
            [B]: () => ({ fee: 0 }),
            [C]: () => ({ fee: 0 })
        });

        await store.getPayReq(INVOICE);

        // A and B covered the invoice at probe time, so C was never asked.
        // When A's re-quote fails, B keeps its proportional share
        // (ceil(1000 * 500 / 1100) = 455) and C is not tried, although
        // B and C together hold 1000.
        expect(calls.some((c) => c.mintUrl === C)).toBe(false);
        // The requoteFailed skip is pushed after the skip list was
        // published, so it never reaches multiMintPlannerSkips
        expect(store.multiMintPlannerSkips).toEqual([]);
        expect(planOf(store)).toEqual([{ mintUrl: B, amount: 455, fee: 0 }]);
        expect(store.getPayReqError).toBe('stores.CashuStore.notEnoughFunds');
    });
});

describe('CashuStore multi-mint payment (payLnInvoiceFromEcash)', () => {
    const plannedStore = async (
        balances: Record<string, number> = { [A]: 600, [B]: 500 }
    ) => {
        const store = newStore({ balances, selected: Object.keys(balances) });
        mintApi(
            Object.fromEntries(
                Object.keys(balances).map((m) => [m, () => ({ fee: 1 })])
            )
        );
        await store.getPayReq(INVOICE);
        expect(store.getPayReqError).toBeUndefined();
        return store;
    };

    const paid = (amount: number, fee: number, preimage = PREIMAGE) => ({
        state: 'PAID',
        preimage,
        amount,
        fee_paid: fee,
        change: []
    });

    it('melts each part, records it, and reports the combined fee', async () => {
        const store = await plannedStore();
        cdk.meltPartial.mockImplementation(
            async (mintUrl: string, _inv: string, amountMsat: number) =>
                mintUrl === A
                    ? paid(amountMsat / 1000, 1)
                    : paid(amountMsat / 1000, 2, '')
        );
        const onProgress = jest.fn();

        const result = await store.payLnInvoiceFromEcash({
            paymentRequest: INVOICE,
            onProgress
        });

        expect(cdk.meltPartial).toHaveBeenCalledWith(A, INVOICE, 546000);
        expect(cdk.meltPartial).toHaveBeenCalledWith(B, INVOICE, 454000);
        expect(cdk.melt).not.toHaveBeenCalled();
        expect(store.paymentSuccess).toBe(true);
        expect(store.paymentError).toBe(false);
        expect(store.paymentPreimage).toBe(PREIMAGE);
        expect(store.paymentFee).toBe(3);
        expect(store.noteKey).toBe(`note-${PAYMENT_HASH}`);
        // one payment entry per mint, each with its own share
        expect(
            store.payments!.map((p) => [p.mintUrl, p.amount, p.fee])
        ).toEqual([
            [A, 546, 1],
            [B, 454, 2]
        ]);
        expect(result).toBe(store.payments![0]);
        expect(storage.setItem).toHaveBeenCalledWith(
            'node1-cashu-payments',
            store.payments
        );

        const steps = onProgress.mock.calls.map(([p]) => p.step);
        expect(steps[0]).toBe(MultinutPaymentStep.PROCESSING);
        expect(steps[steps.length - 1]).toBe(MultinutPaymentStep.COMPLETE);
        const final = onProgress.mock.calls[steps.length - 1][0];
        expect(final.mints.map((m: any) => [m.mintUrl, m.status])).toEqual([
            [A, MintPaymentStatus.SUCCESS],
            [B, MintPaymentStatus.SUCCESS]
        ]);
        expect(final.totalSelectedBalance).toBe(1100);

        // after reporting success, each mint is restored and balances synced
        await flush();
        expect(cdk.restore).toHaveBeenCalledWith(A);
        expect(cdk.restore).toHaveBeenCalledWith(B);
        expect(cdk.getBalances).toHaveBeenCalled();
        expect(cdk.listTransactions).toHaveBeenCalled();
    });

    it('counts a part that paid no fee', async () => {
        const store = await plannedStore();
        cdk.meltPartial.mockImplementation(
            async (mintUrl: string, _inv: string, amountMsat: number) =>
                paid(amountMsat / 1000, mintUrl === A ? 0 : 2)
        );

        await store.payLnInvoiceFromEcash({ paymentRequest: INVOICE });

        expect(store.paymentFee).toBe(2);
        expect(store.payments!.map((p) => p.fee)).toEqual([0, 2]);
    });

    it('melts a regular-quote plan with its quote id instead of meltPartial', async () => {
        const store = newStore({
            balances: { [A]: 2000, [B]: 0 },
            selected: [A, B]
        });
        mintApi({});
        await store.getPayReq(INVOICE);
        cdk.melt.mockResolvedValue(paid(1000, 2));

        await store.payLnInvoiceFromEcash({ paymentRequest: INVOICE });

        expect(cdk.melt).toHaveBeenCalledWith(A, `regular-${A}`);
        expect(cdk.meltPartial).not.toHaveBeenCalled();
        expect(store.paymentSuccess).toBe(true);
        expect(store.paymentFee).toBe(2);
        expect(store.payments!.map((p) => p.meltResponse.quote!.quote)).toEqual(
            [`regular-${A}`]
        );
    });

    it('reports success when one part is paid and another fails, recording only the paid part', async () => {
        const store = await plannedStore();
        cdk.meltPartial.mockImplementation(async (mintUrl: string) => {
            if (mintUrl === B) throw new Error('mint B timed out');
            return paid(546, 1);
        });
        const onProgress = jest.fn();

        await store.payLnInvoiceFromEcash({
            paymentRequest: INVOICE,
            onProgress
        });

        // A Paid part means the payee released the preimage, so the invoice
        // is paid. The history entry only carries A's 546 sats.
        expect(store.paymentSuccess).toBe(true);
        expect(store.paymentPreimage).toBe(PREIMAGE);
        expect(store.payments!.map((p) => [p.mintUrl, p.amount])).toEqual([
            [A, 546]
        ]);
        const final = onProgress.mock.calls.at(-1)[0];
        expect(final.step).toBe(MultinutPaymentStep.COMPLETE);
        expect(
            final.mints.map((m: any) => [m.mintUrl, m.status, m.error])
        ).toEqual([
            [A, MintPaymentStatus.SUCCESS, undefined],
            [B, MintPaymentStatus.FAILED, 'mint B timed out']
        ]);
    });

    it('reports the first failure and records nothing when every part fails', async () => {
        const store = await plannedStore();
        cdk.meltPartial.mockImplementation(async (mintUrl: string) => {
            throw new Error(`${mintUrl} refused`);
        });
        const onProgress = jest.fn();

        const result = await store.payLnInvoiceFromEcash({
            paymentRequest: INVOICE,
            onProgress
        });

        expect(result).toBeUndefined();
        expect(store.paymentSuccess).toBe(false);
        expect(store.paymentError).toBe(true);
        expect(store.paymentErrorMsg).toBe(`${A} refused`);
        expect(store.payments).toEqual([]);
        expect(storage.setItem).not.toHaveBeenCalledWith(
            'node1-cashu-payments',
            expect.anything()
        );
        expect(onProgress.mock.calls.at(-1)[0].step).toBe(
            MultinutPaymentStep.FAILED
        );
        await flush();
        expect(cdk.restore).not.toHaveBeenCalled();
    });

    it('treats a part the mint has not settled as failed', async () => {
        const store = await plannedStore();
        cdk.meltPartial.mockResolvedValue({
            state: 'PENDING',
            amount: 0,
            fee_paid: 0
        });

        await store.payLnInvoiceFromEcash({ paymentRequest: INVOICE });

        expect(store.paymentSuccess).toBe(false);
        expect(store.paymentError).toBe(true);
        expect(store.paymentErrorMsg).toBe(
            'stores.CashuStore.errorPayingInvoice'
        );
        expect(store.payments).toEqual([]);
    });

    it('turns a melt fee mismatch into a message naming the mint', async () => {
        const store = await plannedStore();
        cdk.meltPartial.mockImplementation(async (mintUrl: string) => {
            throw new Error(
                mintUrl === A
                    ? 'Not enough inputs provided for melt. Provided: 546, needed: 550'
                    : 'mint B refused'
            );
        });
        const onProgress = jest.fn();

        await store.payLnInvoiceFromEcash({
            paymentRequest: INVOICE,
            onProgress
        });

        expect(store.paymentErrorMsg).toBe('stores.CashuStore.meltFeeMismatch');
        expect(localeString).toHaveBeenCalledWith(
            'stores.CashuStore.meltFeeMismatch',
            { mintName: 'Mint A', provided: '546', needed: '550' }
        );
        expect(
            onProgress.mock.calls.at(-1)[0].mints.map((m: any) => m.error)
        ).toEqual(['stores.CashuStore.meltFeeMismatch', 'mint B refused']);
    });

    it('refuses to melt when the plan does not cover the invoice', async () => {
        const store = newStore({
            balances: { [A]: 300, [C]: 200 },
            selected: [A, C]
        });
        mintApi({ [A]: () => ({ fee: 0 }), [C]: () => ({ fee: 0 }) });
        await store.getPayReq(INVOICE);
        expect(store.meltQuotes).toHaveLength(2);
        const onProgress = jest.fn();

        await store.payLnInvoiceFromEcash({
            paymentRequest: INVOICE,
            onProgress
        });

        expect(cdk.meltPartial).not.toHaveBeenCalled();
        expect(store.paymentError).toBe(true);
        expect(store.paymentErrorMsg).toBe('stores.CashuStore.notEnoughFunds');
        expect(onProgress).toHaveBeenCalledWith(
            expect.objectContaining({ step: MultinutPaymentStep.FAILED })
        );
    });

    it('refuses to melt with no plan and names the invoice mint if it was skipped', async () => {
        const store = newStore({
            balances: { [A]: 600, [B]: 300 },
            selected: [A, B]
        });
        store.paymentRequest = INVOICE;
        store.multiMintPlannerSkips = [{ mintUrl: A, reason: 'selfSend' }];

        await store.payLnInvoiceFromEcash({
            paymentRequest: INVOICE,
            amount: '1000'
        });

        expect(cdk.meltPartial).not.toHaveBeenCalled();
        expect(store.paymentErrorMsg).toBe(
            'stores.CashuStore.notEnoughFundsSelfSend'
        );
        expect(localeString).toHaveBeenCalledWith(
            'stores.CashuStore.notEnoughFundsSelfSend',
            { mintName: 'Mint A' }
        );
    });

    it('does not set an error when a donation has no plan', async () => {
        const store = newStore({
            balances: { [A]: 600, [B]: 300 },
            selected: [A, B]
        });
        store.paymentRequest = INVOICE;

        await store.payLnInvoiceFromEcash({
            paymentRequest: INVOICE,
            amount: '1000',
            isDonationPayment: true
        });

        expect(cdk.meltPartial).not.toHaveBeenCalled();
        expect(store.paymentError).toBeUndefined();
        expect(store.paymentErrorMsg).toBeUndefined();
    });

    it('currently sets the payment error when every part of a donation fails', async () => {
        const store = await plannedStore();
        // the main payment already succeeded on this screen
        store.paymentSuccess = true;
        cdk.meltPartial.mockRejectedValue(new Error('refused'));

        await store.payLnInvoiceFromEcash({
            paymentRequest: INVOICE,
            isDonationPayment: true
        });

        // The other failure branches skip the store error for donations;
        // this one does not, so the store reports success and an error
        expect(store.paymentSuccess).toBe(true);
        expect(store.paymentError).toBe(true);
        expect(store.paymentErrorMsg).toBe('refused');
    });

    it('currently treats a part with no melt state as paid', async () => {
        const store = await plannedStore();
        // MPP quotes from the mint arrive with state UNPAID, so blank both
        cdk.meltPartial.mockResolvedValue({ amount: 0, fee_paid: 0 });
        store.meltQuotes = store.meltQuotes.map((q) => ({
            ...q,
            meltQuote: { ...q.meltQuote, state: '' as any }
        }));

        await store.payLnInvoiceFromEcash({ paymentRequest: INVOICE });

        // #4696 changes this: an absent state is not Paid
        expect(store.paymentSuccess).toBe(true);
        expect(store.payments).toHaveLength(2);
    });

    it('currently records MPP parts without their quote id', async () => {
        const store = await plannedStore();
        cdk.meltPartial.mockImplementation(
            async (_m: string, _i: string, msat: number) => paid(msat / 1000, 0)
        );

        await store.payLnInvoiceFromEcash({ paymentRequest: INVOICE });

        // The planner keeps the mint's JSON reply, which names the quote
        // `quote` (NUT-05), while the executor reads `id`.
        expect(store.meltQuotes[0].meltQuote).toMatchObject({
            quote: `mpp-${A}-546`
        });
        expect(store.payments!.map((p) => p.meltResponse.quote!.quote)).toEqual(
            [undefined, undefined]
        );
    });
});

describe('CashuStore multi-mint selection', () => {
    it('dedupes and persists the selection, promoting a lone mint to the receive mint', async () => {
        const store = newStore({
            balances: { [A]: 1, [B]: 1 },
            selected: []
        });

        await store.setMultiMintSelectedUrls([B, B]);

        expect(store.multiMintSelectedUrls).toEqual([B]);
        expect(store.selectedMintUrl).toBe(B);
        expect(storage.setItem).toHaveBeenCalledWith(
            'node1-cashu-multiMintSelectedUrls',
            JSON.stringify([B])
        );
        expect(storage.setItem).toHaveBeenCalledWith(
            'node1-cashu-selectedMintUrl',
            B
        );

        storage.setItem.mockClear();
        await store.setMultiMintSelectedUrls([A, B]);
        expect(store.multiMintSelectedUrls).toEqual([A, B]);
        // two mints selected: the receive mint is left alone
        expect(store.selectedMintUrl).toBe(B);
        expect(storage.setItem).toHaveBeenCalledTimes(1);
    });

    it('toggles mints in and out but never deselects the last one', async () => {
        const store = newStore({
            balances: { [A]: 1, [B]: 1 },
            selected: [A]
        });

        await store.toggleMultiMintSelection(B);
        expect(store.multiMintSelectedUrls).toEqual([A, B]);

        await store.toggleMultiMintSelection(A);
        expect(store.multiMintSelectedUrls).toEqual([B]);

        storage.setItem.mockClear();
        await store.toggleMultiMintSelection(B);
        expect(store.multiMintSelectedUrls).toEqual([B]);
        expect(storage.setItem).not.toHaveBeenCalled();
    });

    it('describes the planned mints, or the selection before a plan exists', async () => {
        const store = newStore({
            balances: { [A]: 600, [B]: 500, [C]: 50 },
            selected: [`${A}/`, B]
        });

        expect(
            store
                .getMultimintInfo()
                .map((m) => [m.mintUrl, m.balance, m.selected])
        ).toEqual([
            [A, 600, true],
            [B, 500, true]
        ]);

        store.meltQuotes = [{ mintUrl: C, meltQuote: { amount: 50 } as any }];
        expect(store.getMultimintInfo()).toEqual([
            {
                mintUrl: C,
                mintName: 'Mint C',
                balance: 50,
                selected: false,
                status: MintPaymentStatus.IDLE,
                allocatedAmount: 0
            }
        ]);
    });

    it('replaces per-mint balances on sync, dropping mints CDK no longer reports', async () => {
        const store = newStore({
            balances: { [A]: 600, [B]: 500 },
            selected: [A, B]
        });
        cdk.getBalances.mockResolvedValue({ [A]: 650 });
        cdk.getTotalBalance.mockResolvedValue(650);

        await store.syncCDKBalances();

        expect(store.mintBalances).toEqual({ [A]: 650 });
        expect(store.totalBalanceSats).toBe(650);
    });

    it('keeps the old balances when the sync fails', async () => {
        const store = newStore({
            balances: { [A]: 600, [B]: 500 },
            selected: [A, B]
        });
        cdk.getBalances.mockRejectedValue(new Error('db locked'));

        await store.syncCDKBalances();

        expect(store.mintBalances).toEqual({ [A]: 600, [B]: 500 });
    });
});

describe('CashuStore removeMint with several mints', () => {
    it('drops the mint from every selection and moves the receive mint', async () => {
        const store = newStore({
            balances: { [A]: 600, [B]: 500, [C]: 50 },
            selected: [`${A}/`, B, C]
        });
        store.selectedMintUrls = [A, C];
        cdk.removeMint.mockResolvedValue(undefined);
        cdk.getMintUrls.mockResolvedValue([B, C]);

        await store.removeMint(A);

        expect(cdk.removeMint).toHaveBeenCalledWith(A);
        expect(store.mintUrls).toEqual([B, C]);
        expect(store.cashuWallets[A]).toBeUndefined();
        expect(store.selectedMintUrl).toBe(B);
        expect(store.selectedMintUrls).toEqual([C]);
        // the selection held A with a trailing slash; it is still removed
        expect(store.multiMintSelectedUrls).toEqual([B, C]);
        expect(storage.setItem).toHaveBeenCalledWith(
            'node1-cashu-multiMintSelectedUrls',
            JSON.stringify([B, C])
        );
        expect(storage.setItem).toHaveBeenCalledWith(
            'node1-cashu-selectedMintUrls',
            JSON.stringify([C])
        );
        expect(storage.setItem).toHaveBeenCalledWith(
            'node1-cashu-selectedMintUrl',
            B
        );
        expect(storage.removeItem).toHaveBeenCalledWith(`node1==${A}-proofs`);
        expect(store.loading).toBe(false);
    });

    it('re-adds a removed mint to CDK before using it again', async () => {
        const store = newStore({
            balances: { [A]: 2000, [B]: 0 },
            selected: [A, B]
        });
        mintApi({});
        await store.getPayReq(INVOICE);
        expect(cdk.addMint).toHaveBeenCalledTimes(1);

        cdk.removeMint.mockResolvedValue(undefined);
        cdk.getMintUrls.mockResolvedValue([B]);
        await store.removeMint(A);

        cdk.addMint.mockClear();
        store.multiMintSelectedUrls = [A, B];
        store.mintUrls = [A, B];
        store.selectedMintUrl = B;
        await store.getPayReq(INVOICE);

        expect(cdk.addMint).toHaveBeenCalledWith(A);
    });

    it('leaves every selection alone when CDK refuses the removal', async () => {
        const store = newStore({
            balances: { [A]: 600, [B]: 500 },
            selected: [A, B]
        });
        cdk.removeMint.mockRejectedValue(new Error('mint has pending proofs'));

        await expect(store.removeMint(A)).rejects.toThrow(
            'mint has pending proofs'
        );

        expect(store.mintUrls).toEqual([A, B]);
        expect(store.multiMintSelectedUrls).toEqual([A, B]);
        expect(store.selectedMintUrl).toBe(A);
        expect(store.loading).toBe(false);
        expect(storage.setItem).not.toHaveBeenCalled();
    });
});

describe('CashuStore payReqMintBalance and payReqAmount', () => {
    const singleMintStore = () =>
        newStore({
            balances: { [A]: 1200 },
            selected: [A],
            enableMultiMint: false
        });

    it('sets the mint balance and the quote amount for a single mint', async () => {
        const store = singleMintStore();

        await store.getPayReq(INVOICE);

        // the quote is 1000 + 3 fee reserve
        expect(cdk.createMeltQuote).toHaveBeenCalledWith(A, INVOICE, undefined);
        expect(store.getPayReqError).toBeUndefined();
        expect(store.payReqMintBalance).toBe(1200);
        expect(store.payReqAmount).toBe(1000);
    });

    it('leaves both at 0 when the invoice is split across two mints', async () => {
        const store = newStore({
            balances: { [A]: 600, [B]: 500 },
            selected: [A, B]
        });
        mintApi({
            [A]: () => ({ fee: 1 }),
            [B]: () => ({ fee: 1 })
        });

        await store.getPayReq(INVOICE);

        expect(planOf(store).map(({ mintUrl }) => mintUrl)).toEqual([A, B]);
        expect(store.getPayReqError).toBeUndefined();
        expect(store.payReqMintBalance).toBe(0);
        expect(store.payReqAmount).toBe(0);
    });

    it('resets both when a good invoice is followed by an expired one', async () => {
        const store = singleMintStore();
        await store.getPayReq(INVOICE);
        expect(store.payReqMintBalance).toBe(1200);
        expect(store.payReqAmount).toBe(1000);

        invoiceFor({
            num_satoshis: '1000',
            timestamp: Math.floor(Date.now() / 1000) - 7200
        });
        cdk.createMeltQuote.mockClear();
        await store.getPayReq(INVOICE);

        // an expired invoice returns before any melt quote is requested
        expect(cdk.createMeltQuote).not.toHaveBeenCalled();
        expect(store.payReqMintBalance).toBe(0);
        expect(store.payReqAmount).toBe(0);
    });

    it('resets both and sets the error when the melt quote request fails', async () => {
        const store = singleMintStore();
        await store.getPayReq(INVOICE);
        expect(store.payReqMintBalance).toBe(1200);
        expect(store.payReqAmount).toBe(1000);

        cdk.createMeltQuote.mockRejectedValueOnce(new Error('mint offline'));
        await store.getPayReq(INVOICE);

        expect(store.getPayReqError).toBe('mint offline');
        expect(store.payReqMintBalance).toBe(0);
        expect(store.payReqAmount).toBe(0);
    });

    it('resets both on clearPayReq', async () => {
        const store = singleMintStore();
        await store.getPayReq(INVOICE);
        expect(store.payReqMintBalance).toBe(1200);
        expect(store.payReqAmount).toBe(1000);

        store.clearPayReq();

        expect(store.payReqMintBalance).toBe(0);
        expect(store.payReqAmount).toBe(0);
    });
});
