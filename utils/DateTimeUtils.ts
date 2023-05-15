const dateFormat = require('dateformat');

class DateTimeUtils {
    listDate = (timestamp: number | string | Date) =>
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

    listFormattedDateShort = (timestamp: number | string) =>
        this.listFormattedDate(timestamp, 'mmm d, HH:MM');

    listFormattedDateOrder = (timestamp: Date) => {
        const updated = dateFormat(timestamp, 'hh:mm tt');
        const day = dateFormat(timestamp, 'ddd, mmm dd');
        return `${updated} | ${day}`;
    };
}

const dateTimeUtils = new DateTimeUtils();
export default dateTimeUtils;
