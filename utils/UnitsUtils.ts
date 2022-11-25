const getDecimalPlaceholder = (amount: string, units: string) => {
    const occupiedPlaces: number =
        (amount.split('.')[1] && amount.split('.')[1].length) || 0;
    let placeholderCount = 0;

    if (units === 'sats') {
        placeholderCount = 3 - occupiedPlaces;
    } else if (units === 'BTC') {
        placeholderCount = 8 - occupiedPlaces;
    } else if (units === 'fiat') {
        placeholderCount = 2 - occupiedPlaces;
    }

    return {
        string: amount.includes('.') ? '0'.repeat(placeholderCount) : null,
        count: amount.includes('.') ? placeholderCount : 0
    };
};

export { getDecimalPlaceholder };
