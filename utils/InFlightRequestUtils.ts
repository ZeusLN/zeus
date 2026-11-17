import Base64Utils from './Base64Utils';
import { sha256Hex } from './HashingUtils';

// TLS settings a request is checked under. They are part of the key so a
// request made after the pin or the verification mode changed does not
// reuse one still pending under the old settings.
export interface InFlightTlsOptions {
    certVerification?: boolean;
    pinnedCerts?: string[];
}

// Key under which the REST backends share one in-flight request between
// identical calls. The headers carry the credential (macaroon, rune or
// access token), so they are part of the key: two accounts on the same
// host must not get each other's response. Only a hash of the headers is
// kept, so the credential itself is not held in the key.
export const inFlightRequestKey = (
    headers: any,
    url: string,
    data?: any,
    tls?: InFlightTlsOptions
): string => {
    const headersHash = headers
        ? sha256Hex(Base64Utils.utf8ToBytes(JSON.stringify(headers)))
        : '';
    // use body data as an identifier too, we don't want to share a request
    // when we are making multiple calls to get all the node names, for
    // example
    const body = data ? JSON.stringify(data) : '';
    const key = `${headersHash}:${url}${body}`;
    if (!tls) return key;
    // no pins and an empty pin list configure the transport the same way
    const pinsHash =
        tls.pinnedCerts && tls.pinnedCerts.length > 0
            ? sha256Hex(
                  Base64Utils.utf8ToBytes(JSON.stringify(tls.pinnedCerts))
              )
            : '';
    // prefixed: neither segment contains a colon, so the key stays
    // unambiguous whatever the url and body hold
    return `${tls.certVerification ? 'verify' : 'trust'}:${pinsHash}:${key}`;
};
