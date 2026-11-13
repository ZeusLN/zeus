import type { DecodedOffer } from '../ldknode/LdkNodeInjection';

export interface OfferPayBlockers {
    isExpired: boolean;
    isFiatDenominated: boolean;
    expectsQuantity: boolean;
    isUnderpaying: boolean;
    isMissingAmount: boolean;
    offerAmountSats?: number;
    cannotPay: boolean;
}

// ldk-node rejects each of these locally, before any invoice_request
// leaves the device, so callers fail closed rather than let the user swipe
// into a guaranteed error:
//   expired offer               -> Bolt12SemanticError::AlreadyExpired
//   currency-denominated offer  -> Error::UnsupportedCurrency
//   offer expecting a quantity  -> Bolt12SemanticError::MissingQuantity
//     (payOffer never sends one)
//   amount below the offer's    -> Error::InvalidAmount
//
// A zero amount is not one of them: ldk-node accepts Some(0) for an
// amountless offer, so a zero, empty or unparseable amount is blocked here.
// On an offer with an amount, a zero amount is reported as underpaying.
//
// The native isExpired flag is taken at decode time, so expiry is
// re-evaluated against the current time to cover a review screen left open
// past the offer's absolute expiry
export const getOfferPayBlockers = (
    decodedOffer: DecodedOffer,
    satAmount: string | number,
    nowSeconds: number = Date.now() / 1000
): OfferPayBlockers => {
    const isExpired =
        decodedOffer.isExpired ||
        (decodedOffer.absoluteExpirySeconds != null &&
            nowSeconds >= decodedOffer.absoluteExpirySeconds);
    const offerAmountMsats =
        decodedOffer.amountType === 'bitcoin'
            ? decodedOffer.amountMsats
            : undefined;
    const offerAmountSats = offerAmountMsats
        ? Math.ceil(offerAmountMsats / 1000)
        : undefined;
    const isFiatDenominated = decodedOffer.amountType === 'currency';
    const expectsQuantity = decodedOffer.expectsQuantity;
    const isUnderpaying =
        offerAmountMsats != null && Number(satAmount) * 1000 < offerAmountMsats;
    const isMissingAmount = !(Number(satAmount) > 0) && !isUnderpaying;

    return {
        isExpired,
        isFiatDenominated,
        expectsQuantity,
        isUnderpaying,
        isMissingAmount,
        offerAmountSats,
        cannotPay:
            isExpired ||
            isFiatDenominated ||
            expectsQuantity ||
            isUnderpaying ||
            isMissingAmount
    };
};
