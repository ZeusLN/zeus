import BigNumber from 'bignumber.js';

/**
 * Calculates total sats including tip percentage and tax.
 *
 * @param subTotalSats - The base amount in sats
 * @param tipPercentage - Tip percentage to apply
 * @param taxSats - Tax amount in sats
 * @returns - Total sats after applying tip and tax
 */
export const calculateTotalSats = (
    subTotalSats: string,
    tipPercentage: string,
    taxSats: string
): string => {
    const subtotal = new BigNumber(subTotalSats);
    const tip = new BigNumber(tipPercentage).div(100);

    return subtotal
        .multipliedBy(new BigNumber(1).plus(tip))
        .plus(taxSats)
        .toFixed(0);
};
