import type { DecodedOffer } from '../ldknode/LdkNodeInjection';

import { getOfferPayBlockers } from './Bolt12OfferUtils';

const NOW = 1_800_000_000;

const offer = (overrides: Partial<DecodedOffer> = {}): DecodedOffer => ({
    offerId: 'offer-id',
    isExpired: false,
    expectsQuantity: false,
    ...overrides
});

describe('getOfferPayBlockers', () => {
    it('allows an amountless, unexpired offer', () => {
        const result = getOfferPayBlockers(offer(), '1000', NOW);
        expect(result).toEqual({
            isExpired: false,
            isFiatDenominated: false,
            expectsQuantity: false,
            isUnderpaying: false,
            offerAmountSats: undefined,
            cannotPay: false
        });
    });

    it('blocks when the native decode flagged the offer as expired', () => {
        const result = getOfferPayBlockers(
            offer({ isExpired: true }),
            '1000',
            NOW
        );
        expect(result.isExpired).toBe(true);
        expect(result.cannotPay).toBe(true);
    });

    it('blocks an offer that expired after it was decoded', () => {
        const result = getOfferPayBlockers(
            offer({ isExpired: false, absoluteExpirySeconds: NOW - 1 }),
            '1000',
            NOW
        );
        expect(result.isExpired).toBe(true);
        expect(result.cannotPay).toBe(true);
    });

    it('blocks at the exact expiry second', () => {
        const result = getOfferPayBlockers(
            offer({ absoluteExpirySeconds: NOW }),
            '1000',
            NOW
        );
        expect(result.cannotPay).toBe(true);
    });

    it('allows an offer whose expiry is still in the future', () => {
        const result = getOfferPayBlockers(
            offer({ absoluteExpirySeconds: NOW + 60 }),
            '1000',
            NOW
        );
        expect(result.isExpired).toBe(false);
        expect(result.cannotPay).toBe(false);
    });

    it('defaults to the current time', () => {
        const past = Math.floor(Date.now() / 1000) - 10;
        expect(
            getOfferPayBlockers(offer({ absoluteExpirySeconds: past }), '1000')
                .cannotPay
        ).toBe(true);
    });

    it('blocks a currency-denominated offer', () => {
        const result = getOfferPayBlockers(
            offer({
                amountType: 'currency',
                iso4217Code: 'USD',
                currencyAmount: 250
            }),
            '1000',
            NOW
        );
        expect(result.isFiatDenominated).toBe(true);
        expect(result.offerAmountSats).toBeUndefined();
        expect(result.cannotPay).toBe(true);
    });

    it('blocks an offer that expects a quantity', () => {
        const result = getOfferPayBlockers(
            offer({ expectsQuantity: true }),
            '1000',
            NOW
        );
        expect(result.expectsQuantity).toBe(true);
        expect(result.cannotPay).toBe(true);
    });

    it('blocks an amount below the offer amount', () => {
        const result = getOfferPayBlockers(
            offer({ amountType: 'bitcoin', amountMsats: 3_000_000 }),
            '2999',
            NOW
        );
        expect(result.isUnderpaying).toBe(true);
        expect(result.offerAmountSats).toBe(3000);
        expect(result.cannotPay).toBe(true);
    });

    it('allows an amount equal to the offer amount', () => {
        const result = getOfferPayBlockers(
            offer({ amountType: 'bitcoin', amountMsats: 3_000_000 }),
            3000,
            NOW
        );
        expect(result.isUnderpaying).toBe(false);
        expect(result.cannotPay).toBe(false);
    });

    it('rounds a sub-sat offer amount up for display and still blocks underpaying', () => {
        const result = getOfferPayBlockers(
            offer({ amountType: 'bitcoin', amountMsats: 3_000_500 }),
            '3000',
            NOW
        );
        expect(result.offerAmountSats).toBe(3001);
        expect(result.isUnderpaying).toBe(true);
        expect(
            getOfferPayBlockers(
                offer({ amountType: 'bitcoin', amountMsats: 3_000_500 }),
                '3001',
                NOW
            ).cannotPay
        ).toBe(false);
    });
});
