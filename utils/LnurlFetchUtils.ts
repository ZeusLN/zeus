import url from 'url';
import querystring from 'querystring-es3';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { decodelnurl, getDomain } from 'js-lnurl/lib/helpers';

import { isLnurlCallbackAllowed } from './LnurlPayUtils';
import { localeString } from './LocaleUtils';

const UNSAFE_LNURL_ERROR = 'UnsafeLnurlError';

// Enough for a move to a canonical host plus a trailing-slash fix, with room
// to spare. Browsers allow 20; an lnurl service has no reason to need more
// than a few.
export const MAX_LNURL_REDIRECTS = 5;

const REDIRECT_STATUSES = [301, 302, 303, 307, 308];

/**
 * A refusal by the lnurl host policy. Callers that wrap resolve failures in
 * their own generic message should rethrow this one unchanged, so the user
 * sees why the request was cancelled.
 *
 * Identified by name rather than instanceof, which transpiled Error
 * subclasses do not reliably support.
 */
export const unsafeLnurlError = (message: string) => {
    const error = new Error(message);
    error.name = UNSAFE_LNURL_ERROR;
    return error;
};

export const isUnsafeLnurlError = (error: any): boolean =>
    error?.name === UNSAFE_LNURL_ERROR;

const getHeader = (headers: any, name: string): string | undefined => {
    if (!headers) return undefined;
    const key = Object.keys(headers).find(
        (k) => k.toLowerCase() === name.toLowerCase()
    );
    return key ? headers[key] : undefined;
};

/**
 * GET an lnurl endpoint, callback, or lightning address well-known URL with
 * the host policy applied to every hop.
 *
 * The native HTTP stacks follow redirects on their own, and cleartext is
 * allowed on both platforms, so a public https URL that answers with a
 * redirect to `http://192.168.1.1/` would otherwise reach the LAN. Redirects
 * are followed here instead, one at a time: each Location is resolved
 * against the URL that returned it, checked with isLnurlCallbackAllowed, and
 * only then requested. The string that is checked is the string that is
 * fetched, so the policy and the native URL parser cannot disagree about the
 * host.
 *
 * Resolves with the final ReactNativeBlobUtil response, whatever its status.
 * Rejects with an UnsafeLnurlError when a hop is refused.
 */
export const fetchLnurlUrl = async (target: string): Promise<any> => {
    let current = target;
    for (let redirects = 0; ; redirects++) {
        if (!isLnurlCallbackAllowed(current).ok) {
            throw unsafeLnurlError(
                localeString(
                    redirects === 0
                        ? 'utils.lnurl.unsafeCallback'
                        : 'utils.lnurl.unsafeRedirect'
                )
            );
        }

        const response = await ReactNativeBlobUtil.config({
            followRedirect: false
        }).fetch('get', current);

        const info = response.info();
        const location = getHeader(info?.headers, 'location');
        if (!REDIRECT_STATUSES.includes(info?.status) || !location) {
            return response;
        }

        if (redirects >= MAX_LNURL_REDIRECTS) {
            throw new Error(localeString('utils.lnurl.tooManyRedirects'));
        }
        current = url.resolve(current, location.trim());
    }
};

/**
 * js-lnurl 0.6.0's getParams, fetching through fetchLnurlUrl. js-lnurl
 * fetches with cross-fetch, which follows redirects with no way to stop it,
 * so the resolve is done here instead. The result has the same shape:
 * decode and network failures resolve to a `status: 'ERROR'` object, and
 * only a refusal by the host policy rejects.
 */
export const fetchLnurlParams = async (lnurl: string): Promise<any> => {
    let target: string;
    try {
        target = decodelnurl(lnurl);
    } catch (err) {
        return { status: 'ERROR', reason: `invalid lnurl '${lnurl}'` };
    }

    // login links, and withdraw links carrying k1 and callback, are complete
    // without a request
    const spl = target.split('?');
    if (spl.length > 1) {
        const params: any = querystring.parse(spl[1]);
        if (params.tag === 'login') {
            return {
                tag: 'login',
                k1: params.k1,
                callback: target,
                domain: getDomain(target)
            };
        } else if (
            params.tag === 'withdrawRequest' &&
            params.k1 &&
            params.callback
        ) {
            return { ...params, domain: getDomain(params.callback) };
        }
    }

    try {
        const response = await fetchLnurlUrl(target);
        if (response.info().status >= 300) {
            throw new Error(response.text());
        }

        let res: any;
        try {
            res = response.json();
        } catch (err) {
            throw new Error('(invalid JSON)');
        }

        if (res.callback) {
            res.domain = getDomain(res.callback);
        }

        switch (res.tag) {
            case 'withdrawRequest':
            case 'channelRequest':
                return res;
            case 'payRequest':
                try {
                    res.decodedMetadata = JSON.parse(res.metadata);
                } catch (err) {
                    res.decodedMetadata = [];
                }
                res.commentAllowed =
                    typeof res.commentAllowed === 'number'
                        ? res.commentAllowed
                        : 0;
                return res;
            default:
                if (res.status === 'ERROR') {
                    return { ...res, domain: getDomain(target), url: target };
                }
                throw new Error('unknown tag: ' + res.tag);
        }
    } catch (err: any) {
        if (isUnsafeLnurlError(err)) throw err;
        return {
            status: 'ERROR',
            reason: `${target} returned error: ${err?.message}`,
            url: target,
            domain: getDomain(target)
        };
    }
};
