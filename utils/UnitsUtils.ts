import { settingsStore, fiatStore } from '../stores/Stores';

// 100_000_000
const SATS_PER_BTC = 100000000;

const EUROPEAN_STYLE_LOCALES = new Set([
    'bg',
    'cs',
    'de',
    'el',
    'es',
    'fi',
    'fr',
    'hr',
    'hu',
    'id',
    'it',
    'nb',
    'nl',
    'pl',
    'pt',
    'ro',
    'ru',
    'sk',
    'sl',
    'sv',
    'tr',
    'uk',
    'vi'
]);

const NUMBER_FORMAT_LOCALE_OVERRIDES: { [key: string]: string } = {
    en: 'en-US',
    hi_IN: 'hi-IN',
    jp: 'ja-JP',
    pt: 'pt-BR',
    zh: 'zh-CN',
    zh_TW: 'zh-TW'
};

const normalizeLocaleForNumberFormat = (locale?: string) => {
    const normalizedLocale = locale || settingsStore?.settings?.locale || 'en';
    return (
        NUMBER_FORMAT_LOCALE_OVERRIDES[normalizedLocale] ||
        normalizedLocale.replace(/_/g, '-')
    );
};

const usesEuropeanNumberFormat = (locale?: string) => {
    const normalizedLocale = normalizeLocaleForNumberFormat(locale);

    try {
        const parts = new Intl.NumberFormat(normalizedLocale).formatToParts(
            1000.1
        );
        const decimalSeparator = parts.find(
            (part) => part.type === 'decimal'
        )?.value;

        if (decimalSeparator) {
            return decimalSeparator === ',';
        }
    } catch {
        // Fall back to a curated locale list if Intl data is unavailable.
    }

    const baseLocale = normalizedLocale.split('-')[0];
    return (
        EUROPEAN_STYLE_LOCALES.has(normalizedLocale) ||
        EUROPEAN_STYLE_LOCALES.has(baseLocale)
    );
};

const getNumberFormatSettings = (locale?: string) => {
    const europeanStyle = usesEuropeanNumberFormat(locale);

    return {
        decimalSeparator: europeanStyle ? ',' : '.',
        groupSeparator: europeanStyle ? '.' : ','
    };
};

const getDecimalSeparator = (locale?: string) =>
    getNumberFormatSettings(locale).decimalSeparator;

const splitNumericValue = (value: string | number, locale?: string) => {
    const { decimalSeparator, groupSeparator } =
        getNumberFormatSettings(locale);
    const input = `${value ?? 0}`.trim().replace(/\s/g, '');

    if (!input) {
        return {
            sign: '',
            integerPart: '0',
            decimalPart: undefined,
            hasExplicitDecimal: false
        };
    }

    const sign = input.startsWith('-') ? '-' : '';
    const unsignedInput = sign ? input.slice(1) : input;
    const fallbackSeparator = decimalSeparator === '.' ? ',' : '.';

    const normalizeGroupedValue = (integerValue: string) =>
        integerValue.replace(/[.,]/g, '') || '0';

    const splitOnSeparator = (separator: string) => {
        const parts = unsignedInput.split(separator);

        if (parts.length === 1) {
            return undefined;
        }

        if (parts.length > 2) {
            const decimalPart = parts.pop() || '';
            return {
                sign,
                integerPart: normalizeGroupedValue(parts.join(separator)),
                decimalPart: decimalPart.replace(/[.,]/g, ''),
                hasExplicitDecimal: true
            };
        }

        const [integerPart, decimalPart = ''] = parts;
        return {
            sign,
            integerPart: normalizeGroupedValue(integerPart),
            decimalPart: decimalPart.replace(/[.,]/g, ''),
            hasExplicitDecimal: true
        };
    };

    if (/[.,]/.test(unsignedInput)) {
        const lastDecimalIndex = unsignedInput.lastIndexOf(decimalSeparator);
        const lastFallbackIndex = unsignedInput.lastIndexOf(fallbackSeparator);

        if (lastDecimalIndex >= 0 && lastFallbackIndex >= 0) {
            const decimalIndex = Math.max(lastDecimalIndex, lastFallbackIndex);
            return {
                sign,
                integerPart: normalizeGroupedValue(
                    unsignedInput.slice(0, decimalIndex)
                ),
                decimalPart: unsignedInput
                    .slice(decimalIndex + 1)
                    .replace(/[.,]/g, ''),
                hasExplicitDecimal: true
            };
        }

        if (unsignedInput.endsWith(decimalSeparator)) {
            return {
                sign,
                integerPart: normalizeGroupedValue(unsignedInput.slice(0, -1)),
                decimalPart: '',
                hasExplicitDecimal: true
            };
        }

        if (unsignedInput.includes(decimalSeparator)) {
            return splitOnSeparator(decimalSeparator)!;
        }

        if (unsignedInput.includes(groupSeparator)) {
            const parts = unsignedInput.split(groupSeparator);
            const [integerPart, decimalPart = ''] = parts;
            const isDecimalFallback =
                parts.length === 2 &&
                (integerPart === '0' || decimalPart.length !== 3);

            if (isDecimalFallback) {
                return {
                    sign,
                    integerPart: normalizeGroupedValue(integerPart),
                    decimalPart: decimalPart.replace(/[.,]/g, ''),
                    hasExplicitDecimal: true
                };
            }

            return {
                sign,
                integerPart: normalizeGroupedValue(parts.join(groupSeparator)),
                decimalPart: undefined,
                hasExplicitDecimal: false
            };
        }

        if (unsignedInput.endsWith(fallbackSeparator)) {
            return {
                sign,
                integerPart: normalizeGroupedValue(unsignedInput.slice(0, -1)),
                decimalPart: '',
                hasExplicitDecimal: true
            };
        }

        if (unsignedInput.includes(fallbackSeparator)) {
            const parts = unsignedInput.split(fallbackSeparator);
            const [integerPart, decimalPart = ''] = parts;
            const isGroupedFallback =
                parts.length > 2 ||
                (parts.length === 2 &&
                    decimalPart.length === 3 &&
                    integerPart.length > 0 &&
                    integerPart !== '0');

            if (isGroupedFallback) {
                return {
                    sign,
                    integerPart: normalizeGroupedValue(
                        parts.join(fallbackSeparator)
                    ),
                    decimalPart: undefined,
                    hasExplicitDecimal: false
                };
            }

            return {
                sign,
                integerPart: normalizeGroupedValue(integerPart),
                decimalPart: decimalPart.replace(/[.,]/g, ''),
                hasExplicitDecimal: true
            };
        }
    }

    return {
        sign,
        integerPart: unsignedInput.replace(/[.,]/g, '') || '0',
        decimalPart: undefined,
        hasExplicitDecimal: false
    };
};

const normalizeNumberString = (value: string | number, locale?: string) => {
    const { sign, integerPart, decimalPart, hasExplicitDecimal } =
        splitNumericValue(value, locale);

    if (!hasExplicitDecimal) {
        return `${sign}${integerPart}`;
    }

    return `${sign}${integerPart}.${decimalPart || ''}`;
};

const splitCanonicalNumericValue = (value: string | number) => {
    const input = `${value ?? 0}`.trim();

    if (!input) {
        return {
            sign: '',
            integerPart: '0',
            decimalPart: undefined,
            hasExplicitDecimal: false
        };
    }

    const sign = input.startsWith('-') ? '-' : '';
    const unsignedInput = sign ? input.slice(1) : input;
    const [integerPartRaw, decimalPart] = unsignedInput.split('.');

    return {
        sign,
        integerPart: integerPartRaw || '0',
        decimalPart,
        hasExplicitDecimal: unsignedInput.includes('.')
    };
};

const formatGroupedInteger = (
    integerPart: string,
    groupSeparator: string
): string => {
    const sanitizedInteger = integerPart || '0';

    return sanitizedInteger.replace(/\B(?=(\d{3})+(?!\d))/g, groupSeparator);
};

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

const numberWithCommas = (x: string | number) => {
    const { decimalSeparator, groupSeparator } = getNumberFormatSettings();
    const { sign, integerPart, decimalPart, hasExplicitDecimal } =
        splitCanonicalNumericValue(x);
    const integerFormatted = formatGroupedInteger(integerPart, groupSeparator);

    if (hasExplicitDecimal) {
        return `${sign}${integerFormatted}${decimalSeparator}${
            decimalPart || ''
        }`;
    }

    return `${sign}${integerFormatted}`;
};

const formatBitcoinWithSpaces = (x: string | number) => {
    const { decimalSeparator, groupSeparator } = getNumberFormatSettings();
    const { sign, integerPart, decimalPart, hasExplicitDecimal } =
        splitCanonicalNumericValue(x);
    const integerFormatted = formatGroupedInteger(integerPart, groupSeparator);

    if (hasExplicitDecimal && decimalPart === '') {
        return `${sign}${integerFormatted}${decimalSeparator}`;
    } else if (decimalPart === undefined) {
        return `${sign}${integerFormatted}`;
    }

    if (settingsStore?.settings?.display?.removeDecimalSpaces) {
        return `${sign}${integerFormatted}${decimalSeparator}${decimalPart}`;
    }

    const firstTwo = decimalPart.slice(0, 2);
    const rest = decimalPart.slice(2).replace(/(\d{3})(?=\d)/g, '$1 ');
    const spacedDecimal = [firstTwo, rest].filter(Boolean).join(' ');

    return `${sign}${integerFormatted}${decimalSeparator}${spacedDecimal}`;
};

type Units = 'sats' | 'BTC' | 'fiat';

export {
    SATS_PER_BTC,
    getNumberFormatSettings,
    getDecimalSeparator,
    normalizeNumberString,
    getDecimalPlaceholder,
    numberWithCommas,
    formatBitcoinWithSpaces
};
export type { Units };
