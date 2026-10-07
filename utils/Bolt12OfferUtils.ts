import type { DecodedOffer } from '../ldknode/LdkNodeInjection';

export interface OfferPayBlockers {
    isExpired: boolean;
    isFiatDenominated: boolean;
    expectsQuantity: boolean;
    isUnderpaying: boolean;
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

    return {
        isExpired,
        isFiatDenominated,
        expectsQuantity,
        isUnderpaying,
        offerAmountSats,
        cannotPay:
            isExpired || isFiatDenominated || expectsQuantity || isUnderpaying
    };
};
