jest.mock('../stores/Stores', () => ({}));

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
