// In-app helper library, installed as globalThis.Z by lib/cdp.js before
// every evaluation. Hermes notes: use globalThis (there is no `global`);
// String(fn) is bytecode, so fibers are matched by rendered text, never by
// closure source; module IDs shift between bundles, so modules are found by
// their dev-bundle path (Metro keeps verboseName in dev builds).
// __r is Metro's module require; __zlog is the trace buffer this file
// creates on globalThis.
// Bump V whenever this file changes: a running app keeps the Z of the
// version it already has.
/* global __r, __zlog */
(function () {
    var V = 10;
    if (globalThis.Z && globalThis.Z.v === V) return 'Z ok';
    var Z = { v: V };
    globalThis.__zids = globalThis.__zids || {};

    // ---- modules -------------------------------------------------------
    // Z.modId('stores/Stores.ts') -> numeric id; matches the end of the path.
    Z.modId = function (suffix) {
        if (globalThis.__zids[suffix] !== undefined)
            return globalThis.__zids[suffix];
        var mods = __r.getModules ? __r.getModules() : null;
        if (!mods)
            throw new Error('__r.getModules missing (not a dev bundle?)');
        var found;
        var check = function (m, id) {
            var n = m && m.verboseName;
            if (
                found === undefined &&
                n &&
                (n === suffix || n.slice(-suffix.length - 1) === '/' + suffix)
            )
                found = Number(id);
        };
        if (typeof mods.forEach === 'function' && !Array.isArray(mods))
            mods.forEach(check);
        else
            Object.keys(mods).forEach(function (k) {
                check(mods[k], k);
            });
        if (found === undefined) throw new Error('module not found: ' + suffix);
        globalThis.__zids[suffix] = found;
        return found;
    };
    Z.mod = function (suffix) {
        return __r(Z.modId(suffix));
    };
    Z.def = function (suffix) {
        var m = Z.mod(suffix);
        return m && m.default ? m.default : m;
    };
    // Stores.ts exports the store instances directly.
    Z.S = function () {
        return Z.mod('stores/Stores.ts');
    };
    // NavigationService is a default export.
    Z.nav = function () {
        return Z.def('NavigationService.ts');
    };
    Z.sleep = function (ms) {
        return new Promise(function (r) {
            setTimeout(r, ms);
        });
    };

    // ---- settings ------------------------------------------------------
    // Pure helpers (Z.mergeSettings, Z.upsertNodes) are exercised by
    // tools/regtest-rig/rig.test.js. Writes go through the functional
    // form of updateSettings, which applies the patch to the stored
    // settings inside the store's write queue, so a write made before
    // settings load (or racing another write) cannot replace the wallet
    // list with a stale copy.

    // Merge a patch into settings (nested objects are merged one level).
    Z.mergeSettings = function (cur, patch) {
        cur = cur || {};
        var next = {};
        Object.keys(patch).forEach(function (k) {
            var v = patch[k];
            next[k] =
                v &&
                typeof v === 'object' &&
                !Array.isArray(v) &&
                cur[k] &&
                typeof cur[k] === 'object'
                    ? Object.assign({}, cur[k], v)
                    : v;
        });
        return next;
    };
    Z.settings = async function (patch) {
        await Z.S().settingsStore.updateSettings(function (cur) {
            return Z.mergeSettings(cur, patch);
        });
        return Object.keys(patch);
    };
    // Settings patch that adds `node`, or replaces in place the first
    // node whose matchKeys all equal node's (compared as strings), so
    // other wallets keep their indexes. selectedNode only changes when
    // opts.select is set. Returns { patch, index }.
    Z.upsertNodes = function (cur, node, opts) {
        opts = opts || {};
        var keys = opts.matchKeys || [];
        var nodes = ((cur && cur.nodes) || []).slice();
        var index = keys.length
            ? nodes.findIndex(function (x) {
                  return keys.every(function (k) {
                      return x && String(x[k]) === String(node[k]);
                  });
              })
            : -1;
        if (index < 0) {
            nodes.push(node);
            index = nodes.length - 1;
        } else {
            nodes[index] = node;
        }
        var patch = { nodes };
        if (opts.select) patch.selectedNode = index;
        return { patch, index };
    };
    Z.upsertNode = async function (node, opts) {
        var index;
        await Z.S().settingsStore.updateSettings(function (cur) {
            var r = Z.upsertNodes(cur, node, opts);
            index = r.index;
            return r.patch;
        });
        return index;
    };
    Z.nodes = function () {
        var s = Z.S().settingsStore.settings;
        return {
            selectedNode: s.selectedNode || 0,
            nodes: (s.nodes || []).map(function (n, i) {
                return {
                    i,
                    nickname: n.nickname,
                    implementation: n.implementation,
                    host: n.host,
                    port: n.port,
                    certVerification: n.certVerification
                };
            })
        };
    };
    Z.status = function () {
        var S = Z.S(),
            ni = S.nodeInfoStore.nodeInfo || {};
        return {
            selectedNode: S.settingsStore.settings.selectedNode || 0,
            implementation: S.settingsStore.implementation,
            alias: ni.alias,
            nodeId: ni.nodeId || ni.identity_pubkey,
            lightningBalance: S.balanceStore.lightningBalance,
            onchainBalance: S.balanceStore.totalBlockchainBalance,
            route: Z.route()
        };
    };

    // ---- fiber tree ----------------------------------------------------
    Z.roots = function () {
        var h = globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__,
            out = [];
        if (!h || !h.renderers) return out;
        h.renderers.forEach(function (_, rid) {
            var s = h.getFiberRoots(rid);
            if (s)
                s.forEach(function (r) {
                    out.push(r);
                });
        });
        return out;
    };
    Z.walk = function (fn) {
        var res = [];
        Z.roots().forEach(function (r) {
            var st = [r.current];
            while (st.length) {
                var f = st.pop();
                if (!f) continue;
                if (fn(f)) res.push(f);
                if (f.sibling) st.push(f.sibling);
                if (f.child) st.push(f.child);
            }
        });
        return res;
    };
    // class component instances by component name (last = most recent)
    Z.inst = function (name) {
        var seen = [];
        Z.walk(function (f) {
            return (
                f.type &&
                (f.type.name === name || f.type.displayName === name) &&
                f.stateNode &&
                f.stateNode.setState
            );
        }).forEach(function (f) {
            if (seen.indexOf(f.stateNode) < 0) seen.push(f.stateNode);
        });
        return seen;
    };
    Z.text = function (f) {
        var out = [],
            st = [f.child];
        while (st.length) {
            var x = st.pop();
            if (!x) continue;
            if (x.tag === 6 && typeof x.memoizedProps === 'string')
                out.push(x.memoizedProps);
            if (x.sibling) st.push(x.sibling);
            if (x.child) st.push(x.child);
        }
        return out;
    };
    Z.screenText = function () {
        var out = [];
        Z.walk(function (f) {
            if (f.tag === 6 && typeof f.memoizedProps === 'string')
                out.push(f.memoizedProps);
            return false;
        });
        return out;
    };
    Z.hasText = function (s) {
        return Z.screenText().some(function (t) {
            return t.indexOf(s) >= 0;
        });
    };
    // press the innermost onPress fiber whose subtree text matches label
    Z.press = function (label) {
        var fs = Z.walk(function (f) {
            return (
                f.memoizedProps && typeof f.memoizedProps.onPress === 'function'
            );
        });
        var m = fs.filter(function (f) {
            return Z.text(f).some(function (t) {
                return t === label || t.indexOf(label) >= 0;
            });
        });
        if (!m.length) return 'nomatch';
        m.sort(function (a, b) {
            return Z.text(a).length - Z.text(b).length;
        });
        m[0].memoizedProps.onPress();
        return 'pressed (' + m.length + ' matches)';
    };

    // ---- navigation ----------------------------------------------------
    Z.route = function () {
        try {
            var m = Z.mod('NavigationService.ts');
            var f = m.getRouteStack || (m.default && m.default.getRouteStack);
            return f().map(function (r) {
                return r.name;
            });
        } catch (e) {
            return null;
        }
    };
    Z.go = function (route, params) {
        Z.nav().navigate(route, params);
        return route;
    };
    // reset the stack to Wallet (avoids stale screen instances between runs)
    Z.home = async function () {
        var f = Z.walk(function (x) {
            return (
                x.memoizedProps &&
                x.memoizedProps.navigation &&
                x.memoizedProps.navigation.reset
            );
        })[0];
        if (f)
            f.memoizedProps.navigation.reset({
                index: 0,
                routes: [{ name: 'Wallet' }]
            });
        else Z.nav().navigate('Wallet');
        await Z.sleep(1500);
        return 'home';
    };
    // run the universal input router, then navigate to its result
    Z.handle = async function (input) {
        var h = Z.def('utils/handleAnything.ts');
        var r = await h(input);
        if (Array.isArray(r) && r[0]) Z.nav().navigate(r[0], r[1]);
        return Array.isArray(r) ? r[0] : r;
    };

    // ---- tracing -------------------------------------------------------
    globalThis.__zlog = globalThis.__zlog || [];
    var short = function (v) {
        try {
            return JSON.stringify(v, function (k, x) {
                return typeof x === 'string' && x.length > 80
                    ? x.slice(0, 30) + '..' + x.slice(-12)
                    : x;
            });
        } catch (e) {
            return String(v);
        }
    };
    // Z.wrap(obj, 'method', 'tag'): log calls and results to Z.log()
    Z.wrap = function (obj, name, tag) {
        tag = tag || 'obj';
        if (!obj || typeof obj[name] !== 'function')
            return tag + '.' + name + ' missing';
        if (obj[name].__zw) return tag + '.' + name + ' already';
        var orig = obj[name];
        var w = function () {
            var a = Array.prototype.slice.call(arguments);
            var t = new Date().toISOString().slice(11, 23);
            var r = orig.apply(this, a);
            if (r && typeof r.then === 'function') {
                r.then(
                    function (v) {
                        __zlog.push(
                            t +
                                ' ' +
                                tag +
                                '.' +
                                name +
                                '(' +
                                short(a) +
                                ') => ' +
                                short(v)
                        );
                    },
                    function (e) {
                        __zlog.push(
                            t +
                                ' ' +
                                tag +
                                '.' +
                                name +
                                '(' +
                                short(a) +
                                ') threw ' +
                                ((e && e.message) || e)
                        );
                    }
                );
            } else
                __zlog.push(
                    t +
                        ' ' +
                        tag +
                        '.' +
                        name +
                        '(' +
                        short(a) +
                        ') => ' +
                        short(r)
                );
            return r;
        };
        w.__zw = true;
        w.__zorig = orig;
        try {
            obj[name] = w;
        } catch (e) {
            return 'fail ' + name + ' ' + e;
        }
        return obj[name] === w ? 'ok ' + tag + '.' + name : 'notset ' + name;
    };
    Z.unwrap = function (obj, name) {
        if (obj[name] && obj[name].__zorig) obj[name] = obj[name].__zorig;
        return name;
    };
    Z.log = function (clear) {
        var l = __zlog.slice();
        if (clear) __zlog.length = 0;
        return l;
    };
    // console capture (RN dev console.log does not reach logcat reliably)
    Z.captureConsole = function () {
        if (console.__zc) return 'already';
        ['log', 'warn', 'error'].forEach(function (lv) {
            var o = console[lv];
            console[lv] = function () {
                try {
                    __zlog.push(
                        new Date().toISOString().slice(11, 23) +
                            ' console.' +
                            lv +
                            ' ' +
                            Array.prototype.map
                                .call(arguments, short)
                                .join(' ')
                                .slice(0, 500)
                    );
                } catch (e) {}
                return o.apply(console, arguments);
            };
        });
        console.__zc = true;
        return 'ok';
    };
    // LogBox: hide the overlay and collect its messages into Z.log()
    Z.logbox = function () {
        try {
            var LB = Z.def(
                'node_modules/react-native/Libraries/LogBox/LogBox.js'
            );
            LB.ignoreAllLogs(true);
            var D = Z.mod(
                'node_modules/react-native/Libraries/LogBox/Data/LogBoxData.js'
            );
            if (!globalThis.__zlbObs && D.observe) {
                globalThis.__zlbObs = D.observe(function (o) {
                    (o.logs || []).forEach(function (l) {
                        var m =
                            'logbox ' +
                            l.level +
                            ': ' +
                            ((l.message && l.message.content) || '').slice(
                                0,
                                300
                            );
                        if (__zlog.indexOf(m) < 0) __zlog.push(m);
                    });
                });
            }
            if (D.clear) D.clear();
            return 'logbox hidden';
        } catch (e) {
            return 'logbox ' + e.message;
        }
    };

    globalThis.Z = Z;
    return 'Z installed';
})();
