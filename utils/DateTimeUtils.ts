const dateFormat = require('dateformat');

class DateTimeUtils {
    listDate = (timestamp: number | string | Date) =>
        new Date(Number(timestamp) * 1000);
    listFormattedDate = (
        timestamp: number | string | Date,
        format = "ddd, mmm d 'yy, HH:MM:ss Z"
    ) => {
        try {
            const date = this.listDate(timestamp);
            return dateFormat(date, format).toString();
        } catch (error) {
            return timestamp.toString() || 'N/A';
        }
    };

    listFormattedDateShort = (timestamp: number | string) =>
        this.listFormattedDate(timestamp, "mmm d 'yy");
}

const dateTimeUtils = new DateTimeUtils();
export default dateTimeUtils;
