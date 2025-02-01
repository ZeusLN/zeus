const userFriendlyErrors: any = {
    'Error: SOCKS: Connection refused': 'error.connectionRefused',
    'Error: SOCKS: Host unreachable': 'error.hostUnreachable',
    'Error: called `Result::unwrap()` on an `Err` value: BootStrapError("Timeout waiting for bootstrap")':
        'error.torBootstrap',
    'Error: called `Result::unwrap()` on an `Err` value: BootStrapError("Timeout waiting for boostrap")':
        'error.torBootstrap',
    'Error: Failed to connect to': 'error.nodeConnectError',
    'Error: Unable to resolve host': 'error.nodeConnectError',
    FAILURE_REASON_TIMEOUT: 'error.failureReasonTimeout',
    FAILURE_REASON_NO_ROUTE: 'error.failureReasonNoRoute',
    FAILURE_REASON_ERROR: 'error.failureReasonError',
    FAILURE_REASON_INCORRECT_PAYMENT_DETAILS:
        'error.failureReasonIncorrectPaymentDetails',
    FAILURE_REASON_INSUFFICIENT_BALANCE:
        'error.failureReasonInsufficientBalance',
    Error: 'general.error'
};

const pascalCase = /^[A-Z](([a-z0-9]+[A-Z]?)*)$/;

const errorToUserFriendly = (error: Error, errorContext?: string[]) => {
    let errorMessage: string = error?.message;
    let errorObject: any;

    try {
        errorObject = JSON.parse(errorMessage || error.toString());
    } catch {
        // ignore - using original error message
    }

    let errorMsg =
        errorObject?.error?.message ||
        errorObject?.message ||
        errorMessage ||
        error;

    // Handle LSP spec error message formatting
    if (pascalCase.test(errorMsg)) {
        // remove capital demarcation with spaces, move all to lowercase
        errorMsg = errorMsg
            .split(/(?=[A-Z])/)
            .join(' ')
            .toLowerCase();
        // capitalize first letter
        errorMsg = errorMsg.charAt(0).toUpperCase() + errorMsg.slice(1);
    }

    const matchingPattern = Object.keys(userFriendlyErrors).find((pattern) =>
        pattern === 'Error' ? errorMsg === pattern : errorMsg.includes(pattern)
    );

    let localeKey = matchingPattern
        ? userFriendlyErrors[matchingPattern]
        : null;

    const localeString = require('./LocaleUtils').localeString;
    let baseError = localeKey
        ? localeString(localeKey)?.replace('Zeus', 'ZEUS')
        : errorMsg;

    if (
        errorContext?.includes('Keysend') &&
        errorMsg === 'FAILURE_REASON_INCORRECT_PAYMENT_DETAILS'
    ) {
        baseError +=
            ' ' +
            localeString('error.failureReasonIncorrectPaymentDetailsKeysend');
    }
    return baseError;
};

export { errorToUserFriendly };
