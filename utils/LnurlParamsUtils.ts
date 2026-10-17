import querystring from 'querystring-es3';
import { getParams } from 'js-lnurl';
import { decodelnurl, getDomain } from 'js-lnurl/lib/helpers';

import { networkFetch } from './NetworkUtils';

// js-lnurl's getParams fetches with cross-fetch, which cannot use Tor. With
// Tor enabled, resolve the params here instead: the same steps and result
// shape as js-lnurl 0.6.0 getParams, but the request goes through
// networkFetch. With Tor disabled, js-lnurl is used unchanged.
export const getLnurlParams = async (
    lnurl: string,
    enableTor?: boolean
): Promise<any> => {
    if (!enableTor) return getParams(lnurl);

    let url: string;
    try {
        url = decodelnurl(lnurl);
    } catch (err) {
        return { status: 'ERROR', reason: `invalid lnurl '${lnurl}'` };
    }

    // login and fully specified withdraw links carry everything needed,
    // so there is nothing to fetch
    const spl = url.split('?');
    if (spl.length > 1) {
        const params: any = querystring.parse(spl[1]);
        if (params.tag === 'login') {
            return {
                tag: 'login',
                k1: params.k1,
                callback: url,
                domain: getDomain(url)
            };
        }
        if (params.tag === 'withdrawRequest' && params.k1 && params.callback) {
            return { ...params, domain: getDomain(params.callback) };
        }
    }

    try {
        const response = await networkFetch({ method: 'get', url, enableTor });
        if (response.info().status >= 300) {
            throw new Error(String(await response.text()));
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
                    return { ...res, domain: getDomain(url), url };
                }
                throw new Error(`unknown tag: ${res.tag}`);
        }
    } catch (err: any) {
        return {
            status: 'ERROR',
            reason: `${url} returned error: ${err.message}`,
            url,
            domain: getDomain(url)
        };
    }
};
