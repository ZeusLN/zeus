import { Animated } from 'react-native';
import BigNumber from 'bignumber.js';

import FiatStore from '../stores/FiatStore';
import SettingsStore from '../stores/SettingsStore';

import type { Units } from './UnitsUtils';

/**
 * Returns the maximum number of decimal places allowed for the current unit.
 * - sats: 3 decimal places (millisats)
 * - BTC: 8 decimal places
 * - fiat: varies by currency (typically 2, some currencies have 0)
 */
export const getDecimalLimit = (
    units: Units | string,
    fiatStore: FiatStore,
    settingsStore: SettingsStore
): number | null => {
    if (units === 'fiat') {
        const fiat = settingsStore.settings?.fiat || '';
        const fiatProperties = fiatStore.symbolLookup(fiat);
        return fiatProperties?.decimalPlaces !== undefined
            ? fiatProperties.decimalPlaces
            : 2;
    }
    if (units === 'sats') return 3;
    if (units === 'BTC') return 8;
    return null;
};

/**
 * Validates keypad input and returns whether the input is valid and the new amount.
 * Handles:
 * - Decimal place limits based on unit
 * - BTC integer part length limit (8 figures)
 * - Single decimal point enforcement
 * - Maximum capacity checks (21M BTC, 2.1 quadrillion sats)
 */
export const validateKeypadInput = (
    currentAmount: string,
    inputValue: string,
    units: Units | string,
    fiatStore: FiatStore,
    settingsStore: SettingsStore
): { valid: boolean; newAmount: string } => {
    const decimalLimit = getDecimalLimit(units, fiatStore, settingsStore);
    const [integerPart, decimalPart] = currentAmount.split('.');

    // Limit decimal places depending on units
    if (
        decimalPart &&
        decimalLimit !== null &&
        decimalPart.length >= decimalLimit
    ) {
        return { valid: false, newAmount: currentAmount };
    }

    // For BTC: deny if trying to add more than 8 figures before decimal
    if (units === 'BTC') {
        if (
            !decimalPart &&
            integerPart &&
            integerPart.length === 8 &&
            !currentAmount.includes('.') &&
            inputValue !== '.'
        ) {
            return { valid: false, newAmount: currentAmount };
        }
    }

    // For sats: deny if trying to add more than 12 figures before decimal
    if (units === 'sats') {
        if (
            !decimalPart &&
            integerPart &&
            integerPart.length >= 12 &&
            !currentAmount.includes('.') &&
            inputValue !== '.'
        ) {
            return { valid: false, newAmount: currentAmount };
        }
    }

    // For fiat: deny if trying to add more than 10 figures before decimal
    if (units === 'fiat') {
        if (
            !decimalPart &&
            integerPart &&
            integerPart.length >= 10 &&
            !currentAmount.includes('.') &&
            inputValue !== '.'
        ) {
            return { valid: false, newAmount: currentAmount };
        }
    }

    // Only allow one decimal, unless currency has zero decimal places
    if (
        inputValue === '.' &&
        (currentAmount.includes('.') || decimalLimit === 0)
    ) {
        return { valid: false, newAmount: currentAmount };
    }

    const proposedNewAmountStr = `${currentAmount}${inputValue}`;
    const proposedNewAmount = new BigNumber(proposedNewAmountStr);

    // Deny if exceeding BTC 21 million capacity
    if (units === 'BTC' && proposedNewAmount.gt(21000000)) {
        return { valid: false, newAmount: currentAmount };
    }
    if (units === 'sats' && proposedNewAmount.gt(2100000000000000)) {
        return { valid: false, newAmount: currentAmount };
    }

    // Determine new amount
    let newAmount: string;
    if (currentAmount === '0') {
        newAmount = inputValue === '.' ? '0.' : inputValue;
    } else {
        newAmount = proposedNewAmountStr;
    }

    return { valid: true, newAmount };
};

/**
 * Calculate font size for amount display based on length.
 * @param amountLength - Length of the amount string
 * @param placeholderCount - Number of placeholder characters
 * @param options.compact - Use smaller sizes (for POS view with additional UI elements)
 * @param options.needInbound - Reduce sizes for LSP inbound capacity warning
 */
export const getAmountFontSize = (
    amountLength: number,
    placeholderCount: number,
    options: { compact?: boolean; needInbound?: boolean } = {}
): number => {
    const { compact = false, needInbound = false } = options;
    const totalLength = amountLength + placeholderCount;

    if (compact) {
        switch (totalLength) {
            case 1:
            case 2:
                return 80;
            case 3:
            case 4:
                return 65;
            case 5:
            case 6:
                return 55;
            case 7:
                return 50;
            case 8:
                return 45;
            default:
                return 35;
        }
    }

    // Standard sizing with optional inbound adjustment
    switch (totalLength) {
        case 1:
        case 2:
        case 3:
        case 4:
            return needInbound ? 70 : 80;
        case 5:
            return needInbound ? 65 : 75;
        case 6:
            return needInbound ? 60 : 65;
        case 7:
            return needInbound ? 55 : 60;
        case 8:
            return needInbound ? 50 : 55;
        case 9:
            return needInbound ? 45 : 50;
        default:
            return needInbound ? 40 : 45;
    }
};

export interface KeypadAnimationRefs {
    textAnimationRef: Animated.CompositeAnimation | null;
    shakeAnimationRef: Animated.CompositeAnimation | null;
}

export const resetKeypadTextAnimation = (
    textAnimation: Animated.Value,
    refs: KeypadAnimationRefs
): void => {
    if (refs.textAnimationRef) {
        refs.textAnimationRef.stop();
        refs.textAnimationRef = null;
    }
    textAnimation.setValue(0);
};

export const stopKeypadShakeAnimation = (refs: KeypadAnimationRefs): void => {
    if (refs.shakeAnimationRef) {
        refs.shakeAnimationRef.stop();
        refs.shakeAnimationRef = null;
    }
};

export const resetAllKeypadAnimations = (
    shakeAnimation: Animated.Value,
    textAnimation: Animated.Value,
    refs: KeypadAnimationRefs
): void => {
    resetKeypadTextAnimation(textAnimation, refs);
    stopKeypadShakeAnimation(refs);
    shakeAnimation.setValue(0);
};

export const startKeypadInvalidInputAnimation = (
    shakeAnimation: Animated.Value,
    textAnimation: Animated.Value,
    refs: KeypadAnimationRefs
): void => {
    resetKeypadTextAnimation(textAnimation, refs);
    stopKeypadShakeAnimation(refs);

    // This animates text color (text -> red), and color is not supported
    // by the RN Animated native driver. This is why useNativeDriver is false.
    refs.textAnimationRef = Animated.sequence([
        Animated.timing(textAnimation, {
            toValue: 1,
            duration: 100,
            useNativeDriver: false
        }),
        Animated.timing(textAnimation, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: false
        })
    ]);

    refs.shakeAnimationRef = Animated.sequence([
        Animated.timing(shakeAnimation, {
            toValue: 10,
            duration: 100,
            useNativeDriver: true
        }),
        Animated.timing(shakeAnimation, {
            toValue: -10,
            duration: 100,
            useNativeDriver: true
        }),
        Animated.timing(shakeAnimation, {
            toValue: 10,
            duration: 100,
            useNativeDriver: true
        }),
        Animated.timing(shakeAnimation, {
            toValue: 0,
            duration: 100,
            useNativeDriver: true
        })
    ]);

    Animated.parallel([refs.textAnimationRef, refs.shakeAnimationRef]).start(
        () => {
            refs.textAnimationRef = null;
            refs.shakeAnimationRef = null;
        }
    );
};

/**
 * Deletes the last character from the amount string.
 * Returns '0' if the amount would become empty.
 */
export const deleteLastCharacter = (amount: string): string => {
    if (amount.length === 1) {
        return '0';
    }
    return amount.substring(0, amount.length - 1);
};

/**
 * Parses a free-form clipboard string into a keypad-compatible amount in the
 * given unit. Strips currency symbols, unit suffixes ("sats", "BTC", ...) and
 * thousands separators, honours the decimal separator implied by the active
 * currency (e.g. "1.234,56" for EUR), truncates excess decimal places, and
 * enforces the same integer-length and capacity caps as keypad entry.
 *
 * Returns null when the clipboard does not contain a usable numeric amount.
 */
export const parseClipboardAmount = (
    clipboardValue: string,
    units: Units | string,
    fiatStore: FiatStore,
    settingsStore: SettingsStore
): string | null => {
    if (!clipboardValue) return null;

    // Reject clipboard content that obviously isn't a number — e.g. BOLT11
    // invoices, on-chain addresses, or BIP-21 URIs would otherwise have their
    // alphabetic chars stripped and the leftover digits parsed as an amount.
    // Strip recognised unit/currency labels first so "100 USD" or "50000 sats"
    // pass the alphabetic-content check.
    let withoutUnitLabels = clipboardValue.replace(
        /sats?|satoshis?|btc|bitcoin|msats?/gi,
        ''
    );
    const activeFiat = settingsStore?.settings?.fiat;
    if (activeFiat) {
        withoutUnitLabels = withoutUnitLabels.replace(
            new RegExp(`\\b${activeFiat}\\b`, 'gi'),
            ''
        );
    }
    if (/[a-z]{2,}/i.test(withoutUnitLabels)) return null;

    const useCommaAsDecimal =
        units === 'fiat' && !!fiatStore.getSymbol().separatorSwap;

    let cleaned = clipboardValue.trim();
    if (useCommaAsDecimal) {
        cleaned = cleaned.replace(/\./g, '').replace(/,/g, '.');
    } else {
        cleaned = cleaned.replace(/,/g, '');
    }
    cleaned = cleaned.replace(/[^0-9.]/g, '');

    const firstDot = cleaned.indexOf('.');
    if (firstDot !== -1) {
        cleaned =
            cleaned.substring(0, firstDot + 1) +
            cleaned.substring(firstDot + 1).replace(/\./g, '');
    }

    if (!cleaned || cleaned === '.') return null;

    const parts = cleaned.split('.');
    let intPart = parts[0].replace(/^0+/, '') || '0';
    let decPart: string | undefined = parts[1];

    const decimalLimit = getDecimalLimit(units, fiatStore, settingsStore);
    if (decPart !== undefined) {
        if (decimalLimit === 0) {
            decPart = undefined;
        } else if (decimalLimit !== null && decPart.length > decimalLimit) {
            decPart = decPart.substring(0, decimalLimit);
        }
    }

    if (units === 'BTC' && intPart.length > 8) return null;
    if (units === 'sats' && intPart.length > 12) return null;
    if (units === 'fiat' && intPart.length > 10) return null;

    const finalAmount =
        decPart !== undefined && decPart !== ''
            ? `${intPart}.${decPart}`
            : intPart;

    const bn = new BigNumber(finalAmount);
    if (bn.isNaN()) return null;
    if (units === 'BTC' && bn.gt(21000000)) return null;
    if (units === 'sats' && bn.gt(2100000000000000)) return null;

    return finalAmount;
};
