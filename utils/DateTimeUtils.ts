import dateFormat from 'dateformat';

class DateTimeUtils {
    listDate = (timestamp: number | string) =>
        new Date(Number(timestamp) * 1000);

    listFormattedDate = (
        timestamp: number | string,
        format = "ddd, mmm d 'yy, HH:MM Z"
    ) => {
        try {
            const date = this.listDate(timestamp);
            return dateFormat(date, format).toString();
        } catch (error) {
            return timestamp.toString() || 'N/A';
        }
    };

    listFormattedDateShort = (timestamp: number | string) => {
        const date = new Date(Number(timestamp) * 1000);
        const currentYear = new Date().getFullYear();
        const dateYear = date.getFullYear();

        const format =
            dateYear !== currentYear ? "mmm d, 'yy, HH:MM" : 'mmm d, HH:MM';

        return this.listFormattedDate(timestamp, format);
    };

    listFormattedDateOrder = (timestamp: Date) => {
        const currentYear = new Date().getFullYear();
        const dateYear = timestamp.getFullYear();

        const time = dateFormat(timestamp, 'HH:MM tt');
        const monthAndDay = dateFormat(timestamp, 'ddd, mmm dd');
        const year =
            dateYear !== currentYear ? `, '${dateFormat(timestamp, 'yy')}` : '';

        return `${time} | ${monthAndDay}${year}`;
    };

    blocksToDaysRounded = (blocks: number) => {
        // 1440 minutes in a day
        // 144 blocks in a day w/ 10 min blocks
        const blocksPerDay = 144;
        return Math.round(blocks / blocksPerDay);
    };
}

const dateTimeUtils = new DateTimeUtils();
export default dateTimeUtils;
