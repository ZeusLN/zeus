import BigNumber from 'bignumber.js';

import { settingsStore, fiatStore } from '../stores/Stores';

// 100_000_000
const SATS_PER_BTC = 100000000;

const getDecimalPlaceholder = (amount: string, units: string) => {
    const [_, decimalPart] = amount.split('.');
    const occupiedPlaces: number = (decimalPart && decimalPart.length) || 0;
    let placeholderCount = 0;

    if (units === 'sats') {
        placeholderCount = 3 - occupiedPlaces;
    } else if (units === 'BTC') {
        placeholderCount = 8 - occupiedPlaces;
    } else if (units === 'fiat') {
        const fiat = settingsStore.settings?.fiat || '';
        const fiatProperties = fiatStore.symbolLookup(fiat);
        const decimalCount =
            fiatProperties?.decimalPlaces !== undefined
                ? fiatProperties.decimalPlaces
                : 2;
        placeholderCount = decimalCount - occupiedPlaces;
    }

    return {
        string: amount.includes('.')
            ? units === 'BTC' &&
              !settingsStore?.settings?.display?.removeDecimalSpaces
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

const numberWithCommas = (x: string | number) =>
    x?.toString()?.replace(/\B(?=(\d{3})+(?!\d))/g, ',') || '0';

const numberWithDecimals = (x: string | number) =>
    numberWithCommas(x).replace(/[,.]/g, (y: string) =>
        y === ',' ? '.' : ','
    );

const formatBitcoinWithSpaces = (x: string | number) => {
    // Convert to string to handle decimal parts
    const [integerPart, decimalPart] = x.toString().split('.');

    const integerFormatted = numberWithCommas(integerPart);

    // // If no decimal part, return the integer part as is
    if (x.toString().includes('.') && !decimalPart) {
        return `${integerFormatted}.`;
    } else if (!decimalPart) {
        return integerFormatted;
    }

    if (settingsStore?.settings?.display?.removeDecimalSpaces) {
        return `${integerFormatted}.${decimalPart}`;
    }

    // Handle the first two characters, then group the rest in threes
    const firstTwo = decimalPart.slice(0, 2);
    const rest = decimalPart.slice(2).replace(/(\d{3})(?=\d)/g, '$1 ');

    // Combine integer part, first two characters, and formatted rest
    return `${integerFormatted}.${firstTwo} ${rest}`.trim();
};

// BIP21 amounts are in BTC with at most 8 decimals, so a request with
// millisats (e.g. 1,000.5 sats) is rounded up to the next whole sat
const satsToBip21Amount = (sats: string | number) =>
    new BigNumber(sats)
        .integerValue(BigNumber.ROUND_CEIL)
        .dividedBy(SATS_PER_BTC)
        .toFixed();

type Units = 'sats' | 'BTC' | 'fiat';

export {
    SATS_PER_BTC,
    getDecimalPlaceholder,
    numberWithCommas,
    numberWithDecimals,
    formatBitcoinWithSpaces,
    satsToBip21Amount
};
export type { Units };
