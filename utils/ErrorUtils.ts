const userFriendlyErrors: any = {
    'Error: SOCKS: Connection refused': 'error.connectionRefused',
    'Error: SOCKS: Host unreachable': 'error.hostUnreachable',
    'Error: called `Result::unwrap()` on an `Err` value: BootStrapError("Timeout waiting for bootstrap")':
        'error.torBootstrap',
    'Error: called `Result::unwrap()` on an `Err` value: BootStrapError("Timeout waiting for boostrap")':
        'error.torBootstrap',
    'Error: Failed to connect to': 'error.nodeConnectError',
    'Error: Unable to resolve host': 'error.nodeConnectError',
    'Error: {"code":2,"message":"verification failed: signature mismatch after caveat verification","details":[]}':
        'error.invalidMacaroon',
    'ReactNativeBlobUtil failed to encode response data to BASE64 string.':
        'error.invalidResponse',
    FAILURE_REASON_TIMEOUT: 'error.failureReasonTimeout',
    FAILURE_REASON_NO_ROUTE: 'error.failureReasonNoRoute',
    FAILURE_REASON_ERROR: 'error.failureReasonError',
    FAILURE_REASON_INCORRECT_PAYMENT_DETAILS:
        'error.failureReasonIncorrectPaymentDetails',
    'Payment details incorrect': 'error.failureReasonIncorrectPaymentDetails',
    FAILURE_REASON_INSUFFICIENT_BALANCE:
        'error.failureReasonInsufficientBalance',
    // LDK Node payment failure reasons
    recipientRejected: 'error.ldk.recipientRejected',
    retriesExhausted: 'error.ldk.retriesExhausted',
    routeNotFound: 'error.ldk.routeNotFound',
    paymentExpired: 'error.ldk.paymentExpired',
    unknownRequiredFeatures: 'error.ldk.unknownRequiredFeatures',
    invoiceRequestExpired: 'error.ldk.invoiceRequestExpired',
    invoiceRequestRejected: 'error.ldk.invoiceRequestRejected',
    blindedPathCreationFailed: 'error.ldk.blindedPathCreationFailed',
    PAYMENT_FAILED_UNKNOWN: 'error.paymentFailed',
    Error: 'general.error'
};

// Parses LDK Node error strings from both platforms into clean messages.
// Android: "org.lightningdevkit.ldknode.NodeException.RefundCreationFailed: Failed to create refund."
// iOS:     "Error: RefundCreationFailed(message: \"Failed to create refund.\")"
const parseLdkNodeError = (error: any): string => {
    const str =
        typeof error === 'string'
            ? error
            : error?.message || error?.toString?.() || '';

    // Android: strip "org.lightningdevkit.ldknode.NodeException.<Type>: " prefix
    // Inner class separator can be "." or "$" depending on context
    const androidMatch = str.match(
        /org\.lightningdevkit\.ldknode\.NodeException[.$]\w+:\s*(.+)/
    );
    if (androidMatch) return androidMatch[1].trim();

    // iOS: extract message from "<Type>(message: "...")"
    const iosMatch = str.match(/\w+\(message:\s*"(.+?)"\)/);
    if (iosMatch) return iosMatch[1].trim();

    // Fallback: strip generic "Error: " prefix
    return str.replace(/^Error:\s*/, '').trim() || str;
};

// Parses CashuDevKit FFI error strings from both platforms into clean messages.
// cdk 0.17.x collapsed the FFI error into two variants, Cdk(code, errorMessage)
// and Internal(errorMessage), and the Kotlin bindings moved from the
// uniffi.cdk_ffi package to org.cashudevkit. The native modules normally
// unwrap these before rejecting, but raw shapes can still leak via generic
// catch paths:
// iOS:     "CashuDevKit.FfiError.Cdk(code: 20001, errorMessage: \"actual message\")"
//          (UniFFI generates errorDescription = String(reflecting: self))
// Android: "org.cashudevkit.FfiException$Cdk: code=20001, errorMessage=actual message"
// Pre-0.17 shapes ("...FfiError.Generic(message: ...)",
// "uniffi.cdk_ffi.FfiException$Generic: ...") are kept for robustness.
const parseCashuDevKitError = (error: any): string => {
    const str =
        typeof error === 'string'
            ? error
            : error?.message || error?.toString?.() || '';
    if (!str) return str;

    const iosWithAssoc = str.match(
        /CashuDevKit\.FfiError\.\w+\((?:code:\s*\d+,\s*)?(?:message|errorMessage):\s*"([\s\S]+?)"\)/
    );
    if (iosWithAssoc) return extractMintDetail(iosWithAssoc[1].trim());

    const iosBare = str.match(/CashuDevKit\.FfiError\.(\w+)/);
    if (iosBare) return humanizeVariantName(iosBare[1]);

    const androidMatch = str.match(
        /(?:uniffi\.cdk_ffi|org\.cashudevkit)\.FfiException[.$](\w+)(?::\s*([\s\S]+))?/
    );
    if (androidMatch) {
        // Kotlin's Internal variant formats its message as
        // "errorMessage=<text>" with no code prefix; strip the envelope
        const inner = androidMatch[2]?.trim().replace(/^errorMessage=\s*/, '');
        return inner
            ? extractMintDetail(inner)
            : humanizeVariantName(androidMatch[1]);
    }

    return extractMintDetail(str);
};

// Hard cap on Cashu error text bound for direct display. Mint failures can
// carry entire JSON documents in the error detail (e.g. an unparseable
// /v1/info body); the parsed message is truncated so a raw dump can never
// fill the screen.
const CASHU_ERROR_DISPLAY_LIMIT = 300;

const cashuErrorForDisplay = (error: any): string => {
    const parsed = parseCashuDevKitError(error);
    if (parsed.length <= CASHU_ERROR_DISPLAY_LIMIT) return parsed;
    return `${parsed.slice(0, CASHU_ERROR_DISPLAY_LIMIT).trimEnd()}…`;
};

// "InsufficientFunds" -> "Insufficient funds"
const humanizeVariantName = (variant: string): string => {
    const spaced = variant.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
    return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
};

// CDK formats mint error responses as:
//   "CDK Error: Unknown error response: `code: NNNN, detail: <human text>`"
// (or `code: NNNN, error: <text>` when the mint omits detail). The detail
// field is the user-facing description; everything before it (CDK Error
// prefix, code number, surrounding backticks) is plumbing. Strip it down
// to just the detail, capitalized.
const extractMintDetail = (msg: string): string => {
    const detailMatch = msg.match(
        /code[:=]\s*\d+,\s*(?:detail|error|errorMessage)[:=]\s*([\s\S]+)$/i
    );
    if (!detailMatch) return msg;

    let detail = detailMatch[1].trim();
    // Strip trailing wrappers that closed the original quoted form.
    while (/[`")\s]$/.test(detail)) {
        detail = detail.slice(0, -1);
    }
    if (!detail) return msg;
    return detail.charAt(0).toUpperCase() + detail.slice(1);
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
        pattern === 'Error' ? errorMsg === pattern : errorMsg?.includes(pattern)
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
        localeKey === 'error.failureReasonIncorrectPaymentDetails'
    ) {
        baseError +=
            ' ' +
            localeString('error.failureReasonIncorrectPaymentDetailsKeysend');
    }
    return baseError;
};

export {
    errorToUserFriendly,
    parseLdkNodeError,
    parseCashuDevKitError,
    cashuErrorForDisplay
};
