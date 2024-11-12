const getDecimalPlaceholder = (amount: string, units: string) => {
    const [_, decimalPart] = amount.split('.');
    const occupiedPlaces: number = (decimalPart && decimalPart.length) || 0;
    let placeholderCount = 0;

    if (units === 'sats') {
        placeholderCount = 3 - occupiedPlaces;
    } else if (units === 'BTC') {
        placeholderCount = 8 - occupiedPlaces;
    } else if (units === 'fiat') {
        placeholderCount = 2 - occupiedPlaces;
    }

    return {
        string: amount.includes('.')
            ? units === 'BTC'
                ? '00 000 000'.slice(
                      occupiedPlaces +
                          (decimalPart.length > 5
                              ? 2
                              : decimalPart.length > 2
                              ? 1
                              : 0)
                  )
                : '0'.repeat(placeholderCount)
            : null,
        count: amount.includes('.') ? placeholderCount : 0
    };
};

export { getDecimalPlaceholder };
