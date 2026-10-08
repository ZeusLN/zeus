jest.mock('../stores/Stores', () => ({}));

import ForwardEvent from './ForwardEvent';

describe('ForwardEvent.feeSat', () => {
    it('converts fee_msat to sats', () => {
        expect(new ForwardEvent({ fee: '1', fee_msat: '1500' }).feeSat).toBe(
            1.5
        );
    });

    it('reads numeric CLN fee_msat', () => {
        expect(new ForwardEvent({ fee_msat: 2000 }).feeSat).toBe(2);
    });

    it('keeps a zero fee_msat instead of falling back to fee', () => {
        expect(new ForwardEvent({ fee: '7', fee_msat: '0' }).feeSat).toBe(0);
    });

    it('falls back to fee in sats when fee_msat is missing', () => {
        expect(new ForwardEvent({ fee: '2' }).feeSat).toBe(2);
    });

    it('returns 0 when neither fee field is present', () => {
        expect(new ForwardEvent({}).feeSat).toBe(0);
    });
});
