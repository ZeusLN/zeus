import {
    isLnurlCallbackAllowed,
    isLnurlEndpointAllowed
} from './LnurlPayUtils';
import {
    fetchLnurlParams,
    isUnsafeLnurlError,
    unsafeLnurlError
} from './LnurlFetchUtils';
import { localeString } from './LocaleUtils';

export { isUnsafeLnurlError };

/**
 * The lnurl resolve behind the endpoint policy. Every resolve goes through
 * here, so a caller that is reached without passing through handleAnything
 * (the ChoosePaymentMethod rows, fed by a BIP21 `lightning=` parameter) is
 * policed the same way. Rejects with a localized, user-facing message.
 *
 * Redirects the endpoint answers with are checked hop by hop (see
 * fetchLnurlUrl).
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
    const params = await fetchLnurlParams(lnurl);
    const callback: string | undefined = (params as any)?.callback;
    if (callback && !isLnurlCallbackAllowed(callback).ok) {
        throw unsafeLnurlError(localeString('utils.lnurl.unsafeCallback'));
    }
    return params;
};
