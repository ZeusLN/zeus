import { settingsStore } from '../stores/Stores';
import { numberWithCommas } from './UnitsUtils';

export interface AmountDisplayResult {
    displayAmount: string;
    shouldShowRounding: boolean;
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
