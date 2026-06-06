import BigNumber from 'bignumber.js';

import { localeString } from './LocaleUtils';

export type TimePeriod = 'Seconds' | 'Minutes' | 'Hours' | 'Days' | 'Weeks';

export enum ExpirationPreset {
    TenMinutes = 0,
    OneHour = 1,
    OneDay = 2,
    OneWeek = 3
}

const SECONDS_IN_MINUTE = 60;
const SECONDS_IN_HOUR = SECONDS_IN_MINUTE * 60;
const SECONDS_IN_DAY = SECONDS_IN_HOUR * 24;
const SECONDS_IN_WEEK = SECONDS_IN_DAY * 7;

// Converts a user-entered value + time period into expiry seconds.
// Returns '3600' for invalid input (empty, zero, negative, non-numeric).
// e.g. ('2', 'Hours') → '7200'
export const expirySecondsFromInput = (
    value: string,
    timePeriod: TimePeriod
): string => {
    if (!value || !(Number(value) > 0)) return '3600';
    switch (timePeriod) {
        case 'Seconds':
            return value;
        case 'Minutes':
            return new BigNumber(value)
                .multipliedBy(SECONDS_IN_MINUTE)
                .toString();
        case 'Hours':
            return new BigNumber(value)
                .multipliedBy(SECONDS_IN_HOUR)
                .toString();
        case 'Days':
            return new BigNumber(value).multipliedBy(SECONDS_IN_DAY).toString();
        case 'Weeks':
            return new BigNumber(value)
                .multipliedBy(SECONDS_IN_WEEK)
                .toString();
        default:
            return '3600';
    }
};

export const expirationIndexFromSeconds = (
    expirySeconds: string
): ExpirationPreset | null => {
    switch (expirySeconds) {
        case '600':
            return ExpirationPreset.TenMinutes;
        case '3600':
            return ExpirationPreset.OneHour;
        case '86400':
            return ExpirationPreset.OneDay;
        case '604800':
            return ExpirationPreset.OneWeek;
        default:
            return null;
    }
};

// Inverse of expirySecondsFromInput: given seconds, returns the largest
// natural (value, unit) pair that divides evenly. Falls back to Seconds for
// non-divisible inputs, and to ('1', 'Hours') for empty/invalid input.
export const displayFromExpirySeconds = (
    expirySeconds: string
): { expiry: string; timePeriod: TimePeriod } => {
    const n = Number(expirySeconds);
    if (!Number.isFinite(n) || n <= 0)
        return { expiry: '1', timePeriod: 'Hours' };
    if (n % SECONDS_IN_WEEK === 0)
        return { expiry: String(n / SECONDS_IN_WEEK), timePeriod: 'Weeks' };
    if (n % SECONDS_IN_DAY === 0)
        return { expiry: String(n / SECONDS_IN_DAY), timePeriod: 'Days' };
    if (n % SECONDS_IN_HOUR === 0)
        return { expiry: String(n / SECONDS_IN_HOUR), timePeriod: 'Hours' };
    if (n % SECONDS_IN_MINUTE === 0)
        return { expiry: String(n / SECONDS_IN_MINUTE), timePeriod: 'Minutes' };
    return { expiry: String(n), timePeriod: 'Seconds' };
};

// Formats a (value, time period) pair into a localized, properly pluralized
// duration string, e.g. ('1', 'Hours') → '1 Hour', ('2', 'Days') → '2 Days'.
export const localizedExpiryDuration = (
    expiry: string,
    timePeriod: string
): string => {
    const unitKeys: {
        [key: string]: { singular: string; plural: string };
    } = {
        Seconds: { singular: 'time.second', plural: 'time.seconds' },
        Minutes: { singular: 'time.minute', plural: 'time.minutes' },
        Hours: { singular: 'time.hour', plural: 'time.hours' },
        Days: { singular: 'time.day', plural: 'time.days' },
        Weeks: { singular: 'time.week', plural: 'time.weeks' }
    };
    const keys = unitKeys[timePeriod];
    const unit = keys
        ? localeString(expiry === '1' ? keys.singular : keys.plural)
        : timePeriod;
    return `${expiry} ${unit}`;
};
