export const LNURLAUTH_CANONICAL_PHRASE =
    'DO NOT EVER SIGN THIS TEXT WITH YOUR PRIVATE KEYS! IT IS ONLY USED FOR DERIVATION OF LNURL-AUTH HASHING-KEY, DISCLOSING ITS SIGNATURE WILL COMPROMISE YOUR LNURL-AUTH IDENTITY AND MAY LEAD TO LOSS OF FUNDS!';

// Case and whitespace are normalised before comparing because a signMessage
// implementation (or a remote requester) may trim, re-case or re-flow the
// text; any variant that could yield the same hashing key must be refused.
const normalize = (message: string): string =>
    message.trim().replace(/\s+/g, ' ').toLowerCase();

const RESERVED_NORMALIZED = normalize(LNURLAUTH_CANONICAL_PHRASE);

export const isReservedSigningMessage = (message: string): boolean =>
    typeof message === 'string' && normalize(message) === RESERVED_NORMALIZED;
