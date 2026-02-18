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

/**
 * Creates and starts the shake animation sequence.
 * Used to provide visual feedback when invalid input is entered.
 */
export const startShakeAnimation = (
    shakeAnimation: Animated.Value,
    textAnimation: Animated.Value
): void => {
    Animated.parallel([
        Animated.sequence([
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
        ]),
        Animated.sequence([
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
        ])
    ]).start();
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
