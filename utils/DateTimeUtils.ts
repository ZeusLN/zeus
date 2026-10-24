import dateFormat from 'dateformat';

import { settingsStore } from '../stores/Stores';
import { localeString } from './LocaleUtils';

// dateformat masks per DATE_FORMAT_KEYS value. 'mm' is the month and
// 'MM' the minutes. The default format omits the year in short and order
// dates for the current year; the numeric formats always include it.
const NUMERIC_DATE_MASKS: { [key: string]: string } = {
    iso: 'yyyy-mm-dd',
    dmy: 'dd/mm/yyyy',
    mdy: 'mm/dd/yyyy'
};

class DateTimeUtils {
    private displaySettings = () => settingsStore?.settings?.display;

    private numericDateMask = (): string | undefined =>
        NUMERIC_DATE_MASKS[this.displaySettings()?.dateFormat || ''];

    private timeMask = (): string => {
        const display = this.displaySettings();
        const seconds = display?.showSeconds ? ':ss' : '';
        return display?.timeFormat === '12h'
            ? `hh:MM${seconds} tt`
            : `HH:MM${seconds}`;
    };

    private isCurrentYear = (date: Date) =>
        date.getFullYear() === new Date().getFullYear();

    private fullMask = () =>
        `${this.numericDateMask() || "ddd, mmm d 'yy"}, ${this.timeMask()} Z`;

    private shortMask = (date: Date) => {
        const dateMask =
            this.numericDateMask() ||
            (this.isCurrentYear(date) ? 'mmm d' : "mmm d, 'yy");
        return `${dateMask}, ${this.timeMask()}`;
    };

    listDate = (timestamp: number | string | undefined) =>
        new Date(Number(timestamp) * 1000);

    listFormattedDate = (
        timestamp: number | string | undefined,
        format?: string
    ) => {
        try {
            const date = this.listDate(timestamp);
            return dateFormat(date, format || this.fullMask()).toString();
        } catch (error) {
            return (
                timestamp?.toString() || localeString('general.notAvailable')
            );
        }
    };

    listFormattedDateShort = (timestamp: number | string) =>
        this.listFormattedDate(
            timestamp,
            this.shortMask(this.listDate(timestamp))
        );

    listFormattedDateOrder = (timestamp: Date) => {
        // dateformat throws on an invalid Date
        if (isNaN(timestamp.getTime())) {
            return localeString('general.notAvailable');
        }

        const time = dateFormat(timestamp, this.timeMask());
        const numericDateMask = this.numericDateMask();
        if (numericDateMask) {
            return `${time} | ${dateFormat(timestamp, numericDateMask)}`;
        }

        const monthAndDay = dateFormat(timestamp, 'ddd, mmm dd');
        const year = this.isCurrentYear(timestamp)
            ? ''
            : `, '${dateFormat(timestamp, 'yy')}`;

        return `${time} | ${monthAndDay}${year}`;
    };

    // For Dates, ISO strings and millisecond timestamps, the inputs moment()
    // accepts. The list* methods above take Unix seconds.
    formatDateTime = (date: Date | string | number | undefined) =>
        this.formatDateObject(date, () => this.fullMask());

    formatDateTimeShort = (date: Date | string | number | undefined) =>
        this.formatDateObject(date, (d) => this.shortMask(d));

    private formatDateObject = (
        date: Date | string | number | undefined,
        mask: (date: Date) => string
    ) => {
        const parsed =
            date instanceof Date
                ? date
                : date === undefined
                ? new Date(NaN)
                : new Date(date);
        if (isNaN(parsed.getTime())) {
            return localeString('general.notAvailable');
        }
        return dateFormat(parsed, mask(parsed));
    };

    private dateOnlyMask = (date: Date): string =>
        this.numericDateMask() ||
        (this.isCurrentYear(date) ? 'mmm d' : "mmm d, 'yy");

    formatDate = (date: Date | string | number | undefined) =>
        this.formatDateObject(date, (d) => this.dateOnlyMask(d));

    blocksToMonthsAndDays = (blocks: number) => {
        const blocksPerDay = 144;
        const daysPerMonth = 30;

        // Calculate total days
        const totalDays = Math.round(blocks / blocksPerDay);

        // Calculate months and remaining days
        const months =
            Math.floor(Math.abs(totalDays) / daysPerMonth) *
            Math.sign(totalDays);
        const days =
            (Math.abs(totalDays) % daysPerMonth) * Math.sign(totalDays);

        return { months, days };
    };

    /**
     * Gets current Unix timestamp in seconds
     * @returns Current Unix timestamp (seconds since epoch)
     */
    getCurrentTimestamp = (): number => {
        return Math.floor(Date.now() / 1000);
    };
}

const dateTimeUtils = new DateTimeUtils();
export default dateTimeUtils;
