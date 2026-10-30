// Host-side NWC client (@getalby/sdk NWCClient from the Zeus checkout).
// usage: node nwc.js <uri-file> info|balance|make|pay|lookup|list [json-arg]
//   make   '{"amount": <msat>, "description": "..."}'   (or an array: fired concurrently)
//   pay    '{"invoice": "lnbcrt..."}'
//   lookup '{"payment_hash": "..."}'
//   list   '{"limit": 10}'
// Results are printed as JSON and appended to $STATE/logs/nwc-client.jsonl.
// Zeus rate-limits make_invoice to 5 per minute per connection, and
// nostr-rs-relay allows 32 subscriptions per socket.
const { createRequire } = require('module');
const fs = require('fs');
const path = require('path');

const zeusRequire = createRequire(
    path.join(process.env.METRO_DIR || process.env.ZEUS_DIR, 'package.json')
);
const sdk = zeusRequire('@getalby/sdk');
const NWCClient =
    sdk.NWCClient ||
    (sdk.nwc && sdk.nwc.NWCClient) ||
    zeusRequire('@getalby/sdk/nwc').NWCClient;

const LOG = `${process.env.STATE}/logs/nwc-client.jsonl`;
const log = (o) =>
    fs.appendFileSync(
        LOG,
        JSON.stringify({ t: new Date().toISOString(), ...o }) + '\n'
    );

const [uriFile, op = 'info', argJson] = process.argv.slice(2);
// the app sees the relay as ws://localhost (adb reverse); from the host use 127.0.0.1
const uri = fs
    .readFileSync(uriFile, 'utf8')
    .trim()
    .replace('ws%3A%2F%2Flocalhost', 'ws%3A%2F%2F127.0.0.1')
    .replace('ws://localhost', 'ws://127.0.0.1');
const arg = argJson ? JSON.parse(argJson) : {};
const client = new NWCClient({ nostrWalletConnectUrl: uri });
const timer = setTimeout(() => {
    console.log(JSON.stringify({ error: 'timeout' }));
    process.exit(4);
}, Number(process.env.NWC_TIMEOUT || 90000));

const run = async () => {
    switch (op) {
        case 'info':
            return client.getInfo();
        case 'balance':
            return client.getBalance();
        case 'make':
            if (Array.isArray(arg)) {
                const rs = await Promise.allSettled(
                    arg.map((a) => client.makeInvoice(a))
                );
                return rs.map((r, i) => ({
                    request: arg[i],
                    ok: r.status === 'fulfilled',
                    response: r.value,
                    error: r.reason && `${r.reason.code}: ${r.reason.message}`
                }));
            }
            return client.makeInvoice(arg);
        case 'pay':
            return client.payInvoice(arg);
        case 'lookup':
            return client.lookupInvoice(arg);
        case 'list':
            return client.listTransactions(arg);
        default:
            throw new Error('unknown op ' + op);
    }
};

(async () => {
    let code = 0;
    try {
        const r = await run();
        log({ op, request: arg, response: r });
        console.log(JSON.stringify(r, null, 1));
    } catch (e) {
        const err = `${e && e.code ? e.code + ': ' : ''}${
            e && e.message ? e.message : e
        }`;
        log({ op, request: arg, error: err });
        console.log(JSON.stringify({ error: err }));
        code = 1;
    }
    clearTimeout(timer);
    client.close();
    process.exit(code);
})();
