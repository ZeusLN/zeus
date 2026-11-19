import Base64Utils from './Base64Utils';
import { hmacSha256 } from './HashingUtils';
import { ecdsaSignDERHex, getCompressedPublicKeyHex } from './SigningUtils';

export const LNURLAUTH_CANONICAL_PHRASE =
    'DO NOT EVER SIGN THIS TEXT WITH YOUR PRIVATE KEYS! IT IS ONLY USED FOR DERIVATION OF LNURL-AUTH HASHING-KEY, DISCLOSING ITS SIGNATURE WILL COMPROMISE YOUR LNURL-AUTH IDENTITY AND MAY LEAD TO LOSS OF FUNDS!';

// Case and whitespace are normalised before comparing because a signMessage
// implementation (or a remote requester) may trim, re-case or re-flow the
// text; any variant that could yield the same hashing key must be refused.
// The compare is on the string, so it relies on every backend signing the
// message's UTF-8 bytes (see EmbeddedLND.signMessage).
const normalize = (message: string): string =>
    message.trim().replace(/\s+/g, ' ').toLowerCase();

const RESERVED_NORMALIZED = normalize(LNURLAUTH_CANONICAL_PHRASE);

export const isReservedSigningMessage = (message: string): boolean =>
    typeof message === 'string' && normalize(message) === RESERVED_NORMALIZED;

// LUD-05 linking key, following
// https://github.com/hsjoberg/blixt-wallet/blob/931c625666633915412bf7d8947ef6c2c5ce92b3/src/state/LNURL.ts:
// the backend's lnurlAuth returns hashingKey (sha256 of the node's signature
// of LNURLAUTH_CANONICAL_PHRASE), and the service-specific linkingPrivKey is
// hmacSha256(hashingKey, domain). The domain is converted with
// Base64Utils.stringToUint8Array (one byte per code point), not UTF-8; keep it
// that way or existing linking keys change.
export const signLnurlAuthChallenge = (
    hashingKey: Uint8Array,
    domain: string,
    k1: string
): { linkingKeyPub: string; signedMessageDERHex: string } => {
    const linkingKeyPriv = hmacSha256(
        hashingKey,
        Base64Utils.stringToUint8Array(domain)
    );

    return {
        linkingKeyPub: getCompressedPublicKeyHex(linkingKeyPriv),
        signedMessageDERHex: ecdsaSignDERHex(
            Base64Utils.hexToBytes(k1),
            linkingKeyPriv
        )
    };
};
