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

const errorToUserFriendly = (error: string, localize = true) => {
    let errorObject;
    // Check if the error string is in JSON format
    if (error.startsWith('{') && error.endsWith('}')) {
        try {
            errorObject = JSON.parse(error);
        } catch (err) {
            console.error('Error parsing JSON:', err);
        }
    }

    // If the error is parsed successfully and has a message property, return it
    if (errorObject && errorObject.message) {
        return errorObject.message;
    } else if (errorObject && errorObject.error && errorObject.error.message) {
        return errorObject.error.message;
    }

    if (localize) {
        const localeString = require('./LocaleUtils').localeString;
        return (
            localeString(userFriendlyErrors[error])?.replace('Zeus', 'ZEUS') ||
            error
        );
    } else {
        const EN = require('../locales/en.json');
        return EN[userFriendlyErrors[error]] || error;
    }
};

export { errorToUserFriendly };
