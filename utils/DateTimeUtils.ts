const dateFormat = require('dateformat');

class DateTimeUtils {
    listFormattedDate = (timestamp: nu,ber) => {
        const date = new Date(timestamp * 1000);
        return dateFormat(date, "ddd, mmm d 'yy, HH:MM:ss Z");
    };
};

const dateTimeUtils = new DateTimeUtils();
export default dateTimeUtils;