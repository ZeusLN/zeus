jest.mock('../stores/Stores', () => ({
    settingsStore: { settings: { locale: 'en' } }
}));

import CashuInvoice from './CashuInvoice';

// decodes with timestamp 1700074718 and expiry 3600 (see Bolt11Utils.test.ts)
const paymentRequest =
    'lnbcrt1230n1pj429x7pp57t97q4awqj3f529snr0pa6senk83sq5pp760qf5a4jzvd7xgwcksdqqcqzzsxqrrsssp57eqtv7vxr46arupna3w4ct0lkf2mqmz9wt044cwkks0rwlnhfr5s9qyyssqragwpwav7nfwv2xyuuamxxj4pnnpzv2hlw7j473repd3sq7st698ta9kmzmygt0w7tmncl56a6mnma0w7e5dlpqd0wy6x3v35rssldspjhh8p0';

describe('CashuInvoice.determineFormattedOriginalTimeUntilExpiry', () => {
    it('humanizes the expiry of the mint quote invoice', () => {
        const invoice = new CashuInvoice({
            quote: 'quote-id',
            request: paymentRequest,
            mintUrl: 'https://mint.example.com'
        });
        invoice.determineFormattedOriginalTimeUntilExpiry('en');
        expect(invoice.formattedOriginalTimeUntilExpiry).toBe('1 hour');
    });

    it('formats "Never" when no expiry information is available', () => {
        const invoice = new CashuInvoice({
            quote: 'quote-id',
            request: '',
            mintUrl: 'https://mint.example.com'
        });
        invoice.determineFormattedOriginalTimeUntilExpiry('en');
        expect(invoice.formattedOriginalTimeUntilExpiry).toBe('Never');
    });
});
