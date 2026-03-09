import BigNumber from 'bignumber.js';

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
