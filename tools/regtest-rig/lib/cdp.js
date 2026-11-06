// Metro/Hermes CDP client. Used by bin/cdp; see bin/cdp --help.
// - `ws` comes from the Zeus checkout's node_modules: Node's global
//   WebSocket cannot set the Origin header and Metro answers 401 without it.
// - lib/prelude.js is evaluated first on every call (it is guarded by a
//   version, so it only installs globalThis.Z once per JS context).
// - Async mode runs the code as an async function body, stores the result in
//   globalThis.__zr and polls: Runtime.evaluate awaitPromise does not await
//   RN's promise polyfill. The body starts from a setTimeout so the evaluate
//   call returns before any store work runs (a debugger-attached microtask
//   drain has crashed Hermes before).
const { createRequire } = require('module');
const fs = require('fs');
const path = require('path');
const http = require('http');

const ZEUS_DIR = process.env.METRO_DIR || process.env.ZEUS_DIR;
const PORT = Number(process.env.METRO_PORT);
const WS = createRequire(path.join(ZEUS_DIR, 'package.json'))('ws');

const args = process.argv.slice(2);
let code = null;
let isAsync = false;
let timeout = Number(process.env.CDP_TIMEOUT || 60000);
let raw = false;
let listOnly = false;
for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-f') code = fs.readFileSync(args[++i], 'utf8');
    else if (a === '--async' || a === '-a') isAsync = true;
    else if (a === '--timeout') timeout = Number(args[++i]);
    else if (a === '--raw') raw = true;
    else if (a === '--targets') listOnly = true;
    else if (code === null) code = a;
}
if (!listOnly && code === null) {
    console.error('no code given');
    process.exit(2);
}

const prelude = fs.readFileSync(path.join(__dirname, 'prelude.js'), 'utf8');

const getTargets = () =>
    new Promise((resolve, reject) => {
        http.get(`http://localhost:${PORT}/json/list`, (r) => {
            let b = '';
            r.on('data', (d) => (b += d));
            r.on('end', () => {
                try {
                    resolve(JSON.parse(b));
                } catch (e) {
                    reject(new Error('bad /json/list: ' + b.slice(0, 200)));
                }
            });
        }).on('error', reject);
    });

(async () => {
    let targets;
    try {
        targets = await getTargets();
    } catch (e) {
        console.error(`metro on :${PORT} not reachable: ${e.message}`);
        process.exit(3);
    }
    if (listOnly) {
        console.log(JSON.stringify(targets, null, 1));
        process.exit(0);
    }
    const list = targets.filter(
        (t) =>
            t.webSocketDebuggerUrl &&
            !/Experimental|legacy/i.test(t.title || '')
    );
    const t =
        list
            .filter((x) =>
                /zeus/i.test(`${x.description} ${x.title} ${x.appId}`)
            )
            .pop() || list.pop();
    if (!t) {
        console.error(
            'no debuggable target (is the app running and connected to this Metro?)'
        );
        process.exit(3);
    }
    const ws = new WS(t.webSocketDebuggerUrl, {
        origin: `http://localhost:${PORT}`
    });
    let id = 0;
    const pend = {};
    const send = (method, params) =>
        new Promise((res) => {
            const i = ++id;
            pend[i] = res;
            ws.send(JSON.stringify({ id: i, method, params }));
        });
    const ev = async (expression) => {
        const r = await send('Runtime.evaluate', {
            expression,
            returnByValue: true
        });
        if (r.result && r.result.exceptionDetails) {
            const d = r.result.exceptionDetails;
            throw new Error(
                (d.exception && d.exception.description) ||
                    JSON.stringify(d).slice(0, 1500)
            );
        }
        const v = r.result && r.result.result;
        if (!v) return JSON.stringify(r);
        return v.value !== undefined ? v.value : v.description;
    };
    const timer = setTimeout(() => {
        console.error('TIMEOUT');
        process.exit(4);
    }, timeout);
    ws.on('message', (m) => {
        const j = JSON.parse(m);
        if (j.id && pend[j.id]) {
            pend[j.id](j);
            delete pend[j.id];
        }
    });
    ws.on('error', (e) => {
        console.error('WSERR', e.message);
        process.exit(1);
    });
    ws.on('open', async () => {
        let out;
        try {
            await ev(prelude);
            if (isAsync) {
                const key =
                    'k' + Date.now() + Math.random().toString(36).slice(2);
                await ev(
                    `globalThis.__zr=globalThis.__zr||{}; setTimeout(()=>{ (async()=>{ ${code}\n })().then(v=>{globalThis.__zr['${key}']={ok:v===undefined?null:v}}, e=>{globalThis.__zr['${key}']={err:String(e&&e.stack||e)}}); }, 20); 'started'`
                );
                for (;;) {
                    const v = await ev(
                        `(function(){var r=globalThis.__zr['${key}']; if(!r) return null; delete globalThis.__zr['${key}']; return JSON.stringify(r);})()`
                    );
                    if (v) {
                        const r = JSON.parse(v);
                        if (r.err) {
                            console.error(r.err);
                            process.exitCode = 1;
                            out = undefined;
                        } else out = r.ok;
                        break;
                    }
                    await new Promise((r) => setTimeout(r, 250));
                }
            } else {
                out = await ev(code);
            }
        } catch (e) {
            console.error('EXC', e.message);
            process.exitCode = 1;
        }
        if (out !== undefined) {
            if (typeof out === 'string' || raw) console.log(out);
            else console.log(JSON.stringify(out, null, 1));
        }
        clearTimeout(timer);
        ws.close(1000);
    });
    ws.on('close', () => process.exit());
})();
