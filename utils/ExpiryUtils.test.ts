import {
    ExpirationPreset,
    displayFromExpirySeconds,
    expirationIndexFromSeconds,
    expirySecondsFromInput,
    localizedExpiryDuration
} from './ExpiryUtils';

jest.mock('./LocaleUtils', () => {
    const locale: { [key: string]: string } = {
        'time.seconds': 'Seconds',
        'time.minute': 'Minute',
        'time.minutes': 'Minutes',
        'time.hour': 'Hour',
        'time.hours': 'Hours',
        'time.day': 'Day',
        'time.days': 'Days',
        'time.week': 'Week',
        'time.weeks': 'Weeks'
    };
    return {
        localeString: (key: string) => locale[key] || key
    };
});

describe('ExpiryUtils', () => {
    describe('expirySecondsFromInput', () => {
        it('returns the value unchanged for Seconds', () => {
            expect(expirySecondsFromInput('90', 'Seconds')).toBe('90');
            expect(expirySecondsFromInput('1', 'Seconds')).toBe('1');
        });

        it('converts Minutes to seconds', () => {
            expect(expirySecondsFromInput('1', 'Minutes')).toBe('60');
            expect(expirySecondsFromInput('10', 'Minutes')).toBe('600');
        });

        it('converts Hours to seconds', () => {
            expect(expirySecondsFromInput('1', 'Hours')).toBe('3600');
            expect(expirySecondsFromInput('2', 'Hours')).toBe('7200');
        });

        it('converts Days to seconds', () => {
            expect(expirySecondsFromInput('1', 'Days')).toBe('86400');
            expect(expirySecondsFromInput('7', 'Days')).toBe('604800');
        });

        it('converts Weeks to seconds', () => {
            expect(expirySecondsFromInput('1', 'Weeks')).toBe('604800');
            expect(expirySecondsFromInput('2', 'Weeks')).toBe('1209600');
        });

        it('returns fallback for empty string', () => {
            expect(expirySecondsFromInput('', 'Hours')).toBe('3600');
            expect(expirySecondsFromInput('', 'Minutes')).toBe('3600');
        });

        it('returns fallback for zero', () => {
            expect(expirySecondsFromInput('0', 'Hours')).toBe('3600');
            expect(expirySecondsFromInput('0', 'Seconds')).toBe('3600');
        });

        it('returns fallback for negative values', () => {
            expect(expirySecondsFromInput('-1', 'Hours')).toBe('3600');
            expect(expirySecondsFromInput('-100', 'Minutes')).toBe('3600');
        });

        it('returns fallback for non-numeric input', () => {
            expect(expirySecondsFromInput('abc', 'Hours')).toBe('3600');
            expect(expirySecondsFromInput('1a', 'Minutes')).toBe('3600');
            expect(expirySecondsFromInput('NaN', 'Hours')).toBe('3600');
        });
    });

    describe('expirationIndexFromSeconds', () => {
        it('returns correct preset for known values', () => {
            expect(expirationIndexFromSeconds('600')).toBe(
                ExpirationPreset.TenMinutes
            );
            expect(expirationIndexFromSeconds('3600')).toBe(
                ExpirationPreset.OneHour
            );
            expect(expirationIndexFromSeconds('86400')).toBe(
                ExpirationPreset.OneDay
            );
            expect(expirationIndexFromSeconds('604800')).toBe(
                ExpirationPreset.OneWeek
            );
        });

        it('returns null for unknown values', () => {
            expect(expirationIndexFromSeconds('999')).toBeNull();
            expect(expirationIndexFromSeconds('')).toBeNull();
            expect(expirationIndexFromSeconds('NaN')).toBeNull();
        });
    });

    describe('displayFromExpirySeconds', () => {
        it('prefers the largest evenly-dividing unit', () => {
            expect(displayFromExpirySeconds('604800')).toEqual({
                expiry: '1',
                timePeriod: 'Weeks'
            });
            expect(displayFromExpirySeconds('86400')).toEqual({
                expiry: '1',
                timePeriod: 'Days'
            });
            expect(displayFromExpirySeconds('3600')).toEqual({
                expiry: '1',
                timePeriod: 'Hours'
            });
            expect(displayFromExpirySeconds('600')).toEqual({
                expiry: '10',
                timePeriod: 'Minutes'
            });
            expect(displayFromExpirySeconds('7200')).toEqual({
                expiry: '2',
                timePeriod: 'Hours'
            });
            expect(displayFromExpirySeconds('1209600')).toEqual({
                expiry: '2',
                timePeriod: 'Weeks'
            });
        });

        it('falls back to Seconds for non-divisible values', () => {
            expect(displayFromExpirySeconds('90')).toEqual({
                expiry: '90',
                timePeriod: 'Seconds'
            });
            expect(displayFromExpirySeconds('1')).toEqual({
                expiry: '1',
                timePeriod: 'Seconds'
            });
        });

        it('falls back to 1 Hours for empty or invalid input', () => {
            expect(displayFromExpirySeconds('')).toEqual({
                expiry: '1',
                timePeriod: 'Hours'
            });
            expect(displayFromExpirySeconds('0')).toEqual({
                expiry: '1',
                timePeriod: 'Hours'
            });
            expect(displayFromExpirySeconds('-3600')).toEqual({
                expiry: '1',
                timePeriod: 'Hours'
            });
            expect(displayFromExpirySeconds('NaN')).toEqual({
                expiry: '1',
                timePeriod: 'Hours'
            });
        });
    });

    describe('localizedExpiryDuration', () => {
        it('uses the singular unit for a value of 1', () => {
            expect(localizedExpiryDuration('1', 'Hours')).toBe('1 Hour');
            expect(localizedExpiryDuration('1', 'Days')).toBe('1 Day');
        });

        it('uses the plural unit for values other than 1', () => {
            expect(localizedExpiryDuration('2', 'Hours')).toBe('2 Hours');
            expect(localizedExpiryDuration('10', 'Minutes')).toBe('10 Minutes');
        });
    });
});
