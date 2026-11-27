import BigNumber from 'bignumber.js';
import { SATS_PER_BTC } from './BitcoinConstants';
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

/**
 * Calculates the subtotal of a standalone order in sats from its line items:
 * sats-priced items at their sats price and fiat-priced items converted at
 * the given rate. The order's stored total_money.sats leaves out fiat-priced
 * items that were added without a rate, so it can't be used for an order
 * that mixes the two. Without a usable rate a fiat-priced item makes the
 * subtotal Infinity or NaN, so the order can't be invoiced.
 *
 * @param lineItems - Array of items in the order, with fiat prices in major units
 * @param rate - The current fiat conversion rate
 * @returns - The subtotal in sats as a string
 */
export const calculateSubTotalSats = (
    lineItems: Array<LineItem>,
    rate: number | string
): string =>
    (lineItems || [])
        .reduce((subTotal: BigNumber, item: LineItem) => {
            const itemSats =
                item.base_price_money.amount > 0
                    ? new BigNumber(item.base_price_money.amount)
                          .div(rate)
                          .multipliedBy(SATS_PER_BTC)
                    : new BigNumber(item.base_price_money.sats || 0);
            return subTotal.plus(itemSats.multipliedBy(item.quantity));
        }, new BigNumber(0))
        .toFixed(0);

/**
 * Whether an order total can be invoiced: a finite, positive whole number
 * of sats. A missing or zero fiat rate yields 0, NaN or Infinity here.
 *
 * @param sats - The order total in sats
 * @returns - true if an invoice can be created for this amount
 */
export const isPayableSatsAmount = (
    sats: string | number | undefined
): boolean => {
    const amount = new BigNumber(sats ?? NaN);
    return amount.isFinite() && amount.isInteger() && amount.gt(0);
};

/**
 * Fiat amounts for the order screen when there is no usable fiat rate.
 * Without a rate the sats amounts are Infinity or NaN, and converting them
 * back to fiat gives NaN, so these come from the order's own fiat totals,
 * which are in cents. A value is undefined when it needs a rate: an order
 * with sats-priced items, or a tip entered in sats or BTC.
 *
 * @param order - The order, with total_money and total_tax_money in cents
 * @param includesTax - Whether total_money already includes the tax (Square)
 * @param tip - The tip as a percentage of the subtotal, or as a fiat amount
 * @returns - The subtotal, tax, tip and total in fiat, with two decimals
 */
export const calculateFiatAmountsWithoutRate = (
    order: {
        line_items?: Array<LineItem>;
        total_money?: { amount: number };
        total_tax_money?: { amount: number };
    },
    includesTax: boolean,
    tip: { percentage?: string; fiat?: string }
): {
    subTotalFiat?: string;
    taxFiat?: string;
    tipFiat?: string;
    totalFiat?: string;
} => {
    const fiatPriced = (order?.line_items || []).every(
        (item) => item.base_price_money.amount > 0
    );

    let subTotal = new BigNumber(NaN);
    let tax = new BigNumber(NaN);
    if (fiatPriced) {
        tax = new BigNumber(order?.total_tax_money?.amount ?? NaN).div(100);
        subTotal = new BigNumber(order?.total_money?.amount ?? NaN)
            .div(100)
            .minus(includesTax ? tax : 0);
    }

    const tipAmount =
        tip.percentage !== undefined
            ? subTotal.multipliedBy(tip.percentage).div(100)
            : new BigNumber(tip.fiat ?? NaN);

    const toFiat = (amount: BigNumber) =>
        amount.isFinite() ? amount.toFixed(2) : undefined;

    return {
        subTotalFiat: toFiat(subTotal),
        taxFiat: toFiat(tax),
        tipFiat: toFiat(tipAmount),
        totalFiat: toFiat(subTotal.plus(tax).plus(tipAmount))
    };
};
