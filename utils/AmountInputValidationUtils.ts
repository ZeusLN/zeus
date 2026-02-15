import BigNumber from 'bignumber.js';

export const getDecimalLimitForUnit = (
    unit: string,
    fiatDecimalPlaces?: number
): number | null => {
    if (unit === 'fiat') {
        return fiatDecimalPlaces !== undefined ? fiatDecimalPlaces : 2;
    }
    if (unit === 'sats') return 3;
    if (unit === 'BTC') return 8;
    return null;
};

export const appendValueToAmount = (
    amount: string,
    value: string,
    unit: string,
    fiatDecimalPlaces?: number
): { isValid: boolean; newAmount?: string } => {
    const decimalLimit = getDecimalLimitForUnit(unit, fiatDecimalPlaces);
    const [integerPart, decimalPart] = amount.split('.');

    if (
        decimalPart &&
        decimalLimit !== null &&
        decimalPart.length >= decimalLimit
    ) {
        return { isValid: false };
    }

    if (
        unit === 'BTC' &&
        !decimalPart &&
        integerPart &&
        integerPart.length === 8 &&
        !amount.includes('.') &&
        value !== '.'
    ) {
        return { isValid: false };
    }

    if (value === '.' && (amount.includes('.') || decimalLimit === 0)) {
        return { isValid: false };
    }

    const proposedNewAmountStr = `${amount}${value}`;
    const proposedNewAmount = new BigNumber(proposedNewAmountStr);

    if (unit === 'BTC' && proposedNewAmount.gt(21000000)) {
        return { isValid: false };
    }
    if (unit === 'sats' && proposedNewAmount.gt(2100000000000000.0)) {
        return { isValid: false };
    }

    return {
        isValid: true,
        newAmount: amount === '0' ? value : proposedNewAmountStr
    };
};
