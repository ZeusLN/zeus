jest.mock('../stores/Stores', () => ({}));

import { autorun } from 'mobx';

import Invoice from './Invoice';

// decodes with timestamp 1700074718 and expiry 3600 (see Bolt11Utils.test.ts)
const paymentRequest =
    'lnbcrt1230n1pj429x7pp57t97q4awqj3f529snr0pa6senk83sq5pp760qf5a4jzvd7xgwcksdqqcqzzsxqrrsssp57eqtv7vxr46arupna3w4ct0lkf2mqmz9wt044cwkks0rwlnhfr5s9qyyssqragwpwav7nfwv2xyuuamxxj4pnnpzv2hlw7j473repd3sq7st698ta9kmzmygt0w7tmncl56a6mnma0w7e5dlpqd0wy6x3v35rssldspjhh8p0';

describe('Invoice.originalTimeUntilExpiryInSeconds', () => {
    it('derives expiry from a decodable payment request', () => {
        const invoice = new Invoice({ payment_request: paymentRequest });
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
});
