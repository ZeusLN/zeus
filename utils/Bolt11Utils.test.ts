import Bolt11Utils from './Bolt11Utils';

describe('decode', () => {
    it('correctly decodes a valid payment request', () => {
        const paymentRequest =
            'lnbcrt1230n1pj429x7pp57t97q4awqj3f529snr0pa6senk83sq5pp760qf5a4jzvd7xgwcksdqqcqzzsxqrrsssp57eqtv7vxr46arupna3w4ct0lkf2mqmz9wt044cwkks0rwlnhfr5s9qyyssqragwpwav7nfwv2xyuuamxxj4pnnpzv2hlw7j473repd3sq7st698ta9kmzmygt0w7tmncl56a6mnma0w7e5dlpqd0wy6x3v35rssldspjhh8p0';

        const decoded = Bolt11Utils.decode(paymentRequest);

        expect(decoded.expiry).toBe(3600);
        expect(decoded.timestamp).toBe(1700074718);
        expect(decoded.paymentRequest).toBe(paymentRequest);
    });

    it('throws an error if an invalid payment request is given', () => {
        const paymentRequest =
            'bcrt1230n1pj429x7pp57t97q4awqj3f529snr0pa6senk83sq5pp760qf5a4jzvd7xgwcksdqqcqzzsxqrrsssp57eqtv7vxr46arupna3w4ct0lkf2mqmz9wt044cwkks0rwlnhfr5s9qyyssqragwpwav7nfwv2xyuuamxxj4pnnpzv2hlw7j473repd3sq7st698ta9kmzmygt0w7tmncl56a6mnma0w7e5dlpqd0wy6x3v35rssldspjhh8p0';

        const action = () => Bolt11Utils.decode(paymentRequest);

        expect(action).toThrowError('Not a proper lightning payment request');
    });
});
