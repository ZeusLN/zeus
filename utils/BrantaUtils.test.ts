import {
    onchainSendNavigationParams,
    paymentRequestNavigationParams
} from './BrantaUtils';
import type { BrantaVerification } from '../stores/BrantaStore';

const VERIFICATION: BrantaVerification = {
    platform: 'Peony Lane',
    platformLogoUrl: 'https://guardrail.branta.pro/logo.png',
    verifyUrl: 'https://guardrail.branta.pro/v2/verify/abc'
};

describe('onchainSendNavigationParams', () => {
    const base = {
        destination: 'bc1q7065ezyhcd3qtqlcvwcmp9t2weaxc4sguuvlwu',
        satAmount: '170003',
        fee: 'fastestFee'
    };

    it('sets isValid and brantaVerification so Send does not re-parse a stripped address', () => {
        expect(
            onchainSendNavigationParams({
                ...base,
                brantaVerification: VERIFICATION
            })
        ).toEqual({
            ...base,
            transactionType: 'On-chain',
            isValid: true,
            brantaVerification: VERIFICATION
        });
    });

    it('omits isValid when there is no verification (non-Branta unified or failed lookup)', () => {
        expect(onchainSendNavigationParams(base)).toEqual({
            ...base,
            transactionType: 'On-chain'
        });
        expect(
            onchainSendNavigationParams({
                ...base,
                brantaVerification: null
            })
        ).toEqual({
            ...base,
            transactionType: 'On-chain'
        });
    });
});

describe('paymentRequestNavigationParams', () => {
    it('forwards a successful verification onto PaymentRequest', () => {
        expect(paymentRequestNavigationParams(VERIFICATION)).toEqual({
            brantaVerification: VERIFICATION
        });
    });

    it('forwards null when lookup found nothing', () => {
        expect(paymentRequestNavigationParams(null)).toEqual({
            brantaVerification: null
        });
    });
});
