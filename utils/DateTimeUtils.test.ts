import DateTimeUtils from './DateTimeUtils';

jest.mock('./LocaleUtils', () => ({
    localeString: (key: string) =>
        key === 'general.notAvailable' ? 'N/A' : key
}));

describe('listDate', () => {
    it('returns date for timestamp as number', () => {
        const date = new Date(2024, 11, 26, 21, 21);
        const timestamp = date.getTime() / 1000;

        const result = DateTimeUtils.listDate(timestamp);

        expect(result).toEqual(date);
    });

    it('returns date for timestamp as string', () => {
        const date = new Date(2024, 11, 26, 21, 21);
        const timestamp = date.getTime() / 1000;

        const result = DateTimeUtils.listDate(timestamp.toString());

        expect(result).toEqual(date);
    });
});

describe('listFormattedDate', () => {
    it('returns timestamp with custom format and string as input', () => {
        const date = new Date(2024, 11, 26, 21, 21);
        const timestamp = date.getTime() / 1000;

        const result = DateTimeUtils.listFormattedDate(
            timestamp.toString(),
            "mmm d 'yy, HH:MM"
        );

        expect(result).toEqual("Dec 26 '24, 21:21");
    });

    it('returns timestamp with default format if no format is given', () => {
        const date = new Date(2024, 11, 26, 21, 21);
        const timestamp = date.getTime() / 1000;

        const result = DateTimeUtils.listFormattedDate(timestamp);

        expect(result).toMatch(/^Thu, Dec 26 '24, 21:21/);
    });

    it('falls back to N/A if timestamp is undefined', () => {
        const result = DateTimeUtils.listFormattedDate(undefined);

        expect(result).toEqual('N/A');
    });

    it('returns the raw value if timestamp is not date-coercible', () => {
        const result = DateTimeUtils.listFormattedDate('not-a-date');

        expect(result).toEqual('not-a-date');
    });

    it('formats an empty string as the epoch rather than N/A', () => {
        // Number('') is 0, so '' stays on the happy path as a valid date
        const result = DateTimeUtils.listFormattedDate('');

        expect(result).not.toEqual('N/A');
        expect(result).toMatch(/'69|'70/);
    });
});

// listFormattedDateShort and listFormattedDateOrder compare against the
// current year, so pin the clock. Dates are built in local time, the same
// way the code under test reads them, so the results do not depend on TZ.
describe('listFormattedDateShort', () => {
    beforeEach(() => {
        jest.useFakeTimers().setSystemTime(new Date(2026, 5, 15, 12, 0));
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('returns timestamp without year if timestamp is current year', () => {
        const timestamp = new Date(2026, 0, 1, 5, 6).getTime() / 1000;

        const result = DateTimeUtils.listFormattedDateShort(timestamp);

        expect(result).toEqual('Jan 1, 05:06');
    });

    it('returns timestamp with year if timestamp is next year', () => {
        const timestamp = new Date(2027, 0, 1, 5, 6).getTime() / 1000;

        const result = DateTimeUtils.listFormattedDateShort(timestamp);

        expect(result).toEqual("Jan 1, '27, 05:06");
    });

    it('returns timestamp with year if timestamp is last year', () => {
        const timestamp = new Date(2025, 0, 1, 5, 6).getTime() / 1000;

        const result = DateTimeUtils.listFormattedDateShort(timestamp);

        expect(result).toEqual("Jan 1, '25, 05:06");
    });

    it('returns timestamp if input is string', () => {
        const timestamp = new Date(2026, 0, 1, 5, 6).getTime() / 1000;

        const result = DateTimeUtils.listFormattedDateShort(
            timestamp.toString()
        );

        expect(result).toEqual('Jan 1, 05:06');
    });

    it('shows the year for a timestamp one minute into next year', () => {
        jest.setSystemTime(new Date(2026, 11, 31, 23, 59));
        const timestamp = new Date(2027, 0, 1, 0, 0).getTime() / 1000;

        const result = DateTimeUtils.listFormattedDateShort(timestamp);

        expect(result).toEqual("Jan 1, '27, 00:00");
    });

    it('shows the year for a timestamp one minute before new year', () => {
        jest.setSystemTime(new Date(2027, 0, 1, 0, 0));
        const timestamp = new Date(2026, 11, 31, 23, 59).getTime() / 1000;

        const result = DateTimeUtils.listFormattedDateShort(timestamp);

        expect(result).toEqual("Dec 31, '26, 23:59");
    });

    it('omits the year on the last minute of the current year', () => {
        jest.setSystemTime(new Date(2026, 11, 31, 23, 59));
        const timestamp = new Date(2026, 0, 1, 0, 0).getTime() / 1000;

        const result = DateTimeUtils.listFormattedDateShort(timestamp);

        expect(result).toEqual('Jan 1, 00:00');
    });
});

describe('listFormattedDateOrder', () => {
    beforeEach(() => {
        jest.useFakeTimers().setSystemTime(new Date(2026, 5, 15, 12, 0));
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('returns timestamp without year if timestamp is current year', () => {
        const timestamp = new Date(2026, 0, 1, 5, 6);

        const result = DateTimeUtils.listFormattedDateOrder(timestamp);

        expect(result).toEqual('05:06 am | Thu, Jan 01');
    });

    it('returns timestamp with year if timestamp is next year', () => {
        const timestamp = new Date(2027, 0, 1, 5, 6);

        const result = DateTimeUtils.listFormattedDateOrder(timestamp);

        expect(result).toEqual("05:06 am | Fri, Jan 01, '27");
    });

    it('returns timestamp with year if timestamp is last year', () => {
        const timestamp = new Date(2025, 0, 1, 5, 6);

        const result = DateTimeUtils.listFormattedDateOrder(timestamp);

        expect(result).toEqual("05:06 am | Wed, Jan 01, '25");
    });

    it('shows the year for a timestamp one minute into next year', () => {
        jest.setSystemTime(new Date(2026, 11, 31, 23, 59));
        const timestamp = new Date(2027, 0, 1, 0, 0);

        const result = DateTimeUtils.listFormattedDateOrder(timestamp);

        expect(result).toEqual("00:00 am | Fri, Jan 01, '27");
    });

    it('shows the year for a timestamp one minute before new year', () => {
        jest.setSystemTime(new Date(2027, 0, 1, 0, 0));
        const timestamp = new Date(2026, 11, 31, 23, 59);

        const result = DateTimeUtils.listFormattedDateOrder(timestamp);

        expect(result).toEqual("23:59 pm | Thu, Dec 31, '26");
    });
});

describe('blocksToMonthsAndDays', () => {
    it('handles positive values', () => {
        expect(DateTimeUtils.blocksToMonthsAndDays(2016)).toEqual({
            months: 0,
            days: 14
        });

        expect(DateTimeUtils.blocksToMonthsAndDays(20160)).toEqual({
            months: 4,
            days: 20
        });

        expect(DateTimeUtils.blocksToMonthsAndDays(51280)).toEqual({
            months: 11,
            days: 26
        });
    });

    it('handles negative values', () => {
        expect(DateTimeUtils.blocksToMonthsAndDays(-2016)).toEqual({
            months: -0,
            days: -14
        });

        expect(DateTimeUtils.blocksToMonthsAndDays(-20160)).toEqual({
            months: -4,
            days: -20
        });

        expect(DateTimeUtils.blocksToMonthsAndDays(-51280)).toEqual({
            months: -11,
            days: -26
        });
    });
});
