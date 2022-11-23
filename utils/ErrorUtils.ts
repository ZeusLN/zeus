const userFriendlyErrors: any = {
    'Error: SOCKS: Connection refused': 'error.connectionRefused',
    'Error: SOCKS: Host unreachable': 'error.hostUnreachable',
    'Error: called `Result::unwrap()` on an `Err` value: BootStrapError("Timeout waiting for bootstrap")':
        'error.torBootstrap',
    'Error: called `Result::unwrap()` on an `Err` value: BootStrapError("Timeout waiting for boostrap")':
        'error.torBootstrap'
};

class ErrorUtils {
    errorToUserFriendly = (error: string, localize = true) => {
        if (localize) {
            const localeString = require('./LocaleUtils').localeString;
            return localeString(userFriendlyErrors[error]) || error;
        } else {
            const EN = require('../locales/en.json');
            return EN[userFriendlyErrors[error]] || error;
        }
    };
}

const errorUtils = new ErrorUtils();
export default errorUtils;
