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

const errorToUserFriendly = (error: Error, localize = true) => {
    if (typeof error === 'object') {
        let errorMessage: object | string | any = error.message;

        if (typeof errorMessage === 'string') {
            errorMessage = JSON.parse(errorMessage || '{}');
        }

        if (errorMessage && errorMessage?.message) {
            return errorMessage?.message;
        }

        if (
            errorMessage &&
            errorMessage?.error &&
            errorMessage?.error?.message
        ) {
            return errorMessage?.error?.message;
        }
    } else {
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
};

export { errorToUserFriendly };
