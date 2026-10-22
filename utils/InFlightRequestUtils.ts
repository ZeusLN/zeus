import { hash as sha256 } from 'fast-sha256';
import Base64Utils from './Base64Utils';

// Key under which the REST backends share one in-flight request between
// identical calls. The headers carry the credential (macaroon, rune or
// access token), so they are part of the key: two accounts on the same
// host must not get each other's response. Only a hash of the headers is
// kept, so the credential itself is not held in the key.
export const inFlightRequestKey = (
    headers: any,
    url: string,
    data?: any
): string => {
    const headersHash = headers
        ? Base64Utils.bytesToHex(
              Array.from(
                  sha256(Base64Utils.utf8ToBytes(JSON.stringify(headers)))
              )
          )
        : '';
    // use body data as an identifier too, we don't want to share a request
    // when we are making multiple calls to get all the node names, for
    // example
    const body = data ? JSON.stringify(data) : '';
    return `${headersHash}:${url}${body}`;
};
