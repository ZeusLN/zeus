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
    try {
        errorObject = JSON.parse(error);
    } catch (err) {
        if (localize) {
            const localeString = require('./LocaleUtils').localeString;
            return (
                localeString(userFriendlyErrors[error])?.replace(
                    'Zeus',
                    'ZEUS'
                ) || error
            );
        } else {
            const EN = require('../locales/en.json');
            return EN[userFriendlyErrors[error]] || error;
        }
    }

    // If the parsed object has a message property, return it
    if (errorObject && typeof errorObject === 'object' && errorObject.message) {
        return errorObject.message;
    }

    // If the parsed object has an error object with a message property, return that
    if (
        errorObject &&
        typeof errorObject === 'object' &&
        errorObject.error &&
        errorObject.error.message
    ) {
        return errorObject.error.message;
    }
};

export { errorToUserFriendly };
