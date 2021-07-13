const dateFormat = require('dateformat');

class DateTimeUtils {
    listDate = (timestamp: number | string) =>
        new Date(Number(timestamp) * 1000);
    listFormattedDate = (
        timestamp: number | string,
        format: string = "ddd, mmm d 'yy, HH:MM:ss Z"
    ) => {
        try {
            const date = this.listDate(timestamp);
            return dateFormat(date, format);
        } catch (error) {
            return timestamp || 'N/A';
        }
    };

    listFormattedDateShort = (timestamp: number | string) =>
        this.listFormattedDate(timestamp, "mmmm d 'yy");
}

const dateTimeUtils = new DateTimeUtils();
export default dateTimeUtils;
