import { settingsStore, fiatStore, unitsStore } from '../stores/Stores';
import { numberWithCommas, SATS_PER_BTC } from './UnitsUtils';
import FeeUtils from './FeeUtils';

export interface AmountDisplayResult {
    displayAmount: string;
    shouldShowRounding: boolean;
}

type Units = 'sats' | 'BTC' | 'fiat';

export interface ValueDisplayProps {
    amount: string;
    unit: Units;
    symbol?: string;
    negative?: boolean;
    plural?: boolean;
    rtl?: boolean;
    space?: boolean;
    error?: string;
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
                amount: 'Disabled',
                unit: 'fiat',
                symbol: '$'
            };
        }

        if (fiatStore.fiatRates) {
            const fiatEntry = fiatStore.fiatRates.filter(
                (entry: any) => entry.code === fiat
            )[0];

            if (!fiatEntry?.rate) {
                return {
                    amount: 'Disabled',
                    unit: 'fiat',
                    error: 'Rate for selected currency not available'
                };
            }

            const rate = (fiatEntry && fiatEntry.rate) || 0;
            const { symbol, space, rtl, decimalPlaces } = fiatStore.getSymbol();

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
                space
            };
        } else {
            return {
                amount: 'Disabled',
                unit: 'fiat',
                error: 'Error fetching fiat rates'
            };
        }
    }
}
