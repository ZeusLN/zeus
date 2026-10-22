// ZEUS Pay and Olympus authenticate the node by having it sign a server
// issued challenge. Both servers issue 64 random bytes as lowercase hex.
// Only sign challenges of that shape so the node key is never used to sign
// arbitrary text supplied by a server.
const AUTH_CHALLENGE_REGEX = /^[0-9a-f]{128}$/;

export const isValidAuthChallenge = (challenge: any): challenge is string =>
    typeof challenge === 'string' && AUTH_CHALLENGE_REGEX.test(challenge);

export const INVALID_AUTH_CHALLENGE_ERROR = 'Invalid auth challenge';
