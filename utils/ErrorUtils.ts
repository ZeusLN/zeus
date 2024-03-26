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
    let errorMessage: string = error.message;
    let errorObject: any;

    try {
        errorObject = JSON.parse(errorMessage);
    } catch (err) {
        console.log(err);
    }

    const userFriendlyErrorMessage =
        errorObject?.error?.message || errorObject?.message || errorMessage;

    if (localize) {
        const localeString = require('./LocaleUtils').localeString;
        return (
            localeString(userFriendlyErrors[userFriendlyErrorMessage])?.replace(
                'Zeus',
                'ZEUS'
            ) || userFriendlyErrorMessage
        );
    } else {
        const EN = require('../locales/en.json');
        return (
            EN[userFriendlyErrors[userFriendlyErrorMessage]] ||
            userFriendlyErrorMessage
        );
    }
};

export { errorToUserFriendly };
