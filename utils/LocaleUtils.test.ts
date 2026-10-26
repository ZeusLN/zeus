import { localeString, formatInlineNoun } from './LocaleUtils';

const mockSettings: { locale?: string } = { locale: 'en' };

// Mock the store to allow changing the locale per test
jest.mock('../stores/Stores', () => ({
    settingsStore: {
        get settings() {
            return { locale: mockSettings.locale };
        }
    }
}));

// Mock the locales to ensure deterministic tests
jest.mock('../locales/en.json', () => ({
    'test.greeting': 'Hello {{name}}',
    'test.repeated': '{{name}} and {{name}}',
    'test.fallback': 'English Fallback'
}));

jest.mock('../locales/de.json', () => ({
    'test.greeting': 'Hallo {{name}}'
}));

// We mock the other imports to an empty object so the test doesn't
// accidentally fail if a real locale file is missing in the test environment.
jest.mock('../locales/cs.json', () => ({}));
jest.mock('../locales/es.json', () => ({}));
jest.mock('../locales/pt_BR.json', () => ({}));
jest.mock('../locales/sk.json', () => ({}));
jest.mock('../locales/tr.json', () => ({}));
jest.mock('../locales/hu.json', () => ({}));
jest.mock('../locales/zh_CN.json', () => ({}));
jest.mock('../locales/fr.json', () => ({}));
jest.mock('../locales/nl.json', () => ({}));
jest.mock('../locales/nb.json', () => ({}));
jest.mock('../locales/sv.json', () => ({}));
jest.mock('../locales/th.json', () => ({}));
jest.mock('../locales/uk.json', () => ({}));
jest.mock('../locales/ro.json', () => ({}));
jest.mock('../locales/pl.json', () => ({}));
jest.mock('../locales/he.json', () => ({}));
jest.mock('../locales/hr.json', () => ({}));
jest.mock('../locales/sw.json', () => ({}));
jest.mock('../locales/hi_IN.json', () => ({}));
jest.mock('../locales/zh_TW.json', () => ({}));
jest.mock('../locales/fa.json', () => ({}));
jest.mock('../locales/el.json', () => ({}));
jest.mock('../locales/sl.json', () => ({}));
jest.mock('../locales/ru.json', () => ({}));
jest.mock('../locales/fi.json', () => ({}));
jest.mock('../locales/it.json', () => ({}));
jest.mock('../locales/vi.json', () => ({}));
jest.mock('../locales/ja.json', () => ({}));
jest.mock('../locales/ko.json', () => ({}));
jest.mock('../locales/bg.json', () => ({}));
jest.mock('../locales/id.json', () => ({}));

describe('localeString', () => {
    beforeEach(() => {
        mockSettings.locale = 'en';
    });

    it('substitutes a {{key}} placeholder', () => {
        const result = localeString('test.greeting', { name: 'Alice' });
        expect(result).toBe('Hello Alice');
    });

    it('substitutes repeated placeholders', () => {
        const result = localeString('test.repeated', { name: 'Alice' });
        expect(result).toBe('Alice and Alice');
    });

    it('returns the translated string for the active locale', () => {
        mockSettings.locale = 'de';
        const result = localeString('test.greeting', { name: 'Alice' });
        expect(result).toBe('Hallo Alice');
    });

    it('falls back to English when a locale lacks the key', () => {
        mockSettings.locale = 'de'; // de.json doesn't have 'test.fallback'
        const result = localeString('test.fallback');
        expect(result).toBe('English Fallback');
    });

    it('returns undefined for an unknown key', () => {
        const result = localeString('test.unknown');
        expect(result).toBeUndefined();
    });
});

describe('formatInlineNoun', () => {
    it('lowercases text for locales without noun capitalization (en)', () => {
        mockSettings.locale = 'en';
        const result = formatInlineNoun('Hello World');
        expect(result).toBe('hello world');
    });

    it('preserves case for locales with noun capitalization (de)', () => {
        mockSettings.locale = 'de';
        const result = formatInlineNoun('Hello World');
        expect(result).toBe('Hello World');
    });
});
