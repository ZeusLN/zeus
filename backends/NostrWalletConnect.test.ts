// NostrWalletConnect backend against the real @getalby/sdk
// NostrWebLNProvider. Only the provider's NIP-47 client is stubbed, so the
// assertions cover the request that would be sent to the wallet service
// (field names, msat units) and the decoded result Zeus gets back.
import {
    Nip47PublishTimeoutError,
    Nip47ReplyTimeoutError,
    Nip47WalletError,
    NostrWebLNProvider
} from '@getalby/sdk';
import { sha256 } from 'js-sha256';

// settings.locale is read by localeString for user-facing errors
const mockSettingsStore: any = { settings: { locale: 'en' } };
// getter: the factory runs when the backend is imported, which is hoisted
// above the const declaration
jest.mock('../stores/Stores', () => ({
    get settingsStore() {
        return mockSettingsStore;
    }
}));

import Base64Utils from '../utils/Base64Utils';
import Bolt11Utils from '../utils/Bolt11Utils';

import NostrWalletConnect from './NostrWalletConnect';

const WALLET_PUBKEY = 'b'.repeat(64);
const SECRET = 'a'.repeat(64);
const RELAY = 'wss://relay.example.com';
const NWC_URL = `nostr+walletconnect://${WALLET_PUBKEY}?relay=${encodeURIComponent(
    RELAY
)}&secret=${SECRET}`;

// BOLT11 spec reference vector (lnbc2500u, 250,000 sat)
// https://github.com/lightning/bolts/blob/master/11-payment-encoding.md#examples
const SPEC_INVOICE =
    'lnbc2500u1pvjluezsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygspp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpquwpc4curk03c9wlrswe78q4eyqc7d8d0xqzpu9qrsgqhtjpauu9ur7fw2thcl4y9vfvh4m9wlfyz2gem29g5ghe2aak2pm3ps8fdhtceqsaagty2vph7utlgj48u0ged6a337aewvraedendscp573dxr';
const SPEC_PAYMENT_HASH =
    '0001020304050607080900010203040506070809000102030405060708090102';
// signet invoice (56,778 sat) from utils/Bolt11Utils.test.ts; its payment
// hash differs from the spec vector's
const SIGNET_INVOICE =
    'lntbs567780n1pnqr26ypp5c0wcrpzwxwqnwu2nld5q36dfc9yjrfdp87nn9d5y093jjncvqresdq0w3jhxar8v3n8xeccqzpuxqrrsssp5r94e3nwnw63gjaxc8wex38ufv2m6442vnrw49m7dad9jdum3tdsq9qyyssqk4dvvuk7zhhju8ztf7nfc2hzqq9gqtzuyc0ljz8nl93laxwv4869lt9fsxkxacje6eh4ur5ymg83hvakn4tfpzdu6fq49705sar7fxspga8qjp';
const SIGNET_PAYMENT_HASH =
    'c3dd81844e3381377153fb6808e9a9c14921a5a13fa732b6847963294f0c00f3';
const PREIMAGE = 'c'.repeat(64);

// NIP-47 transaction as a wallet service returns it (amounts in msat)
const nip47Tx = (overrides: any = {}) => ({
    type: 'incoming',
    state: 'settled',
    invoice: SPEC_INVOICE,
    description: 'coffee',
    description_hash: '',
    preimage: PREIMAGE,
    payment_hash: SPEC_PAYMENT_HASH,
    amount: 250_000_000,
    fees_paid: 0,
    created_at: 1700000000,
    expires_at: 1700003600,
    settled_at: 1700000100,
    metadata: {},
    ...overrides
});

// Backend wired to a real provider whose NIP-47 client methods are mocks
const setup = async () => {
    mockSettingsStore.nostrWalletConnectUrl = NWC_URL;
    const backend = new NostrWalletConnect();
    await backend.initNWC();
    await backend.connect();
    const client = backend.nwc.client;
    client.getBalance = jest.fn();
    client.payInvoice = jest.fn();
    client.makeInvoice = jest.fn();
    client.lookupInvoice = jest.fn();
    client.listTransactions = jest.fn();
    return { backend, client };
};

let consoleError: jest.SpyInstance;
beforeEach(() => {
    // the SDK logs every failed request with console.error
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
    consoleError.mockRestore();
});

describe('NostrWalletConnect.initNWC', () => {
    it('builds a provider from the connection string in settings', async () => {
        mockSettingsStore.nostrWalletConnectUrl = NWC_URL;
        const backend = new NostrWalletConnect();

        const provider = await backend.initNWC();

        expect(provider).toBeInstanceOf(NostrWebLNProvider);
        expect(backend.nwc).toBe(provider);
        expect(provider.client.walletPubkey).toBe(WALLET_PUBKEY);
        expect(provider.client.relayUrls).toEqual([RELAY]);
        expect(provider.client.secret).toBe(SECRET);
    });

    it('reads the connection string again on every init', async () => {
        const backend = new NostrWalletConnect();
        mockSettingsStore.nostrWalletConnectUrl = NWC_URL;
        const first = await backend.initNWC();

        const otherPubkey = 'd'.repeat(64);
        mockSettingsStore.nostrWalletConnectUrl = NWC_URL.replace(
            WALLET_PUBKEY,
            otherPubkey
        );
        const second = await backend.initNWC();

        expect(second).not.toBe(first);
        expect(backend.nwc).toBe(second);
        expect(second.client.walletPubkey).toBe(otherPubkey);
    });

    it('rejects a connection string without a valid wallet pubkey', async () => {
        mockSettingsStore.nostrWalletConnectUrl = `nostr+walletconnect://not-a-pubkey?relay=${encodeURIComponent(
            RELAY
        )}&secret=${SECRET}`;
        const backend = new NostrWalletConnect();

        await expect(backend.initNWC()).rejects.toThrow('Invalid NWC URL');
    });
});

describe('NostrWalletConnect.connect', () => {
    it('enables the provider so requests can be sent', async () => {
        mockSettingsStore.nostrWalletConnectUrl = NWC_URL;
        const backend = new NostrWalletConnect();
        await backend.initNWC();
        backend.nwc.client.getBalance = jest
            .fn()
            .mockResolvedValue({ balance: 1000 });

        await expect(backend.getLightningBalance()).rejects.toThrow(
            'please call enable()'
        );
        expect(backend.nwc.client.getBalance).not.toHaveBeenCalled();

        await backend.connect();

        await expect(backend.getLightningBalance()).resolves.toEqual({
            balance: 1,
            currency: 'sats'
        });
    });
});

describe('NostrWalletConnect.getLightningBalance', () => {
    it('converts the msat balance to whole sats, rounding down', async () => {
        const { backend, client } = await setup();
        client.getBalance.mockResolvedValue({ balance: 1_234_567 });

        await expect(backend.getLightningBalance()).resolves.toEqual({
            balance: 1234,
            currency: 'sats'
        });
        expect(client.getBalance).toHaveBeenCalledTimes(1);
    });

    it('reports a balance under one sat as zero', async () => {
        const { backend, client } = await setup();
        client.getBalance.mockResolvedValue({ balance: 999 });

        await expect(backend.getLightningBalance()).resolves.toEqual({
            balance: 0,
            currency: 'sats'
        });
    });

    it('rejects with the wallet service error', async () => {
        const { backend, client } = await setup();
        const error = new Nip47WalletError('Restricted', 'RESTRICTED');
        client.getBalance.mockRejectedValue(error);

        await expect(backend.getLightningBalance()).rejects.toBe(error);
    });
});

describe('NostrWalletConnect.getInvoices', () => {
    it('returns only incoming transactions, with amounts in sats', async () => {
        const { backend, client } = await setup();
        client.listTransactions.mockResolvedValue({
            transactions: [
                nip47Tx({ amount: 250_000_999 }),
                nip47Tx({ type: 'outgoing', fees_paid: 2000 }),
                nip47Tx({ amount: 1_500, settled_at: undefined })
            ]
        });

        const { invoices } = await backend.getInvoices({ limit: 10 });

        expect(client.listTransactions).toHaveBeenCalledWith({ limit: 10 });
        expect(invoices).toHaveLength(2);
        expect(invoices[0]).toEqual({
            ...nip47Tx(),
            amount: 250_000,
            fees_paid: 0
        });
        expect(invoices[1].amount).toBe(1);
        expect(invoices[1].settled_at).toBeUndefined();
        expect(invoices.every((i: any) => i.type === 'incoming')).toBe(true);
    });

    it.each([
        ['no arguments', undefined],
        ['no limit', {}],
        ['a zero limit', { limit: 0 }]
    ])('sends no limit when called with %s', async (_, data) => {
        const { backend, client } = await setup();
        client.listTransactions.mockResolvedValue({ transactions: [] });

        await expect(backend.getInvoices(data)).resolves.toEqual({
            invoices: []
        });
        expect(client.listTransactions).toHaveBeenCalledWith({});
    });

    it('rejects with the wallet service error', async () => {
        const { backend, client } = await setup();
        const error = new Nip47WalletError(
            'Not implemented',
            'NOT_IMPLEMENTED'
        );
        client.listTransactions.mockRejectedValue(error);

        await expect(backend.getInvoices({ limit: 10 })).rejects.toBe(error);
    });
});

describe('NostrWalletConnect.getPayments', () => {
    it('returns only outgoing transactions, with amount and fee in sats', async () => {
        const { backend, client } = await setup();
        client.listTransactions.mockResolvedValue({
            transactions: [
                nip47Tx(),
                nip47Tx({
                    type: 'outgoing',
                    amount: 10_000_500,
                    fees_paid: 3_999
                })
            ]
        });

        const { payments } = await backend.getPayments({ maxPayments: 25 });

        expect(client.listTransactions).toHaveBeenCalledWith({ limit: 25 });
        expect(payments).toEqual([
            {
                ...nip47Tx({ type: 'outgoing' }),
                amount: 10_000,
                fees_paid: 3
            }
        ]);
    });

    it('asks for 500 payments when called without arguments', async () => {
        const { backend, client } = await setup();
        client.listTransactions.mockResolvedValue({ transactions: [] });

        await backend.getPayments();

        expect(client.listTransactions).toHaveBeenCalledWith({ limit: 500 });
    });

    it.each([
        ['missing', {}],
        ['zero', { maxPayments: 0 }]
    ])('sends no limit when maxPayments is %s', async (_, params) => {
        // the 500 default only applies when the argument itself is omitted
        const { backend, client } = await setup();
        client.listTransactions.mockResolvedValue({ transactions: [] });

        await backend.getPayments(params);

        expect(client.listTransactions).toHaveBeenCalledWith({});
    });

    it('rejects with a reply timeout', async () => {
        const { backend, client } = await setup();
        const error = new Nip47ReplyTimeoutError(
            'reply timeout: event abc',
            'INTERNAL'
        );
        client.listTransactions.mockRejectedValue(error);

        await expect(backend.getPayments()).rejects.toBe(error);
    });
});

describe('NostrWalletConnect.createInvoice', () => {
    it('requests the amount in msat with the memo as description', async () => {
        const { backend, client } = await setup();
        client.makeInvoice.mockResolvedValue(
            nip47Tx({ state: 'pending', settled_at: undefined })
        );

        await backend.createInvoice({ value: '250000', memo: 'coffee' });

        expect(client.makeInvoice).toHaveBeenCalledWith({
            amount: 250_000_000,
            description: 'coffee'
        });
    });

    it('returns the invoice with the payment hash decoded from it', async () => {
        const { backend, client } = await setup();
        client.makeInvoice.mockResolvedValue(
            nip47Tx({ state: 'pending', settled_at: undefined })
        );

        await expect(
            backend.createInvoice({ value: 250000, memo: 'coffee' })
        ).resolves.toEqual({
            paymentRequest: SPEC_INVOICE,
            payment_hash: SPEC_PAYMENT_HASH
        });
    });

    it('returns the invoice without a hash when it cannot be decoded', async () => {
        const { backend, client } = await setup();
        client.makeInvoice.mockResolvedValue({ invoice: 'lnbc1garbage' });

        await expect(
            backend.createInvoice({ value: 1, memo: '' })
        ).resolves.toEqual({ paymentRequest: 'lnbc1garbage' });
    });

    it('does not send the expiry', async () => {
        // supportsSettingInvoiceExpiration is false, so the wallet default
        // applies
        const { backend, client } = await setup();
        client.makeInvoice.mockResolvedValue(nip47Tx());

        await backend.createInvoice({ value: 1, memo: 'x', expiry: '600' });

        expect(client.makeInvoice.mock.calls[0][0]).not.toHaveProperty(
            'expiry'
        );
    });

    it.each([
        ['zero', 0],
        ['empty', ''],
        ['missing', undefined]
    ])(
        'rejects a %s amount without contacting the wallet',
        async (_, value) => {
            // zero-amount invoices cannot be created over NWC
            const { backend, client } = await setup();

            await expect(
                backend.createInvoice({ value, memo: 'x' })
            ).rejects.toThrow('No amount specified');
            expect(client.makeInvoice).not.toHaveBeenCalled();
        }
    );

    it('rejects with the wallet service error', async () => {
        const { backend, client } = await setup();
        const error = new Nip47WalletError('Quota exceeded', 'QUOTA_EXCEEDED');
        client.makeInvoice.mockRejectedValue(error);

        await expect(
            backend.createInvoice({ value: 1, memo: 'x' })
        ).rejects.toBe(error);
    });
});

describe('NostrWalletConnect.payLightningInvoice', () => {
    // The spec invoice's preimage is unknown, so bind its decoded payment
    // hash to a preimage the tests control
    const PAY_PREIMAGE = 'd'.repeat(64);
    const PAY_HASH = sha256(Base64Utils.hexToBytes(PAY_PREIMAGE));

    beforeEach(() => {
        const decode = Bolt11Utils.decode;
        jest.spyOn(Bolt11Utils, 'decode').mockImplementation(
            (invoice: string) => ({
                ...decode(invoice),
                payment_hash: PAY_HASH
            })
        );
    });
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('sends pay_invoice with the payment request and reports success with a matching preimage', async () => {
        const { backend, client } = await setup();
        client.payInvoice.mockResolvedValue({ preimage: PAY_PREIMAGE });

        await expect(
            backend.payLightningInvoice({ payment_request: SPEC_INVOICE })
        ).resolves.toEqual({
            status: 'SUCCEEDED',
            payment_hash: PAY_HASH,
            preimage: PAY_PREIMAGE
        });
        expect(client.payInvoice).toHaveBeenCalledTimes(1);
        expect(client.payInvoice).toHaveBeenCalledWith({
            invoice: SPEC_INVOICE
        });
    });

    it('accepts an uppercase hex preimage and returns it lowercased', async () => {
        const { backend, client } = await setup();
        client.payInvoice.mockResolvedValue({
            preimage: PAY_PREIMAGE.toUpperCase()
        });

        await expect(
            backend.payLightningInvoice({ payment_request: SPEC_INVOICE })
        ).resolves.toEqual({
            status: 'SUCCEEDED',
            payment_hash: PAY_HASH,
            preimage: PAY_PREIMAGE
        });
    });

    it.each([
        ['a preimage for another hash', PREIMAGE],
        ['a short preimage', 'dd'],
        ['a non-hex preimage', 'z'.repeat(64)]
    ])('rejects %s', async (_, preimage) => {
        const { backend, client } = await setup();
        client.payInvoice.mockResolvedValue({ preimage });

        await expect(
            backend.payLightningInvoice({ payment_request: SPEC_INVOICE })
        ).rejects.toThrow(
            'The wallet reported this payment as sent, but the preimage it returned does not match the invoice'
        );
    });

    it('rejects a non-hex preimage even when it parses to the right bytes', async () => {
        // parseInt('dz', 16) is 0x0d, so 'dz' repeated hashes like '0d'
        // repeated; only the hex check catches it
        const realPreimage = '0d'.repeat(32);
        const decode = (
            Bolt11Utils.decode as jest.Mock
        ).getMockImplementation()!;
        (Bolt11Utils.decode as jest.Mock).mockImplementation(
            (invoice: string) => ({
                ...decode(invoice),
                payment_hash: sha256(Base64Utils.hexToBytes(realPreimage))
            })
        );
        const { backend, client } = await setup();
        client.payInvoice.mockResolvedValue({ preimage: 'dz'.repeat(32) });

        await expect(
            backend.payLightningInvoice({ payment_request: SPEC_INVOICE })
        ).rejects.toThrow(
            'The wallet reported this payment as sent, but the preimage it returned does not match the invoice'
        );
    });

    it('reports success without checking when the invoice does not decode', async () => {
        // decoding is best-effort; with no hash there is nothing to check
        jest.spyOn(Bolt11Utils, 'decode').mockImplementation(() => {
            throw new Error('bad invoice');
        });
        const { backend, client } = await setup();
        client.payInvoice.mockResolvedValue({ preimage: PREIMAGE });

        await expect(
            backend.payLightningInvoice({ payment_request: SPEC_INVOICE })
        ).resolves.toEqual({
            status: 'SUCCEEDED',
            payment_hash: undefined,
            preimage: PREIMAGE
        });
    });

    it('sends only the invoice, dropping amount and fee limit', async () => {
        // TransactionsStore.sendPayment sets amt for zero-amount invoices
        // and fee_limit_sat; NIP-47 pay_invoice has an amount (msat) field
        // but this backend does not forward it
        const { backend, client } = await setup();
        client.payInvoice.mockResolvedValue({ preimage: PAY_PREIMAGE });

        await backend.payLightningInvoice({
            payment_request: SPEC_INVOICE,
            amt: 1234,
            fee_limit_sat: 10,
            max_parts: '1',
            timeout_seconds: 60
        });

        expect(client.payInvoice).toHaveBeenCalledWith({
            invoice: SPEC_INVOICE
        });
    });

    it.todo('forwards the amount in msat when paying a zero-amount invoice');

    it('drops the fee the wallet reports', async () => {
        // pins current behavior: the provider keeps only the preimage, so
        // the routing fee never reaches the payment result
        const { backend, client } = await setup();
        client.payInvoice.mockResolvedValue({
            preimage: PAY_PREIMAGE,
            fees_paid: 5000
        });

        const result = await backend.payLightningInvoice({
            payment_request: SPEC_INVOICE
        });

        expect(result).not.toHaveProperty('fees_paid');
        expect(result).not.toHaveProperty('fee_msat');
    });

    it.todo('returns the fee the wallet reports, in sats');

    it.each([
        ['no preimage', {}],
        ['an empty preimage', { preimage: '' }]
    ])(
        'reports a reply with %s as in flight, not complete',
        async (_, reply) => {
            // Zeus's own NWC service answers with an empty preimage while
            // the HTLC is still out
            const { backend, client } = await setup();
            client.payInvoice.mockResolvedValue(reply);

            await expect(
                backend.payLightningInvoice({ payment_request: SPEC_INVOICE })
            ).resolves.toEqual({
                status: 'IN_FLIGHT',
                payment_hash: PAY_HASH
            });
        }
    );

    it('rejects with the wallet error when the payment fails', async () => {
        const { backend, client } = await setup();
        const error = new Nip47WalletError('no route found', 'PAYMENT_FAILED');
        client.payInvoice.mockRejectedValue(error);

        const promise = backend.payLightningInvoice({
            payment_request: SPEC_INVOICE
        });

        await expect(promise).rejects.toBe(error);
        await expect(promise).rejects.toMatchObject({
            message: 'no route found',
            code: 'PAYMENT_FAILED'
        });
    });

    it.each([
        ['insufficient balance', 'INSUFFICIENT_BALANCE'],
        ['budget exceeded', 'QUOTA_EXCEEDED'],
        ['not allowed', 'RESTRICTED']
    ])('passes a %s error through unchanged', async (message, code) => {
        const { backend, client } = await setup();
        client.payInvoice.mockRejectedValue(
            new Nip47WalletError(message, code)
        );

        await expect(
            backend.payLightningInvoice({ payment_request: SPEC_INVOICE })
        ).rejects.toMatchObject({ message, code });
    });

    it('reports a reply timeout as in flight, since the wallet may still pay', async () => {
        const { backend, client } = await setup();
        client.payInvoice.mockRejectedValue(
            new Nip47ReplyTimeoutError('reply timeout: event abc', 'INTERNAL')
        );

        await expect(
            backend.payLightningInvoice({ payment_request: SPEC_INVOICE })
        ).resolves.toEqual({
            status: 'IN_FLIGHT',
            payment_hash: PAY_HASH
        });
        expect(client.payInvoice).toHaveBeenCalledTimes(1);
    });

    it('still rejects on a publish timeout, since the wallet never got the request', async () => {
        const { backend, client } = await setup();
        const error = new Nip47PublishTimeoutError(
            'publish timeout: abc',
            'INTERNAL'
        );
        client.payInvoice.mockRejectedValue(error);

        await expect(
            backend.payLightningInvoice({ payment_request: SPEC_INVOICE })
        ).rejects.toBe(error);
    });

    it('does not treat another error with the same code as a reply timeout', async () => {
        // reply and publish timeouts share the INTERNAL code, so only the
        // error class tells them apart
        const { backend, client } = await setup();
        const error = new Nip47WalletError(
            'reply timeout: event abc',
            'INTERNAL'
        );
        client.payInvoice.mockRejectedValue(error);

        await expect(
            backend.payLightningInvoice({ payment_request: SPEC_INVOICE })
        ).rejects.toBe(error);
    });

    it('does not retry a failed payment', async () => {
        const { backend, client } = await setup();
        client.payInvoice.mockRejectedValue(
            new Nip47WalletError('failed', 'PAYMENT_FAILED')
        );

        await expect(
            backend.payLightningInvoice({ payment_request: SPEC_INVOICE })
        ).rejects.toThrow('failed');
        expect(client.payInvoice).toHaveBeenCalledTimes(1);
    });
});

describe('NostrWalletConnect.decodePaymentRequest', () => {
    it('decodes the first URL parameter as a BOLT11 invoice', async () => {
        const backend = new NostrWalletConnect();

        const decoded = await backend.decodePaymentRequest([SPEC_INVOICE]);

        expect(decoded.payment_hash).toBe(SPEC_PAYMENT_HASH);
        expect(decoded.num_satoshis).toBe('250000');
        expect(decoded.paymentRequest).toBe(SPEC_INVOICE);
    });

    it('decodes only the first of several parameters', async () => {
        const backend = new NostrWalletConnect();

        const decoded = await backend.decodePaymentRequest([
            SIGNET_INVOICE,
            SPEC_INVOICE
        ]);

        expect(decoded.payment_hash).toBe(SIGNET_PAYMENT_HASH);
        expect(decoded.num_satoshis).toBe('56778');
        expect(decoded.paymentRequest).toBe(SIGNET_INVOICE);
    });

    it.each([
        ['no parameters', undefined],
        ['an empty list', []],
        ['an invalid invoice', ['lnbc1garbage']]
    ])('rejects instead of throwing for %s', async (_, params) => {
        const backend = new NostrWalletConnect();

        let promise: Promise<any> | undefined;
        expect(() => {
            promise = backend.decodePaymentRequest(params);
        }).not.toThrow();
        await expect(promise).rejects.toThrow();
    });
});

describe('NostrWalletConnect.lookupInvoice', () => {
    it('sends the hex payment hash to lookup_invoice', async () => {
        const { backend, client } = await setup();
        client.lookupInvoice.mockResolvedValue(nip47Tx());

        await backend.lookupInvoice({ r_hash: SPEC_PAYMENT_HASH });

        expect(client.lookupInvoice).toHaveBeenCalledTimes(1);
        expect(client.lookupInvoice).toHaveBeenCalledWith({
            invoice: undefined,
            payment_hash: SPEC_PAYMENT_HASH
        });
    });

    it('maps the wallet reply to preimage, paymentRequest and paid', async () => {
        const { backend, client } = await setup();
        client.lookupInvoice.mockResolvedValue(nip47Tx());

        await expect(
            backend.lookupInvoice({ r_hash: SPEC_PAYMENT_HASH })
        ).resolves.toEqual({
            preimage: PREIMAGE,
            paymentRequest: SPEC_INVOICE,
            paid: true
        });
    });

    it('reports an invoice without settled_at as unpaid', async () => {
        const { backend, client } = await setup();
        client.lookupInvoice.mockResolvedValue(
            nip47Tx({ state: 'pending', settled_at: undefined, preimage: '' })
        );

        await expect(
            backend.lookupInvoice({ r_hash: SPEC_PAYMENT_HASH })
        ).resolves.toMatchObject({ paid: false });
    });

    it('rejects with the wallet service error', async () => {
        const { backend, client } = await setup();
        const error = new Nip47WalletError('not found', 'NOT_FOUND');
        client.lookupInvoice.mockRejectedValue(error);

        await expect(
            backend.lookupInvoice({ r_hash: SPEC_PAYMENT_HASH })
        ).rejects.toBe(error);
    });
});

describe('NostrWalletConnect capability flags', () => {
    // Every supports*/requires*/is*/single* flag with its expected value.
    // Flags missing here fall through to false in BackendUtils.call.
    const expected: { [flag: string]: boolean } = {
        supportsPeers: false,
        supportsMessageSigning: false,
        supportsMessageVerification: false,
        supportsLnurlAuth: false,
        supportsOnchainBalance: false,
        supportsOnchainSends: false,
        supportsOnchainReceiving: false,
        supportsLightningSends: true,
        supportsKeysend: false,
        supportsChannelManagement: false,
        supportsCircularRebalancing: false,
        supportsForceClose: false,
        supportsPendingChannels: false,
        supportsClosedChannels: false,
        supportsMPP: false,
        supportsAMP: false,
        supportsCoinControl: false,
        supportsChannelCoinControl: false,
        supportsHopPicking: false,
        supportsAccounts: false,
        supportsRouting: false,
        supportsNodeInfo: false,
        supportsWithdrawalRequests: false,
        singleFeesEarnedTotal: false,
        supportsAddressTypeSelection: false,
        supportsNestedSegWit: false,
        supportsTaproot: false,
        supportsBumpFee: false,
        supportsOnchainSendFeeRate: false,
        supportsChannelOpenFeeRate: false,
        supportsChannelOpenMinConfs: false,
        supportsFlowLSP: false,
        supportsNetworkInfo: false,
        supportsSimpleTaprootChannels: false,
        supportsCustomPreimages: false,
        supportsSweep: false,
        supportsOnchainSendMax: false,
        supportsOnchainBatching: false,
        supportsChannelBatching: false,
        supportsChannelFundMax: false,
        // not read anywhere: BackendUtils asks for supportsLSPScustomMessage
        supportsLSPS1customMessage: false,
        supportsLSPS1rest: false,
        supportsOffers: false,
        supportsListingOffers: false,
        supportsBolt12Address: false,
        supportsBolt11BlindedRoutes: false,
        supportsAddressesWithDerivationPaths: false,
        supportsCustomFeeLimit: false,
        isLNDBased: false,
        supportsForwardingHistory: false,
        supportInboundFees: false,
        supportsCashuWallet: false,
        supportsSettingInvoiceExpiration: false,
        supportsNostrWalletConnectService: false
    };

    const backend = new NostrWalletConnect();

    it.each(Object.entries(expected))('%s() returns %s', (flag, value) => {
        expect((backend as any)[flag]()).toBe(value);
    });

    it('has no flag missing from the table', () => {
        const flags = Object.keys(backend).filter(
            (key) =>
                /^(supports?[A-Z]|requires|isLNDBased|single)/.test(key) &&
                typeof (backend as any)[key] === 'function'
        );
        expect(flags.sort()).toEqual(Object.keys(expected).sort());
    });
});
