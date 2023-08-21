const userFriendlyErrors: any = {
    'Error: SOCKS: Connection refused': 'error.connectionRefused',
    'Error: SOCKS: Host unreachable': 'error.hostUnreachable',
    'Error: called `Result::unwrap()` on an `Err` value: BootStrapError("Timeout waiting for bootstrap")':
        'error.torBootstrap',
    'Error: called `Result::unwrap()` on an `Err` value: BootStrapError("Timeout waiting for boostrap")':
        'error.torBootstrap',
    FAILURE_REASON_TIMEOUT: 'error.failureReasonTimeout',
    FAILURE_REASON_NO_ROUTE: 'error.failureReasonNoRoute',
    FAILURE_REASON_ERROR: 'error.failureReasonError',
    FAILURE_REASON_INCORRECT_PAYMENT_DETAILS:
        'error.failureReasonIncorrectPaymentDetails',
    FAILURE_REASON_INSUFFICIENT_BALANCE:
        'error.failureReasonInsufficientBalance'
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
