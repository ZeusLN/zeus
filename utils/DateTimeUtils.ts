const dateFormat = require('dateformat');

class DateTimeUtils {
    listFormattedDate = (timestamp: number | string) => {
        const date = new Date(Number(timestamp) * 1000);
        return dateFormat(date, "ddd, mmm d 'yy, HH:MM:ss Z");
    };
}

const dateTimeUtils = new DateTimeUtils();
export default dateTimeUtils;
