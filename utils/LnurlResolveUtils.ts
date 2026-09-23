import { getParams } from 'js-lnurl';

import { isLnurlEndpointAllowed } from './LnurlPayUtils';
import { localeString } from './LocaleUtils';

/**
 * js-lnurl's getParams behind the endpoint policy. Every resolve goes through
 * here, so a caller that is reached without passing through handleAnything
 * (the ChoosePaymentMethod rows, fed by a BIP21 `lightning=` parameter) is
 * policed the same way. Rejects with a localized, user-facing message.
 *
 * Kept apart from LnurlPayUtils so that module stays free of localization.
 */
export const getLnurlParams = async (lnurl: string) => {
    if (!isLnurlEndpointAllowed(lnurl).ok) {
        throw new Error(localeString('utils.lnurl.unsafeEndpoint'));
    }
    return getParams(lnurl);
};
