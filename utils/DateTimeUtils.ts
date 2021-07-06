const dateFormat = require('dateformat');

class DateTimeUtils {
    listFormattedDate = (
        timestamp: number | string,
        format: string = "ddd, mmm d 'yy, HH:MM:ss Z"
    ) => {
        try {
            const date = new Date(Number(timestamp) * 1000);
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
