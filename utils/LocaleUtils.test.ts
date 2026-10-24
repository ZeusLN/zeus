jest.mock('../stores/Stores', () => ({
    settingsStore: { settings: {} }
}));

import { allLocaleStrings } from './LocaleUtils';

describe('allLocaleStrings', () => {
    it('returns the translation of a key in every locale', () => {
        expect(allLocaleStrings('time.days')).toEqual(
            expect.arrayContaining(['Days', 'Tage', 'Jours', '일'])
        );
    });

    it('lists each translation once', () => {
        const days = allLocaleStrings('time.days');
        expect(new Set(days).size).toBe(days.length);
    });

    it('returns an empty list for an unknown key', () => {
        expect(allLocaleStrings('not.a.key')).toEqual([]);
    });
});
