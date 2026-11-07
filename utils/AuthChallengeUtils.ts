// ZEUS Pay and Olympus authenticate the node by having it sign a server
// issued challenge: a service tag followed by 64 random bytes as lowercase
// hex. Each caller only signs challenges carrying its own service's tag, so
// the node key is never used to sign arbitrary text supplied by a server,
// and a challenge issued by one service can't be relayed to the other.
export const ZEUS_PAY_AUTH_TAG = 'zeuspay.com auth ';
export const OLYMPUS_AUTH_TAG = 'backups.lnolymp.us auth ';

export type AuthChallengeTag =
    | typeof ZEUS_PAY_AUTH_TAG
    | typeof OLYMPUS_AUTH_TAG;

const NONCE_REGEX = /^[0-9a-f]{128}$/;

export const isValidAuthChallenge = (
    challenge: any,
    tag: AuthChallengeTag
): challenge is string =>
    typeof challenge === 'string' &&
    challenge.startsWith(tag) &&
    NONCE_REGEX.test(challenge.slice(tag.length));

// Body for the servers' /auth/v2 endpoints. version 2 asks for a tagged
// challenge; the servers will eventually answer requests without it with an
// update prompt.
export const authChallengeRequestBody = (pubkey: string) =>
    JSON.stringify({ pubkey, version: 2 });

export const INVALID_AUTH_CHALLENGE_ERROR = 'Invalid auth challenge';
