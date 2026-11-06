// LNURL-auth (LUD-04) logic for lib/lnurla.js, kept free of I/O so
// rig.test.js can run it. The service hands out a one-time k1, the wallet
// calls back with `key` (its linking public key for this domain) and `sig`
// (a DER signature of k1 by that key), and the service accepts the login
// when the signature verifies. The same wallet and domain must always
// produce the same key; `logins` records each accepted key so a device test
// can compare them across app builds.
const crypto = require('crypto');

const COMPRESSED_PUBKEY = /^0[23][0-9a-f]{64}$/i;
const HEX = /^(?:[0-9a-f]{2})+$/i;

// origin: https://<host>:<port> the wallet reaches the service at.
// verify(sigHex, k1Hex, keyHex): true when sig is a valid DER signature of
// the 32-byte k1 by key.
// encodeLnurl(url): bech32 LNURL1... string.
const createLnurlAuth = ({ origin, verify, encodeLnurl, now }) => {
    const clock = now || (() => new Date().toISOString());
    const pending = new Map();
    const logins = [];

    const make = (action = 'login') => {
        const k1 = crypto.randomBytes(32).toString('hex');
        const url = new URL('/login', origin);
        url.searchParams.set('tag', 'login');
        url.searchParams.set('k1', k1);
        url.searchParams.set('action', action);
        pending.set(k1, action);
        return { lnurl: encodeLnurl(url.toString()), url: url.toString(), k1 };
    };

    const error = (reason) => ({ status: 'ERROR', reason });

    // query: URLSearchParams of the wallet's callback request
    const callback = (query) => {
        const k1 = (query.get('k1') || '').toLowerCase();
        const key = (query.get('key') || '').toLowerCase();
        const sig = (query.get('sig') || '').toLowerCase();
        if (!pending.has(k1)) return error('unknown or already used k1');
        if (!COMPRESSED_PUBKEY.test(key)) {
            return error('key must be a 33-byte compressed public key (hex)');
        }
        if (!HEX.test(sig)) return error('sig must be a DER signature (hex)');
        let valid = false;
        try {
            valid = verify(sig, k1, key) === true;
        } catch (e) {
            valid = false;
        }
        if (!valid) return error('signature does not verify for key and k1');

        const action = pending.get(k1);
        pending.delete(k1);
        logins.push({ at: clock(), action, k1, key });
        return { status: 'OK' };
    };

    return { make, callback, logins: () => logins.slice() };
};

module.exports = { createLnurlAuth };
