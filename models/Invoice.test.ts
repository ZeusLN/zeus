jest.mock('../stores/Stores');

import { autorun } from 'mobx';

import Invoice from './Invoice';
import Bolt11Utils from '../utils/Bolt11Utils';
import * as LocaleUtils from '../utils/LocaleUtils';

// decodes with timestamp 1700074718 and expiry 3600 (see Bolt11Utils.test.ts)
const paymentRequest =
    'lnbcrt1230n1pj429x7pp57t97q4awqj3f529snr0pa6senk83sq5pp760qf5a4jzvd7xgwcksdqqcqzzsxqrrsssp57eqtv7vxr46arupna3w4ct0lkf2mqmz9wt044cwkks0rwlnhfr5s9qyyssqragwpwav7nfwv2xyuuamxxj4pnnpzv2hlw7j473repd3sq7st698ta9kmzmygt0w7tmncl56a6mnma0w7e5dlpqd0wy6x3v35rssldspjhh8p0';

// BOLT11 spec test vector with no expiry (x) field, timestamp 1496314658
const noExpiryPaymentRequest =
    'lnbc1pvjluezsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygspp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpl2pkx2ctnv5sxxmmwwd5kgetjypeh2ursdae8g6twvus8g6rfwvs8qun0dfjkxaq9qrsgq357wnc5r2ueh7ck6q93dj32dlqnls087fxdwk8qakdyafkq3yap9us6v52vjjsrvywa6rt52cm9r9zqt8r2t7mlcwspyetp5h2tztugp9lfyql';

describe('Invoice.originalTimeUntilExpiryInSeconds', () => {
    it('derives expiry from a decodable payment request', () => {
        const invoice = new Invoice({ payment_request: paymentRequest });
        expect(invoice.originalTimeUntilExpiryInSeconds).toBe(3600);
    });

    it('defaults to 3600 when the payment request has no expiry field', () => {
        const invoice = new Invoice({
            payment_request: noExpiryPaymentRequest
        });
        expect(invoice.originalTimeUntilExpiryInSeconds).toBe(3600);
    });

    it('falls back to the expiry field when no payment request string is present (decodepayreq response)', () => {
        const invoice = new Invoice({
            destination: '02758997f184be06f4350b136db0bed6f8',
            timestamp: '1700074718',
            expiry: '3600',
            cltv_expiry: '80'
        });
        expect(invoice.originalTimeUntilExpiryInSeconds).toBe(3600);
    });

    it('uses expires_at with the model timestamp when no payment request string is present', () => {
        const invoice = new Invoice({
            timestamp: '1700074718',
            expires_at: 1700074718 + 600
        });
        expect(invoice.originalTimeUntilExpiryInSeconds).toBe(600);
    });

    it('returns undefined when no expiry information is available', () => {
        const invoice = new Invoice({
            destination: '02758997f184be06f4350b136db0bed6f8'
        });
        expect(invoice.originalTimeUntilExpiryInSeconds).toBeUndefined();
    });
});

describe('Invoice.isExpired / isExpiredNow', () => {
    const timestamp = 1700074718;
    const expiry = 3600;
    const expiryMs = (timestamp + expiry) * 1000;

    // lnd-style decodepayreq response: expiry fields present,
    // but no bolt11 string to re-decode
    const lndDecodeResponse = {
        destination: '02758997f184be06f4350b136db0bed6f8',
        timestamp: timestamp.toString(),
        expiry: expiry.toString(),
        cltv_expiry: '80'
    };

    afterEach(() => {
        jest.useRealTimers();
    });

    it('is true for an invoice whose bolt11 expiry has passed', () => {
        const invoice = new Invoice({ payment_request: paymentRequest });

        expect(invoice.isExpired).toBe(true);
        expect(invoice.isExpiredNow()).toBe(true);
    });

    it('is true for a decode response without a bolt11 string when the original payment request is threaded through', () => {
        const invoice = new Invoice({
            ...lndDecodeResponse,
            paymentRequest
        });

        expect(invoice.isExpired).toBe(true);
        expect(invoice.isExpiredNow()).toBe(true);
    });

    it('fails open (false) for a decode response without any bolt11 string, which is why InvoicesStore.getPayReq must thread it through', () => {
        const invoice = new Invoice(lndDecodeResponse);

        expect(invoice.isExpired).toBe(false);
        expect(invoice.isExpiredNow()).toBe(false);
    });

    it('expires an invoice without an expiry field 3600s after its timestamp', () => {
        const invoice = new Invoice({
            payment_request: noExpiryPaymentRequest
        });

        jest.useFakeTimers();

        jest.setSystemTime((1496314658 + 3600) * 1000 - 1000);
        expect(invoice.isExpiredNow()).toBe(false);

        jest.setSystemTime((1496314658 + 3600) * 1000);
        expect(invoice.isExpiredNow()).toBe(true);
    });

    it('is false before the expiry timestamp and true after it', () => {
        const invoice = new Invoice({ payment_request: paymentRequest });

        jest.useFakeTimers();

        jest.setSystemTime(expiryMs - 1000);
        expect(invoice.isExpiredNow()).toBe(false);

        jest.setSystemTime(expiryMs + 1000);
        expect(invoice.isExpiredNow()).toBe(true);
    });

    it('isExpiredNow stays fresh while the isExpired computed is observed', () => {
        const invoice = new Invoice({ payment_request: paymentRequest });

        jest.useFakeTimers();
        jest.setSystemTime(expiryMs - 1000);

        // keep the computed observed so MobX caches it, as an
        // @observer screen rendering the invoice would
        let observed: boolean | undefined;
        const dispose = autorun(() => {
            observed = invoice.isExpired;
        });

        expect(observed).toBe(false);

        jest.setSystemTime(expiryMs + 1000);

        // Date.now() is not observable, so the cached computed may
        // still report false; the plain method must not
        expect(invoice.isExpiredNow()).toBe(true);

        dispose();
    });
});

describe('Invoice.getMemo', () => {
    it('decodes percent-encoded memos from LNURL-pay services (#1717)', () => {
        const invoice = new Invoice({ memo: 'Pay%20to%20Alice' });
        expect(invoice.getMemo).toBe('Pay to Alice');
    });

    it('leaves memos with a literal % untouched', () => {
        const invoice = new Invoice({ memo: '50% off' });
        expect(invoice.getMemo).toBe('50% off');
    });

    it('still splits NameDesc memos after decoding', () => {
        const invoice = new Invoice({ memo: 'Alice:  Pay%20me' });
        expect(invoice.getMemo).toBe('Pay me');
        expect(invoice.getNameDescReceiver).toBe('Alice');
    });
});

describe('Invoice.determineFormattedOriginalTimeUntilExpiry', () => {
    it('humanizes the fallback expiry seconds', () => {
        const invoice = new Invoice({
            timestamp: '1700074718',
            expiry: '3600'
        });
        invoice.determineFormattedOriginalTimeUntilExpiry('en');
        expect(invoice.formattedOriginalTimeUntilExpiry).toBe('1 hour');
    });

    it('humanizes the expiry of a decodable payment request', () => {
        const invoice = new Invoice({ payment_request: paymentRequest });
        invoice.determineFormattedOriginalTimeUntilExpiry('en');
        expect(invoice.formattedOriginalTimeUntilExpiry).toBe('1 hour');
    });

    // CashuStore.getPayReq builds its payReq this way
    it('humanizes the expiry of an invoice built from Bolt11Utils.decode output', () => {
        const invoice = new Invoice(Bolt11Utils.decode(paymentRequest) as any);
        invoice.determineFormattedOriginalTimeUntilExpiry('en');
        expect(invoice.formattedOriginalTimeUntilExpiry).toBe('1 hour');
    });

    it('uses the BOLT11 default of 3600s when the invoice has no expiry field', () => {
        const invoice = new Invoice({
            payment_request: noExpiryPaymentRequest
        });
        invoice.determineFormattedOriginalTimeUntilExpiry('en');
        expect(invoice.formattedOriginalTimeUntilExpiry).toBe('1 hour');
    });

    it('formats "Never" when no expiry information is available', () => {
        const spy = jest
            .spyOn(LocaleUtils, 'localeString')
            .mockImplementation((key: string) => key);
        const invoice = new Invoice({
            destination: '02758997f184be06f4350b136db0bed6f8'
        });
        invoice.determineFormattedOriginalTimeUntilExpiry('en');
        expect(invoice.formattedOriginalTimeUntilExpiry).toBe(
            'models.Invoice.never'
        );
        spy.mockRestore();
    });
});

describe('Invoice.getRequestAmount', () => {
    it('reads num_msat when LND rounds a sub-sat amount down to 0 sats', () => {
        const invoice = new Invoice({ num_satoshis: '0', num_msat: '500' });
        expect(invoice.getRequestAmount).toBe(0.5);
    });

    it('reads num_msat from embedded LND Long fields', () => {
        const Long = require('long');
        const invoice = new Invoice({
            num_satoshis: Long.fromString('0'),
            num_msat: Long.fromString('999')
        });
        expect(invoice.getRequestAmount).toBe(0.999);
    });

    it('keeps the msat part of amounts above 1 sat', () => {
        const invoice = new Invoice({ num_satoshis: '1', num_msat: '1500' });
        expect(invoice.getRequestAmount).toBe(1.5);
    });

    it('reads num_satoshis when num_msat is absent', () => {
        expect(new Invoice({ num_satoshis: '123' }).getRequestAmount).toBe(123);
    });

    it('is 0 for a no-amount LND invoice', () => {
        expect(
            new Invoice({ num_satoshis: '0', num_msat: '0' }).getRequestAmount
        ).toBe(0);
        expect(new Invoice({}).getRequestAmount).toBe(0);
    });
});

describe('Invoice.getTimestamp', () => {
    it('uses created_at for an unpaid NWC (NIP-47) transaction', () => {
        const invoice = new Invoice({
            state: 'pending',
            created_at: 1793874662,
            expires_at: 1793878262,
            settled_at: 0
        });

        expect(invoice.getTimestamp).toBe(1793874662);
    });

    it('uses created_at for an expired NWC transaction, which has no settled_at', () => {
        // an expired invoice is listed as expired by the wallet
        const invoice = new Invoice({
            state: 'expired',
            created_at: 1793869622,
            expires_at: 1793873222,
            settled_at: 0
        });

        expect(invoice.getTimestamp).toBe(1793869622);
    });

    it('uses the settle time for a settled NWC transaction', () => {
        const invoice = new Invoice({
            state: 'settled',
            created_at: 100,
            settled_at: 200
        });

        expect(invoice.getTimestamp).toBe(200);
    });

    it('orders a settled NWC invoice by when it was paid, not created', () => {
        // created at 500 but paid at 900, after the pending one was created
        const settled = new Invoice({
            state: 'settled',
            created_at: 500,
            settled_at: 900
        });
        const pending = new Invoice({
            state: 'pending',
            created_at: 800,
            settled_at: 0
        });
        const older = new Invoice({
            state: 'settled',
            created_at: 100,
            settled_at: 300
        });

        expect(Number(settled.getTimestamp)).toBeGreaterThan(
            Number(pending.getTimestamp)
        );
        expect(Number(pending.getTimestamp)).toBeGreaterThan(
            Number(older.getTimestamp)
        );
    });

    it('keeps the earlier fields first, so other backends are unchanged', () => {
        expect(
            new Invoice({ creation_date: '1700000000', created_at: 5 })
                .getTimestamp
        ).toBe('1700000000');
        expect(
            new Invoice({ paid_at: 1700000900, created_at: 5 }).getTimestamp
        ).toBe(1700000900);
        expect(
            new Invoice({ timestamp: 1700000100, created_at: 5 }).getTimestamp
        ).toBe(1700000100);
    });

    it('still falls back to the settle time, and to 0 with nothing to go on', () => {
        expect(new Invoice({ settle_date: '1700000500' }).getTimestamp).toBe(
            '1700000500'
        );
        expect(new Invoice({}).getTimestamp).toBe(0);
    });
});

describe('Invoice.getLspFee', () => {
    it('is the fee an LSP withheld, in sats', () => {
        expect(new Invoice({ lsp_fee_msat: '10000500' }).getLspFee).toBe(
            10000.5
        );
    });

    it('is zero without one', () => {
        expect(new Invoice({}).getLspFee).toBe(0);
    });

    it('is not reported as a fee paid', () => {
        expect((new Invoice({ lsp_fee_msat: '1000' }) as any).getFee).toBe(
            undefined
        );
    });
});
