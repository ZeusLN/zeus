import { NativeModules } from 'react-native';
import {
    localeString,
    formatInlineNoun,
    pascalToHumanReadable,
    bridgeJavaStrings,
    languagesWithNounCapitalization,
    allLocaleStrings
} from './LocaleUtils';

const mockSettings: { locale?: string } = { locale: 'en' };

jest.mock('../stores/Stores', () => ({
    settingsStore: {
        get settings() {
            return { locale: mockSettings.locale };
        }
    }
}));

// Mock NativeModules for bridgeJavaStrings
jest.mock('react-native', () => ({
    NativeModules: {
        LndMobile: {
            updateTranslationCache: jest.fn()
        }
    }
}));

// Marker mocks for all locales to test the switch mapping
jest.mock('../locales/en.json', () => ({
    'test.marker': 'en',
    'test.greeting': 'Hello {{name}}',
    'test.repeated': '{{name}} and {{name}}',
    'test.dotted': '{{a.b}} and {{axb}}',
    'test.emptyInDe': 'English value',
    'test.shared': 'Shared',
    'androidNotification.nodeRunningBackground': 'nodeRunningBackground',
    'androidNotification.shutdown': 'shutdown',
    'androidNotification.nwcRunningBackground': 'nwcRunningBackground',
    'androidNotification.nwcShutdown': 'nwcShutdown'
}));
jest.mock('../locales/cs.json', () => ({ 'test.marker': 'cs' }));
jest.mock('../locales/de.json', () => ({
    'test.marker': 'de',
    'test.greeting': 'Hallo {{name}}',
    'test.emptyInDe': '' // Empty string to test English fallback
}));
jest.mock('../locales/es.json', () => ({ 'test.marker': 'es' }));
jest.mock('../locales/pt_BR.json', () => ({ 'test.marker': 'pt_BR' }));
jest.mock('../locales/sk.json', () => ({ 'test.marker': 'sk' }));
jest.mock('../locales/tr.json', () => ({ 'test.marker': 'tr' }));
jest.mock('../locales/hu.json', () => ({ 'test.marker': 'hu' }));
jest.mock('../locales/zh_CN.json', () => ({ 'test.marker': 'zh_CN' }));
jest.mock('../locales/fr.json', () => ({
    'test.marker': 'fr',
    'test.shared': 'Shared'
}));
jest.mock('../locales/nl.json', () => ({ 'test.marker': 'nl' }));
jest.mock('../locales/nb.json', () => ({ 'test.marker': 'nb' }));
jest.mock('../locales/sv.json', () => ({ 'test.marker': 'sv' }));
jest.mock('../locales/th.json', () => ({ 'test.marker': 'th' }));
jest.mock('../locales/uk.json', () => ({ 'test.marker': 'uk' }));
jest.mock('../locales/ro.json', () => ({ 'test.marker': 'ro' }));
jest.mock('../locales/pl.json', () => ({ 'test.marker': 'pl' }));
jest.mock('../locales/he.json', () => ({ 'test.marker': 'he' }));
jest.mock('../locales/hr.json', () => ({ 'test.marker': 'hr' }));
jest.mock('../locales/sw.json', () => ({ 'test.marker': 'sw' }));
jest.mock('../locales/hi_IN.json', () => ({ 'test.marker': 'hi_IN' }));
jest.mock('../locales/zh_TW.json', () => ({ 'test.marker': 'zh_TW' }));
jest.mock('../locales/fa.json', () => ({ 'test.marker': 'fa' }));
jest.mock('../locales/el.json', () => ({ 'test.marker': 'el' }));
jest.mock('../locales/sl.json', () => ({ 'test.marker': 'sl' }));
jest.mock('../locales/ru.json', () => ({ 'test.marker': 'ru' }));
jest.mock('../locales/fi.json', () => ({ 'test.marker': 'fi' }));
jest.mock('../locales/it.json', () => ({ 'test.marker': 'it' }));
jest.mock('../locales/vi.json', () => ({ 'test.marker': 'vi' }));
jest.mock('../locales/ja.json', () => ({ 'test.marker': 'ja' }));
jest.mock('../locales/ko.json', () => ({ 'test.marker': 'ko' }));
jest.mock('../locales/bg.json', () => ({ 'test.marker': 'bg' }));
jest.mock('../locales/id.json', () => ({ 'test.marker': 'id' }));

beforeEach(() => {
    mockSettings.locale = 'en';
    jest.clearAllMocks();
});

describe('localeString mapping', () => {
    // Covers the 32-case switch and pins the file name discrepancies
    it.each([
        ['en', 'en'],
        ['es', 'es'],
        ['pt', 'pt_BR'],
        ['tr', 'tr'],
        ['sk', 'sk'],
        ['cs', 'cs'],
        ['de', 'de'],
        ['el', 'el'],
        ['nb', 'nb'],
        ['sv', 'sv'],
        ['th', 'th'],
        ['uk', 'uk'],
        ['ro', 'ro'],
        ['pl', 'pl'],
        ['fa', 'fa'],
        ['fr', 'fr'],
        ['nl', 'nl'],
        ['hu', 'hu'],
        ['sw', 'sw'],
        ['zh', 'zh_CN'],
        ['sl', 'sl'],
        ['ru', 'ru'],
        ['fi', 'fi'],
        ['it', 'it'],
        ['vi', 'vi'],
        ['jp', 'ja'],
        ['he', 'he'],
        ['hr', 'hr'],
        ['ko', 'ko'],
        ['hi_IN', 'hi_IN'],
        ['zh_TW', 'zh_TW'],
        ['bg', 'bg'],
        ['id', 'id'],
        [undefined, 'en'],
        ['ar', 'en'] // Unhandled code falls back to English
    ])(
        'maps locale "%s" to the correct file (marker: %s)',
        (locale, expectedMarker) => {
            mockSettings.locale = locale;
            expect(localeString('test.marker')).toBe(expectedMarker);
        }
    );
});

describe('localeString substitutions and fallbacks', () => {
    it('substitutes a {{key}} placeholder', () => {
        expect(localeString('test.greeting', { name: 'Alice' })).toBe(
            'Hello Alice'
        );
    });

    it('substitutes repeated placeholders', () => {
        expect(localeString('test.repeated', { name: 'Alice' })).toBe(
            'Alice and Alice'
        );
    });

    it('substitutes numbers as strings', () => {
        expect(localeString('test.greeting', { name: 3 })).toBe('Hello 3');
    });

    it('does not interpret $ replacement patterns in substitution values', () => {
        expect(localeString('test.greeting', { name: '$$5 $& x' })).toBe(
            'Hello $$5 $& x'
        );
    });

    it('treats regex metacharacters in substitution keys literally', () => {
        expect(localeString('test.dotted', { 'a.b': 'first' })).toBe(
            'first and {{axb}}'
        );
    });

    it('leaves unmatched placeholders as literal text', () => {
        expect(localeString('test.greeting', { wrong: 'Alice' })).toBe(
            'Hello {{name}}'
        );
    });

    it('returns undefined for an unknown key with substitutions', () => {
        expect(localeString('test.unknown', { name: 'Alice' })).toBeUndefined();
    });

    it('falls back to English when a locale lacks the key', () => {
        mockSettings.locale = 'de';
        // de.json is missing test.repeated, so it should fall back to the en.json value
        expect(localeString('test.repeated')).toBe('{{name}} and {{name}}');
    });

    it('falls back to English when the translation is an empty string', () => {
        mockSettings.locale = 'de';
        // de.json has test.emptyInDe set to '', so it should fall back to the en.json value
        expect(localeString('test.emptyInDe')).toBe('English value');
    });
});

describe('formatInlineNoun', () => {
    it.each(['de', 'pl', 'cs', 'sk'])('preserves case for %s', (locale) => {
        mockSettings.locale = locale;
        expect(formatInlineNoun('Hello World')).toBe('Hello World');
    });

    it.each(['en', 'fr', undefined])('lowercases for %s', (locale) => {
        mockSettings.locale = locale;
        expect(formatInlineNoun('Hello World')).toBe('hello world');
    });

    it('matches the exported list of capitalizing languages', () => {
        expect(languagesWithNounCapitalization).toEqual([
            'de',
            'pl',
            'cs',
            'sk'
        ]);
    });
});

describe('pascalToHumanReadable', () => {
    it('converts PascalCase to human readable', () => {
        expect(pascalToHumanReadable('PaymentRequest')).toBe('Payment request');
    });

    it('handles empty strings', () => {
        expect(pascalToHumanReadable('')).toBe('');
    });
});

describe('bridgeJavaStrings', () => {
    it('calls NativeModules with the correct keys', () => {
        bridgeJavaStrings('en');
        expect(
            NativeModules.LndMobile.updateTranslationCache
        ).toHaveBeenCalledWith('en', {
            'androidNotification.nodeRunningBackground':
                'nodeRunningBackground',
            'androidNotification.shutdown': 'shutdown',
            'androidNotification.nwcRunningBackground': 'nwcRunningBackground',
            'androidNotification.nwcShutdown': 'nwcShutdown'
        });
    });
});

describe('allLocaleStrings', () => {
    it('returns the translation of a key in every locale', () => {
        const markers = allLocaleStrings('test.marker');
        expect(markers).toHaveLength(33);
        expect(markers).toEqual(
            expect.arrayContaining(['en', 'de', 'fr', 'ko', 'id'])
        );
    });

    it('lists each translation once', () => {
        expect(allLocaleStrings('test.shared')).toEqual(['Shared']);
    });

    it('skips locales where the key is empty', () => {
        expect(allLocaleStrings('test.emptyInDe')).toEqual(['English value']);
    });

    it('returns an empty list for an unknown key', () => {
        expect(allLocaleStrings('not.a.key')).toEqual([]);
    });
});
