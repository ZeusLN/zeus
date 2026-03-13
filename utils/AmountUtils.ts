import BigNumber from 'bignumber.js';

import { settingsStore, fiatStore, unitsStore } from '../stores/Stores';
import {
    numberWithCommas,
    numberWithDecimals,
    SATS_PER_BTC
} from './UnitsUtils';
import type { Units } from './UnitsUtils';
import FeeUtils from './FeeUtils';
import { localeString } from './LocaleUtils';

export interface AmountDisplayResult {
    displayAmount: string;
    shouldShowRounding: boolean;
}

export interface ValueDisplayProps {
    amount: string;
    unit: Units;
    symbol?: string;
    negative?: boolean;
    plural?: boolean;
    rtl?: boolean;
    space?: boolean;
    error?: string;
    separatorSwap?: boolean;
}

/**
 * Processes satoshi amounts for display, respecting the hideMsats setting
 * and optional rounding behavior.
 *
 * @param amount - The amount to process (as string or number)
 * @param roundAmount - Whether to apply rounding logic (default: false)
 * @returns Object containing the display amount and whether to show rounding indicator
 */
export function processSatsAmount(
    amount: string | number,
    roundAmount: boolean = false
): AmountDisplayResult {
    const amountStr = amount.toString();
    const hideMsats = shouldHideMillisatoshiAmounts();

    // Remove commas from the amount string for processing
    const cleanAmountStr = amountStr.replace(/,/g, '');

    // Always check for decimals when hideMsats is enabled
    const [, decimalPart] = cleanAmountStr.split('.');
    const hasDecimals = decimalPart && Number(decimalPart) > 0;

    // Determine if we should round based on hideMsats setting or explicit roundAmount
    // When hideMsats is false (showMillisatoshiAmounts is true), never round (respect the setting)
    // When hideMsats is true (showMillisatoshiAmounts is false), always round decimals
    // Only apply explicit roundAmount when hideMsats is true
    const shouldRound =
        hasDecimals && (hideMsats || (roundAmount && hideMsats));

    let displayAmount: string;

    if (shouldRound) {
        // Round the number and format with commas
        const roundedNumber = Math.round(Number(cleanAmountStr));
        displayAmount = numberWithCommas(roundedNumber);
    } else {
        // Format the original amount with commas
        displayAmount = numberWithCommas(cleanAmountStr);
    }

    // Only show rounding indicator when explicitly requested via roundAmount prop
    const shouldShowRounding = Boolean(shouldRound && roundAmount);

    return {
        displayAmount,
        shouldShowRounding
    };
}

/**
 * Checks if the hideMsats setting is enabled
 * @returns true if millisatoshi amounts should be hidden
 */
export function shouldHideMillisatoshiAmounts(): boolean {
    return !settingsStore?.settings?.display?.showMillisatoshiAmounts;
}

/**
 * Gets the fiat entry from fiatStore for a given currency code
 * @param currencyCode - The currency code to look up (e.g., 'USD', 'EUR')
 * @returns The fiat entry object or undefined if not found
 */
function getFiatEntry(currencyCode: string): any | undefined {
    if (!fiatStore.fiatRates || !currencyCode) {
        return undefined;
    }
    return fiatStore.fiatRates.find(
        (entry: any) => entry.code === currencyCode
    );
}

/**
 * Converts satoshi amounts to unformatted display values based on the current unit setting
 * @param sats - The amount in satoshis (string or number)
 * @param fixedUnits - Optional unit override ('sats', 'BTC', or 'fiat')
 * @returns Object containing the amount string, unit, and display properties
 */
export function getUnformattedAmount({
    sats = 0,
    fixedUnits
}: {
    sats?: string | number;
    fixedUnits?: string;
}): ValueDisplayProps {
    const { settings } = settingsStore;
    const { fiat, display } = settings;
    const showAllDecimalPlaces: boolean =
        (display && display.showAllDecimalPlaces) || false;
    const effectiveUnits = fixedUnits || unitsStore.units;

    const satsNumber = Number(sats);
    const negative = satsNumber < 0;
    const absValueSats = Math.abs(satsNumber);

    if (effectiveUnits === 'BTC') {
        return {
            amount: FeeUtils.toFixed(
                absValueSats / SATS_PER_BTC,
                showAllDecimalPlaces
            ),
            unit: 'BTC',
            negative,
            space: false
        };
    } else if (effectiveUnits === 'sats') {
        return {
            amount: absValueSats.toString(),
            unit: 'sats',
            negative,
            plural: !(satsNumber === 1 || satsNumber === -1)
        };
    } else {
        const currency = fiat;

        // TODO: is this the right place to catch this?
        if (!currency) {
            return {
                amount: localeString('general.disabled'),
                unit: 'fiat',
                symbol: '$'
            };
        }

        if (fiatStore.fiatRates) {
            const fiatEntry = getFiatEntry(fiat);

            if (!fiatEntry?.rate) {
                return {
                    amount: localeString('general.disabled'),
                    unit: 'fiat',
                    error: localeString('general.fiatRateNotAvailable')
                };
            }

            const rate = (fiatEntry && fiatEntry.rate) || 0;
            const { symbol, space, rtl, decimalPlaces, separatorSwap } =
                fiatStore.getSymbol();

            const decimals = decimalPlaces !== undefined ? decimalPlaces : 2;

            const amount = (
                FeeUtils.toFixed(absValueSats / SATS_PER_BTC) * rate
            ).toFixed(decimals);

            return {
                amount,
                unit: 'fiat',
                symbol,
                negative,
                plural: false,
                rtl,
                space,
                separatorSwap
            };
        } else {
            return {
                amount: localeString('general.disabled'),
                unit: 'fiat',
                error: localeString('general.errorFetchingFiatRates')
            };
        }
    }
}

/**
 * Converts satoshi amounts to formatted display strings
 * @param value - The amount in satoshis (string or number)
 * @param fixedUnits - Optional unit override ('sats', 'BTC', or 'fiat')
 * @returns Formatted string like "₿0.5", "1,000 sats", or "$50.00"
 */
export function getAmountFromSats(
    value: string | number = 0,
    fixedUnits?: string
): string | undefined {
    const { settings } = settingsStore;
    const { fiat } = settings;
    const units = fixedUnits || unitsStore.units;

    const [wholeSats] = value.toString().split('.');
    if (units === 'BTC') {
        // handle negative values
        const valueToProcess = (wholeSats && wholeSats.toString()) || '0';
        if (valueToProcess.includes('-')) {
            const processedValue = valueToProcess.split('-')[1];
            return `-₿${FeeUtils.toFixed(
                Number(processedValue) / SATS_PER_BTC
            )}`;
        }

        return `₿${FeeUtils.toFixed(Number(wholeSats || 0) / SATS_PER_BTC)}`;
    } else if (units === 'sats') {
        const sats = `${numberWithCommas(wholeSats || value) || 0} ${
            Number(value) === 1 || Number(value) === -1 ? 'sat' : 'sats'
        }`;
        return sats;
    } else if (units === 'fiat' && fiat) {
        if (fiatStore.fiatRates) {
            const fiatEntry = getFiatEntry(fiat);
            if (!fiatEntry) {
                return localeString('general.notAvailable');
            }
            const { code } = fiatEntry;
            const rate = (fiatEntry && fiatEntry.rate) || 0;
            const { symbol, space, rtl, separatorSwap } =
                fiatStore.symbolLookup(code);

            const amount = (
                FeeUtils.toFixed(Number(wholeSats || 0) / SATS_PER_BTC) * rate
            ).toFixed(2);

            const formattedAmount = separatorSwap
                ? numberWithDecimals(amount)
                : numberWithCommas(amount);

            if (rtl) {
                return `${formattedAmount}${space ? ' ' : ''}${symbol}`;
            } else {
                return `${symbol}${space ? ' ' : ''}${formattedAmount}`;
            }
        } else {
            return localeString('general.notAvailable');
        }
    }
}

/**
 * Formats amounts for display (expects BTC value directly for BTC unit, not sats)
 * @param value - The amount (string or number). For BTC unit, this should be in BTC, not sats.
 * @param fixedUnits - Optional unit override ('sats', 'BTC', or 'fiat')
 * @returns Formatted string like "₿0.5", "1,000 sats", or "$50.00"
 */
export function getFormattedAmount(
    value: string | number = 0,
    fixedUnits?: string
): string | undefined {
    const { settings } = settingsStore;
    const { fiat } = settings;
    const units = fixedUnits || unitsStore.units;

    if (units === 'BTC') {
        // handle negative values
        const valueToProcess = value.toString() || '0';
        if (valueToProcess.includes('-')) {
            const processedValue = valueToProcess.split('-')[1];
            return `-₿${FeeUtils.toFixed(Number(processedValue))}`;
        }

        return `₿${FeeUtils.toFixed(Number(value || 0))}`;
    } else if (units === 'sats') {
        const [wholeSats] = value.toString().split('.');
        const sats = `${numberWithCommas(wholeSats || value) || 0} ${
            Number(value) === 1 || Number(value) === -1 ? 'sat' : 'sats'
        }`;
        return sats;
    } else if (units === 'fiat' && fiat) {
        if (fiatStore.fiatRates) {
            const fiatEntry = getFiatEntry(fiat);
            if (!fiatEntry) {
                return localeString('general.notAvailable');
            }
            const { code } = fiatEntry;
            const { symbol, space, rtl, separatorSwap } =
                fiatStore.symbolLookup(code);

            // handle amounts passed in with commas
            const amount = Number(value.toString().replace(/,/g, '.')).toFixed(
                2
            );

            const formattedAmount = separatorSwap
                ? numberWithDecimals(amount)
                : numberWithCommas(amount);

            if (rtl) {
                return `${formattedAmount}${space ? ' ' : ''}${symbol}`;
            } else {
                return `${symbol}${space ? ' ' : ''}${formattedAmount}`;
            }
        } else {
            return localeString('general.notAvailable');
        }
    }
}

/**
 * Calculates the fee as a percentage of the payment amount.
 * Returns a string like "1.5%" or empty string if not applicable.
 *
 * @param fee - The fee amount (string or number)
 * @param amount - The payment amount (string or number)
 * @returns Formatted percentage string (e.g., "1.5%") or empty string
 */
export function getFeePercentage(
    fee: string | number | undefined,
    amount: string | number | undefined
): string {
    if (!fee || !amount || fee == '0' || amount == '0') return '';

    return (
        Number(new BigNumber(fee).div(amount).times(100).toFixed(3))
            .toString()
            .replace(/-/g, '') + '%'
    );
}

/**
 * Converts satoshis to millisatoshis
 * @param sats - Amount in satoshis
 * @returns Amount in millisatoshis
 */
export function satsToMillisats(sats: number): number {
    return Math.floor(sats * 1000);
}

/**
 * Converts millisatoshis to satoshis
 * @param millisats - Amount in millisatoshis
 * @returns Amount in satoshis
 */
export function millisatsToSats(millisats: number): number {
    return Math.floor(millisats / 1000);
}

/**
 * Normalizes number strings with different regional formats to a standard format.
 *
 * - If both dots and commas are present, the last one is the decimal separator.
 * - If only one separator is present, it's a decimal separator unless it's followed by exactly 3 digits (then it's a thousand separator).
 * - If multiple separators of the same kind are present, they are all treated as thousand separators.
 *
 * Examples:
 * - 1,234 -> 1234
 * - 1,234.56 -> 1234.56
 * - 1.234,56 -> 1234.56
 * - 1.234.567 -> 1234567
 *
 * @param value - The value to normalize (string or number)
 * @returns Normalized number string with . as decimal separator
 */
export function normalizeNumberString(value: string | number): string {
    if (value === null || value === undefined || value === '') return '0';

    let s = value.toString().trim();

    const isNeg = s.startsWith('-');
    if (isNeg) s = s.slice(1);

    const commaCnt = (s.match(/,/g) || []).length;
    const dotCnt = (s.match(/\./g) || []).length;

    let decimalSeparator: ',' | '.' | null = null;

    if (commaCnt > 0 && dotCnt > 0) {
        decimalSeparator = s.lastIndexOf(',') > s.lastIndexOf('.') ? ',' : '.';
    } else if (commaCnt === 1 && dotCnt === 0) {
        const lastCommaIdx = s.lastIndexOf(',');
        const digitsAfterComma = s.length - lastCommaIdx - 1;
        if (digitsAfterComma !== 3) {
            decimalSeparator = ',';
        }
    } else if (dotCnt === 1 && commaCnt === 0) {
        const lastDotIdx = s.lastIndexOf('.');
        const digitsAfterDot = s.length - lastDotIdx - 1;
        if (digitsAfterDot !== 3) {
            decimalSeparator = '.';
        }
    }

    if (decimalSeparator) {
        const [intPart, decPart] = s.split(decimalSeparator);
        const int = intPart.replace(/[^\d]/g, '');
        const dec = decPart.replace(/[^\d]/g, '');
        s = dec ? `${int}.${dec}` : int;
    } else {
        s = s.replace(/[^\d]/g, '');
    }

    if (!s) s = '0';
    return isNeg ? `-${s}` : s;
}

/**
 * Converts an amount in the current display unit (sats, BTC, or fiat) to satoshis
 * @param amount - The amount to convert (as string or number)
 * @param forceUnit - Optional unit override ('sats', 'BTC', or 'fiat')
 * @returns The amount in satoshis
 */
export function getSatAmount(
    amount: string | number,
    forceUnit?: string
): number {
    const { fiatRates } = fiatStore;
    const { settings } = settingsStore;
    const { fiat } = settings;
    const { units } = unitsStore;
    const effectiveUnits = forceUnit || units;

    const value = Number(normalizeNumberString(amount));

    const fiatEntry =
        fiat && fiatRates
            ? fiatRates.find((entry: any) => entry.code === fiat)
            : null;

    const rate = fiat && fiatRates && fiatEntry ? fiatEntry.rate : 0;

    let satAmount: number = 0;
    switch (effectiveUnits) {
        case 'sats':
            satAmount = Number(value);
            break;
        case 'BTC':
            satAmount = new BigNumber(value || 0)
                .multipliedBy(SATS_PER_BTC)
                .toNumber();
            break;
        case 'fiat':
            satAmount =
                rate && value
                    ? Number(
                          new BigNumber(value)
                              .dividedBy(rate)
                              .multipliedBy(SATS_PER_BTC)
                              .toNumber()
                              .toFixed(0)
                      )
                    : 0;
            break;
        default:
            satAmount = 0;
            break;
    }

    return satAmount;
}
