import { getParams } from 'js-lnurl';

import {
    isLnurlCallbackAllowed,
    isLnurlEndpointAllowed
} from './LnurlPayUtils';
import { localeString } from './LocaleUtils';

const UNSAFE_LNURL_ERROR = 'UnsafeLnurlError';

/**
 * A refusal by the lnurl host policy. Callers that wrap resolve failures in
 * their own generic message should rethrow this one unchanged, so the user
 * sees why the request was cancelled.
 *
 * Identified by name rather than instanceof, which transpiled Error
 * subclasses do not reliably support.
 */
const unsafeLnurlError = (message: string) => {
    const error = new Error(message);
    error.name = UNSAFE_LNURL_ERROR;
    return error;
};

export const isUnsafeLnurlError = (error: any): boolean =>
    error?.name === UNSAFE_LNURL_ERROR;

/**
 * js-lnurl's getParams behind the endpoint policy. Every resolve goes through
 * here, so a caller that is reached without passing through handleAnything
 * (the ChoosePaymentMethod rows, fed by a BIP21 `lightning=` parameter) is
 * policed the same way. Rejects with a localized, user-facing message.
 *
 * The callback the response carries is checked here too, before the user
 * creates an invoice for a withdraw that could never be paid to it. The
 * checks at each callback fetch stay, for params that arrive another way.
 *
 * Kept apart from LnurlPayUtils so that module stays free of localization.
 */
export const getLnurlParams = async (lnurl: string) => {
    if (!isLnurlEndpointAllowed(lnurl).ok) {
        throw unsafeLnurlError(localeString('utils.lnurl.unsafeEndpoint'));
    }
    const params = await getParams(lnurl);
    const callback: string | undefined = (params as any)?.callback;
    if (callback && !isLnurlCallbackAllowed(callback).ok) {
        throw unsafeLnurlError(localeString('utils.lnurl.unsafeCallback'));
    }
    return params;
};
