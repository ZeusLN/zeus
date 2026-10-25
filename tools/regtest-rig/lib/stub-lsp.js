// Stub Olympus Flow LSP. Started by bin/lsp; configured by env from env.sh.
// GET  /api/v1/info      -> { pubkey: bob, connection_methods: [bob:9735] }
// POST /api/v1/fee       -> { fee_amount_msat, id } from the queue, else the
//                           default; a null fee answers a fee-less { id }
// POST /api/v1/proposal  -> { jit_bolt11 }: a bob hold invoice with the same
//                           payment hash, amount = inner + quoted fee
// POST /admin/fee        { fee_msat: number|null, queue?: bool } sets the
//                           default or pushes one answer onto the queue
// GET  /admin/state      -> { defaultFeeMsat, queue, quotes }
const http = require('http');
const fs = require('fs');
const { execFileSync } = require('child_process');

const PORT = Number(process.env.LSP_PORT);
const LOG = `${process.env.STATE}/logs/stub-lsp.events.log`;
const BOB = [
    'exec',
    `${process.env.RIG_NAME}-bob-1`,
    'lncli',
    '--network=regtest',
    '--tlscertpath=/tls/tls.cert',
    '--macaroonpath=/home/lnd/.lnd/data/chain/bitcoin/regtest/admin.macaroon'
];
const bob = (...args) =>
    JSON.parse(execFileSync('docker', [...BOB, ...args]).toString());

const BOB_PUBKEY = bob('getinfo').identity_pubkey;
let defaultFeeMsat = Number(process.env.LSP_DEFAULT_FEE_MSAT || 2000000);
const queue = [];
const quotes = {}; // id -> fee msat
let n = 0;

const log = (...a) => {
    const line = `${new Date().toISOString()} ${a.join(' ')}`;
    console.log(line);
    fs.appendFileSync(LOG, line + '\n');
};

const send = (res, status, obj) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(obj));
};

http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
        log('REQ', req.method, req.url, body);
        let json = {};
        try {
            json = body ? JSON.parse(body) : {};
        } catch (e) {}
        try {
            if (req.url.startsWith('/api/v1/info')) {
                return send(res, 200, {
                    pubkey: BOB_PUBKEY,
                    connection_methods: [
                        { address: 'bob', port: '9735', type: 'ipv4' }
                    ]
                });
            }
            if (req.url.startsWith('/api/v1/fee')) {
                const fee = queue.length ? queue.shift() : defaultFeeMsat;
                const id = `q${++n}`;
                quotes[id] = fee == null ? 0 : fee;
                const out = fee == null ? { id } : { fee_amount_msat: fee, id };
                log('RES fee', JSON.stringify(out));
                return send(res, 200, out);
            }
            if (req.url.startsWith('/api/v1/proposal')) {
                const inner = bob('decodepayreq', json.bolt11);
                const feeMsat = quotes[json.fee_id] ?? 0;
                const totalSat =
                    Number(inner.num_satoshis) + Math.floor(feeMsat / 1000);
                const hold = bob(
                    'addholdinvoice',
                    inner.payment_hash,
                    '--amt',
                    String(totalSat),
                    '--expiry',
                    '86400',
                    '--memo',
                    `jit ${json.fee_id}`
                );
                log(
                    'RES proposal',
                    `inner=${inner.num_satoshis} fee_msat=${feeMsat} jit=${totalSat}`,
                    hold.payment_request
                );
                return send(res, 200, { jit_bolt11: hold.payment_request });
            }
            if (req.url.startsWith('/admin/fee')) {
                if (json.queue) queue.push(json.fee_msat);
                else defaultFeeMsat = json.fee_msat;
                log('ADMIN', JSON.stringify({ defaultFeeMsat, queue }));
                return send(res, 200, { defaultFeeMsat, queue });
            }
            if (req.url.startsWith('/admin/state')) {
                return send(res, 200, { defaultFeeMsat, queue, quotes });
            }
            send(res, 404, { message: 'not found' });
        } catch (e) {
            log('ERR', e.message);
            send(res, 500, { message: e.message });
        }
    });
}).listen(PORT, '127.0.0.1', () =>
    log('stub listening', PORT, 'bob', BOB_PUBKEY)
);
