import BigNumber from 'bignumber.js';

const SECONDS_IN_MINUTE = 60;
const SECONDS_IN_HOUR = SECONDS_IN_MINUTE * 60;
const SECONDS_IN_DAY = SECONDS_IN_HOUR * 24;
const SECONDS_IN_WEEK = SECONDS_IN_DAY * 7;

// Converts a user-entered value + time period into expiry seconds.
// e.g. ('2', 'Hours') → '7200'

export const expirySecondsFromInput = (
    value: string,
    timePeriod: string
): string => {
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
