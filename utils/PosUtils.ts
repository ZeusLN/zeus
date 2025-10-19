import BigNumber from 'bignumber.js';
import { SATS_PER_BTC } from './UnitsUtils';
import { LineItem } from '../models/Order';

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

/**
 * Calculates tax in sats based on line items and global tax settings.
 *
 * @param lineItems - Array of items in the order
 * @param subTotalSats - The subtotal of the order in sats
 * @param rate - The current fiat conversion rate
 * @param taxPercentage - The global tax percentage
 * @returns - The calculated tax in sats as a string
 */
export const calculateTaxSats = (
    lineItems: Array<LineItem>,
    subTotalSats: string | number | undefined,
    rate: number | string,
    taxPercentage?: string
): string => {
    const hasIndividualTaxRates = lineItems?.some((item) => item.taxPercentage);

    if (hasIndividualTaxRates) {
        let totalTaxSats = new BigNumber(0);
        lineItems?.forEach((item) => {
            const itemTaxRate = item.taxPercentage || taxPercentage || '0';
            const validTaxRate = itemTaxRate || '0';
            const fiatPriced = item.base_price_money.amount > 0;

            let itemSubtotalSats: string;

            if (fiatPriced) {
                let fiatAmount = new BigNumber(
                    item.base_price_money.amount
                ).multipliedBy(item.quantity);
                itemSubtotalSats = fiatAmount
                    .div(rate)
                    .multipliedBy(SATS_PER_BTC)
                    .integerValue(BigNumber.ROUND_HALF_UP)
                    .toFixed(0);
            } else {
                itemSubtotalSats = new BigNumber(
                    item.base_price_money.sats || 0
                )
                    .multipliedBy(item.quantity)
                    .toFixed(0);
            }

            const itemTaxSats = new BigNumber(itemSubtotalSats)
                .multipliedBy(new BigNumber(validTaxRate))
                .dividedBy(100)
                .integerValue(BigNumber.ROUND_HALF_UP)
                .toFixed(0);

            totalTaxSats = totalTaxSats.plus(itemTaxSats);
        });

        return totalTaxSats.toFixed(0);
    } else {
        return new BigNumber(subTotalSats || 0)
            .multipliedBy(new BigNumber(taxPercentage || '0'))
            .dividedBy(100)
            .integerValue(BigNumber.ROUND_HALF_UP)
            .toFixed(0);
    }
};
