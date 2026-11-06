// LNURL-auth (LUD-04) test service. Started by bin/lnurla; env from env.sh.
// GET /make?action=login|register|link|auth -> { lnurl, url, k1 }
// GET /login?tag=login&k1=&action=&key=&sig= -> the wallet's callback;
//        { status: 'OK' } when sig verifies, else { status: 'ERROR', reason }
// GET /logins -> every accepted login: { at, action, k1, key }
// GET /ping
// LnurlAuth applies the LNURL host policy: https only, and no localhost or
// private IP literals. So the service listens with TLS on LNURLA_PORT under
// a public name that resolves to 127.0.0.1 (LNURLA_HOST, default
// auth.lvh.me), with a cert from bin/ca, and the app reaches it through
// adb reverse.
const https = require('https');
const fs = require('fs');
const { createRequire } = require('module');
const { createLnurlAuth } = require('./lnurla-routes');

const PORT = Number(process.env.LNURLA_PORT);
const HOST = process.env.LNURLA_HOST;
const ORIGIN = `https://${HOST}:${PORT}`;
const TLS = `${process.env.STATE}/tls/lnurla`;
const LOG = `${process.env.STATE}/logs/lnurla.events.log`;
const zeusRequire = createRequire(`${process.env.ZEUS_DIR}/package.json`);
const { bech32 } = zeusRequire('bech32');

const log = (...a) => {
    const l = `${new Date().toISOString()} ${a.join(' ')}`;
    fs.appendFileSync(LOG, l + '\n');
    console.log(l);
};

const main = async () => {
    // @noble/curves 2.x is ESM-only
    const { secp256k1 } = await import(
        zeusRequire.resolve('@noble/curves/secp256k1.js')
    );
    const auth = createLnurlAuth({
        origin: ORIGIN,
        encodeLnurl: (u) =>
            bech32
                .encode('lnurl', bech32.toWords(Buffer.from(u)), 2000)
                .toUpperCase(),
        verify: (sigHex, k1Hex, keyHex) =>
            secp256k1.verify(
                Buffer.from(sigHex, 'hex'),
                Buffer.from(k1Hex, 'hex'),
                Buffer.from(keyHex, 'hex'),
                { prehash: false, format: 'der', lowS: false }
            )
    });

    https
        .createServer(
            {
                key: fs.readFileSync(`${TLS}/tls.key`),
                cert: fs.readFileSync(`${TLS}/tls.cert`)
            },
            (rq, rs) => {
                const u = new URL(rq.url, ORIGIN);
                const json = (o) => {
                    rs.setHeader('content-type', 'application/json');
                    rs.end(JSON.stringify(o));
                };
                if (u.pathname === '/ping') return json({ ok: true });
                if (u.pathname === '/make') {
                    const made = auth.make(
                        u.searchParams.get('action') || 'login'
                    );
                    log('MAKE', made.k1, made.url);
                    return json(made);
                }
                if (u.pathname === '/login') {
                    const result = auth.callback(u.searchParams);
                    log(
                        result.status === 'OK' ? 'LOGIN_OK' : 'LOGIN_ERROR',
                        `k1=${u.searchParams.get('k1')}`,
                        `key=${u.searchParams.get('key')}`,
                        result.reason || ''
                    );
                    return json(result);
                }
                if (u.pathname === '/logins') {
                    return json({ logins: auth.logins() });
                }
                rs.statusCode = 404;
                rs.end('not found');
            }
        )
        .listen(PORT, '127.0.0.1', () => log('LISTEN', ORIGIN));
};

main().catch((e) => {
    log('FATAL', e && e.stack ? e.stack : String(e));
    process.exit(1);
});
