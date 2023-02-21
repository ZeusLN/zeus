const dateFormat = require('dateformat');

class DateTimeUtils {
    listDate = (timestamp: number | string | Date) =>
        new Date(Number(timestamp) * 1000);
    listFormattedDate = (
        timestamp: number | string,
        format = 'd / mm / yyyy HH:MM Z'
    ) => {
        try {
            const date = this.listDate(timestamp);
            return dateFormat(date, format).toString();
        } catch (error) {
            return timestamp.toString() || 'N/A';
        }
    };

    listFormattedDateShort = (timestamp: number | string) =>
        this.listFormattedDate(timestamp, 'd mmm yy');
}

const dateTimeUtils = new DateTimeUtils();
export default dateTimeUtils;
