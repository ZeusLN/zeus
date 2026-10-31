import DateTimeUtils from './DateTimeUtils';

const mockDisplay: {
    dateFormat?: string;
    timeFormat?: string;
    showSeconds?: boolean;
} = {};

jest.mock('../stores/Stores', () => ({
    settingsStore: {
        get settings() {
            return { display: mockDisplay };
        }
    }
}));

jest.mock('./LocaleUtils', () => ({
    localeString: (key: string) =>
        key === 'general.notAvailable' ? 'N/A' : key
}));

const setDisplay = (display: typeof mockDisplay) => {
    Object.keys(mockDisplay).forEach(
        (key) => delete mockDisplay[key as keyof typeof mockDisplay]
    );
    Object.assign(mockDisplay, display);
};

afterEach(() => setDisplay({}));

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
describe('year-relative formatting', () => {
    beforeEach(() => {
        jest.useFakeTimers().setSystemTime(new Date(2026, 5, 15, 12, 0));
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('listFormattedDateShort', () => {
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
        it('returns timestamp without year if timestamp is current year', () => {
            const timestamp = new Date(2026, 0, 1, 5, 6);

            const result = DateTimeUtils.listFormattedDateOrder(timestamp);

            expect(result).toEqual('05:06 | Thu, Jan 01');
        });

        it('returns timestamp with year if timestamp is next year', () => {
            const timestamp = new Date(2027, 0, 1, 5, 6);

            const result = DateTimeUtils.listFormattedDateOrder(timestamp);

            expect(result).toEqual("05:06 | Fri, Jan 01, '27");
        });

        it('returns timestamp with year if timestamp is last year', () => {
            const timestamp = new Date(2025, 0, 1, 5, 6);

            const result = DateTimeUtils.listFormattedDateOrder(timestamp);

            expect(result).toEqual("05:06 | Wed, Jan 01, '25");
        });

        it('shows the year for a timestamp one minute into next year', () => {
            jest.setSystemTime(new Date(2026, 11, 31, 23, 59));
            const timestamp = new Date(2027, 0, 1, 0, 0);

            const result = DateTimeUtils.listFormattedDateOrder(timestamp);

            expect(result).toEqual("00:00 | Fri, Jan 01, '27");
        });

        it('shows the year for a timestamp one minute before new year', () => {
            jest.setSystemTime(new Date(2027, 0, 1, 0, 0));
            const timestamp = new Date(2026, 11, 31, 23, 59);

            const result = DateTimeUtils.listFormattedDateOrder(timestamp);

            expect(result).toEqual("23:59 | Thu, Dec 31, '26");
        });

        it('omits the year on the last minute of the current year', () => {
            jest.setSystemTime(new Date(2026, 11, 31, 23, 59));
            const timestamp = new Date(2026, 0, 1, 0, 0);

            const result = DateTimeUtils.listFormattedDateOrder(timestamp);

            expect(result).toEqual('00:00 | Thu, Jan 01');
        });

        it('returns N/A for an invalid date instead of throwing', () => {
            const result = DateTimeUtils.listFormattedDateOrder(
                new Date('not-a-date')
            );

            expect(result).toEqual('N/A');
        });
    });

    it.each([
        ['00:00', '12:00 am'],
        ['00:59', '12:59 am'],
        ['11:59', '11:59 am'],
        ['12:00', '12:00 pm'],
        ['14:30', '02:30 pm'],
        ['23:59', '11:59 pm']
    ])('formats %s on a 12-hour clock as %s', (clock, time) => {
        setDisplay({ timeFormat: '12h' });
        const [hours, minutes] = clock.split(':').map(Number);
        const timestamp = new Date(2026, 9, 8, hours, minutes);

        const result = DateTimeUtils.listFormattedDateOrder(timestamp);

        expect(result.split(' | ')[0]).toEqual(time);
    });

    it.each(['00:00', '00:59', '11:59', '12:00', '14:30', '23:59'])(
        'formats %s on a 24-hour clock by default',
        (clock) => {
            const [hours, minutes] = clock.split(':').map(Number);
            const timestamp = new Date(2026, 9, 8, hours, minutes);

            const result = DateTimeUtils.listFormattedDateOrder(timestamp);

            expect(result.split(' | ')[0]).toEqual(clock);
        }
    );
});

describe('display settings', () => {
    // 2025 is a past year, so the default format shows it
    const past = new Date(2025, 2, 4, 14, 5, 9);
    const current = new Date(2026, 2, 4, 14, 5, 9);
    const seconds = (date: Date) => date.getTime() / 1000;

    beforeEach(() => {
        jest.useFakeTimers().setSystemTime(new Date(2026, 5, 15, 12, 0));
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it.each([
        [{}, 'Mar 4, 14:05', "Mar 4, '25, 14:05", '14:05 | Wed, Mar 04'],
        [
            { timeFormat: '12h' },
            'Mar 4, 02:05 pm',
            "Mar 4, '25, 02:05 pm",
            '02:05 pm | Wed, Mar 04'
        ],
        [
            { showSeconds: true },
            'Mar 4, 14:05:09',
            "Mar 4, '25, 14:05:09",
            '14:05:09 | Wed, Mar 04'
        ],
        [
            { timeFormat: '12h', showSeconds: true },
            'Mar 4, 02:05:09 pm',
            "Mar 4, '25, 02:05:09 pm",
            '02:05:09 pm | Wed, Mar 04'
        ],
        [
            { dateFormat: 'iso' },
            '2026-03-04, 14:05',
            '2025-03-04, 14:05',
            '14:05 | 2026-03-04'
        ],
        [
            { dateFormat: 'dmy' },
            '04/03/2026, 14:05',
            '04/03/2025, 14:05',
            '14:05 | 04/03/2026'
        ],
        [
            { dateFormat: 'mdy', timeFormat: '12h', showSeconds: true },
            '03/04/2026, 02:05:09 pm',
            '03/04/2025, 02:05:09 pm',
            '02:05:09 pm | 03/04/2026'
        ],
        [
            { dateFormat: 'unknown', timeFormat: 'unknown' },
            'Mar 4, 14:05',
            "Mar 4, '25, 14:05",
            '14:05 | Wed, Mar 04'
        ]
    ])('formats with %j', (display, shortCurrent, shortPast, order) => {
        setDisplay(display);

        expect(DateTimeUtils.listFormattedDateShort(seconds(current))).toEqual(
            shortCurrent
        );
        expect(DateTimeUtils.listFormattedDateShort(seconds(past))).toEqual(
            shortPast
        );
        expect(DateTimeUtils.listFormattedDateOrder(current)).toEqual(order);
        expect(DateTimeUtils.formatDateTimeShort(current)).toEqual(
            shortCurrent
        );
    });

    it('applies the settings to the full format', () => {
        setDisplay({ dateFormat: 'iso', timeFormat: '12h', showSeconds: true });

        expect(DateTimeUtils.listFormattedDate(seconds(past))).toMatch(
            /^2025-03-04, 02:05:09 pm /
        );
        expect(DateTimeUtils.formatDateTime(past)).toMatch(
            /^2025-03-04, 02:05:09 pm /
        );
    });

    it('keeps an explicit format over the settings', () => {
        setDisplay({ dateFormat: 'iso', timeFormat: '12h' });

        expect(DateTimeUtils.listFormattedDate(seconds(past), 'HH:MM')).toEqual(
            '14:05'
        );
    });

    it('reads the settings on every call', () => {
        expect(DateTimeUtils.formatDateTimeShort(current)).toEqual(
            'Mar 4, 14:05'
        );

        setDisplay({ timeFormat: '12h' });

        expect(DateTimeUtils.formatDateTimeShort(current)).toEqual(
            'Mar 4, 02:05 pm'
        );
    });
});

describe('formatDateTime and formatDateTimeShort', () => {
    it('accepts ISO strings and millisecond timestamps', () => {
        const date = new Date(2024, 11, 26, 21, 21);

        expect(DateTimeUtils.formatDateTimeShort(date.toISOString())).toEqual(
            "Dec 26, '24, 21:21"
        );
        expect(DateTimeUtils.formatDateTimeShort(date.getTime())).toEqual(
            "Dec 26, '24, 21:21"
        );
        expect(DateTimeUtils.formatDateTime(date)).toMatch(
            /^Thu, Dec 26 '24, 21:21 /
        );
    });

    it.each([undefined, 'not-a-date', NaN])('returns N/A for %p', (input) => {
        expect(DateTimeUtils.formatDateTime(input)).toEqual('N/A');
        expect(DateTimeUtils.formatDateTimeShort(input)).toEqual('N/A');
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

describe('formatDate', () => {
    it('returns N/A for invalid dates', () => {
        expect(DateTimeUtils.formatDate(new Date('invalid'))).toBe('N/A');
        expect(DateTimeUtils.formatDate(undefined)).toBe('N/A');
    });

    it('omits the year for the current year with the default format', () => {
        const date = new Date(new Date().getFullYear(), 2, 4, 12, 0, 0); // March 4
        expect(DateTimeUtils.formatDate(date)).toBe('Mar 4');
    });

    it('includes the year for a past year with the default format', () => {
        const date = new Date(2023, 2, 4, 12, 0, 0);
        expect(DateTimeUtils.formatDate(date)).toBe("Mar 4, '23");
    });

    it('accepts an ISO string', () => {
        setDisplay({ dateFormat: 'iso' });
        // Using a local time string here so it doesn't shift to the previous day
        expect(DateTimeUtils.formatDate('2024-03-04T12:00:00')).toBe(
            '2024-03-04'
        );
    });

    it('respects the dmy date format setting', () => {
        setDisplay({ dateFormat: 'dmy' });
        const date = new Date(2024, 2, 4, 12, 0, 0);
        expect(DateTimeUtils.formatDate(date)).toBe('04/03/2024');
    });

    it('respects the mdy date format setting', () => {
        setDisplay({ dateFormat: 'mdy' });
        const date = new Date(2024, 2, 4, 12, 0, 0);
        expect(DateTimeUtils.formatDate(date)).toBe('03/04/2024');
    });
});
