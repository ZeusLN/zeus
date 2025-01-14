import DateTimeUtils from './DateTimeUtils';

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
});

describe('listFormattedDateShort', () => {
    it('returns timestamp without year if timestamp is current year', () => {
        const timestamp =
            new Date(new Date().getFullYear(), 0, 1, 5, 6).getTime() / 1000;

        const result = DateTimeUtils.listFormattedDateShort(timestamp);

        expect(result).toEqual('Jan 1, 05:06');
    });

    it('returns timestamp with year if timestamp is next year', () => {
        const year = new Date().getFullYear() + 1;
        const timestamp = new Date(year, 0, 1, 5, 6).getTime() / 1000;

        const result = DateTimeUtils.listFormattedDateShort(timestamp);

        expect(result).toEqual(`Jan 1, '${year % 100}, 05:06`);
    });

    it('returns timestamp with year if timestamp is last year', () => {
        const year = new Date().getFullYear() - 1;
        const timestamp = new Date(year, 0, 1, 5, 6).getTime() / 1000;

        const result = DateTimeUtils.listFormattedDateShort(timestamp);

        expect(result).toEqual(`Jan 1, '${year % 100}, 05:06`);
    });

    it('returns timestamp if input is string', () => {
        const timestamp =
            new Date(new Date().getFullYear(), 0, 1, 5, 6).getTime() / 1000;

        const result = DateTimeUtils.listFormattedDateShort(
            timestamp.toString()
        );

        expect(result).toEqual('Jan 1, 05:06');
    });
});

describe('listFormattedDateOrder', () => {
    it('returns timestamp without year if timestamp is current year', () => {
        const timestamp = new Date(new Date().getFullYear(), 0, 1, 5, 6);
        const dayName = timestamp.toLocaleDateString('en-US', {
            weekday: 'short'
        });

        const result = DateTimeUtils.listFormattedDateOrder(timestamp);

        expect(result).toEqual(`05:06 am | ${dayName}, Jan 01`);
    });

    it('returns timestamp with year if timestamp is next year', () => {
        const year = new Date().getFullYear() + 1;
        const timestamp = new Date(year, 0, 1, 5, 6);
        const dayName = timestamp.toLocaleDateString('en-US', {
            weekday: 'short'
        });

        const result = DateTimeUtils.listFormattedDateOrder(timestamp);

        expect(result).toEqual(`05:06 am | ${dayName}, Jan 01, '${year % 100}`);
    });

    it('returns timestamp with year if timestamp is last year', () => {
        const year = new Date().getFullYear() - 1;
        const timestamp = new Date(year, 0, 1, 5, 6);
        const dayName = timestamp.toLocaleDateString('en-US', {
            weekday: 'short'
        });

        const result = DateTimeUtils.listFormattedDateOrder(timestamp);

        expect(result).toEqual(`05:06 am | ${dayName}, Jan 01, '${year % 100}`);
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
