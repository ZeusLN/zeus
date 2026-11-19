// LNURL-withdraw test server. Started by bin/lnurlw; env from env.sh.
// GET /make/<id>?hold=1&delay=MS&pay=1&min=MSAT&max=MSAT
//        -> { lnurl, url }: bech32 lnurl1... for /lnurlw/<id>?<same query>
// GET /lnurlw/<id>?...  -> withdrawRequest. hold=1 holds the response until
//        /release/<id>; delay=MS sleeps first.
// GET /release/<id>     -> releases every held response for <id>
// GET /cb?id=&k1=&pr=   -> logs the callback (amount, hash via bob decodepayreq);
//        with pay=1 in the original query bob pays pr in the background
// The app reaches it at http://localhost:<LNURL_PORT> through adb reverse.
// LnurlWithdraw does not apply the LNURL host policy, so plain http to
// localhost works there (LnurlPay does apply it).
const http = require('http');
const fs = require('fs');
const { createRequire } = require('module');
const { execFile } = require('child_process');

const PORT = Number(process.env.LNURL_PORT);
const BASE = `http://localhost:${PORT}`;
const LOG = `${process.env.STATE}/logs/lnurlw.events.log`;
const { bech32 } = createRequire(`${process.env.ZEUS_DIR}/package.json`)(
    'bech32'
);
const held = {};

const log = (...a) => {
    const l = `${new Date().toISOString()} ${a.join(' ')}`;
    fs.appendFileSync(LOG, l + '\n');
    console.log(l);
};
const enc = (u) =>
    bech32.encode('lnurl', bech32.toWords(Buffer.from(u)), 2000).toUpperCase();
const bob = (args) =>
    new Promise((res) =>
        execFile(
            'docker',
            [
                'exec',
                `${process.env.RIG_NAME}-bob-1`,
                'lncli',
                '--network=regtest',
                '--tlscertpath=/tls/tls.cert',
                '--macaroonpath=/home/lnd/.lnd/data/chain/bitcoin/regtest/admin.macaroon',
                ...args
            ],
            { timeout: 120000 },
            (e, so, se) => res({ e, so, se })
        )
    );

http.createServer(async (rq, rs) => {
    const u = new URL(rq.url, BASE);
    const p = u.pathname.split('/').filter(Boolean);
    const json = (o) => {
        rs.setHeader('content-type', 'application/json');
        rs.end(JSON.stringify(o));
    };
    if (p[0] === 'make') {
        const url = `${BASE}/lnurlw/${p[1]}${u.search}`;
        log('MAKE', p[1], url);
        return json({ lnurl: enc(url), url });
    }
    if (p[0] === 'lnurlw') {
        const id = p[1];
        const delay = Number(u.searchParams.get('delay') || 0);
        const hold = u.searchParams.get('hold') === '1';
        log('LNURLW_REQ', id, `delay=${delay}`, `hold=${hold}`);
        if (hold) await new Promise((r) => (held[id] = held[id] || []).push(r));
        else if (delay) await new Promise((r) => setTimeout(r, delay));
        log('LNURLW_RESP', id);
        const cb = new URL(`${BASE}/cb`);
        cb.searchParams.set('id', id);
        if (u.searchParams.get('pay') === '1') cb.searchParams.set('pay', '1');
        return json({
            tag: 'withdrawRequest',
            k1: `k1-${id}`,
            callback: cb.toString(),
            minWithdrawable: Number(u.searchParams.get('min') || 1000),
            maxWithdrawable: Number(u.searchParams.get('max') || 100000000),
            defaultDescription: `regtest-rig ${id}`
        });
    }
    if (p[0] === 'release') {
        const id = p[1];
        const n = (held[id] || []).length;
        (held[id] || []).forEach((r) => r());
        held[id] = [];
        log('RELEASE', id, `waiters=${n}`);
        return json({ released: n });
    }
    if (p[0] === 'cb') {
        const id = u.searchParams.get('id');
        const k1 = u.searchParams.get('k1');
        const pr = u.searchParams.get('pr');
        let amt = '?',
            hash = '?';
        const d = await bob(['decodepayreq', pr || '']);
        try {
            const j = JSON.parse(d.so);
            amt = j.num_satoshis;
            hash = j.payment_hash;
        } catch (e) {
            amt = 'undecodable';
        }
        log(
            'CALLBACK',
            id,
            `k1=${k1}`,
            `amt_sat=${amt}`,
            `hash=${hash}`,
            `pr=${pr}`
        );
        json({ status: 'OK' });
        if (u.searchParams.get('pay') === '1' && amt !== 'undecodable') {
            const r = await bob(['payinvoice', '--force', '--json', pr]);
            let st = 'ERR';
            try {
                st = JSON.parse(r.so).status;
            } catch (e) {
                st = (r.se || r.so || '').slice(0, 200);
            }
            log('PAID', id, `hash=${hash}`, `status=${st}`);
        }
        return;
    }
    rs.statusCode = 404;
    rs.end('not found');
}).listen(PORT, '127.0.0.1', () => log('LISTEN', PORT));
