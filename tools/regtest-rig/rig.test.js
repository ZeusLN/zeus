// Contract test for tools/regtest-rig: the app names the rig's scripts call
// over CDP, the setting values they write, and the rig's pure helpers. A
// PR that renames one of these app internals fails here instead of on the
// next device test.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');
const { bech32 } = require('bech32');

// Native and network dependencies of SettingsStore, as in
// stores/SettingsStore.test.ts; storage is an in-memory keychain
jest.mock('react-native-biometrics', () => ({ BiometryType: {} }));
jest.mock('react-native-blob-util', () => ({
    fs: { dirs: { LibraryDir: '/lib', DocumentDir: '/docs' } }
}));
jest.mock('react-native-encrypted-storage', () => ({
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('../../utils/BackendUtils', () => ({
    __esModule: true,
    default: {
        clearCachedCalls: jest.fn(),
        initLNC: jest.fn(),
        connect: jest.fn(),
        isConnected: jest.fn()
    }
}));
jest.mock('../../utils/BiometricUtils', () => ({
    getSupportedBiometryType: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('../../utils/LocaleUtils');
jest.mock('../../utils/MigrationUtils', () => ({
    keychainDesyncMigration: jest.fn().mockResolvedValue(undefined),
    keychainCloudSyncMigration: jest.fn().mockResolvedValue(undefined),
    purgeRescueKeyFiles: jest.fn().mockResolvedValue(undefined),
    runSettingsMigrations: jest.fn().mockImplementation(async (s) => s),
    legacySettingsMigrations: jest.fn().mockResolvedValue({}),
    storageMigrationV2: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('../../utils/TorUtils', () => ({
    doTorRequest: jest.fn(),
    RequestMethod: {}
}));
jest.mock('../../stores/Stores', () => ({ settingsStore: { settings: {} } }));
jest.mock('../../utils/LdkNodeUtils', () => ({
    DEFAULT_SCORER_URL: 'https://scorer.default',
    DEFAULT_VSS_SERVER: '',
    getDefaultEsploraServer: jest.fn().mockReturnValue(''),
    getDefaultRgsServer: jest.fn().mockReturnValue('')
}));
jest.mock('../../storage', () => {
    const backing = {};
    return {
        _backing: backing,
        getItem: jest.fn(async (key) => backing[key] ?? false),
        setItem: jest.fn(async (key, value) => {
            backing[key] =
                typeof value === 'string' ? value : JSON.stringify(value);
            return true;
        }),
        removeItem: jest.fn(async (key) => {
            delete backing[key];
            return true;
        }),
        KEY_PREFIX: 'zeus:',
        getRawItem: jest.fn(async () => null)
    };
});

const { jitAmountMsat } = require('./lib/stub-lsp-amount');
const {
    default: SettingsStore,
    DEFAULT_VIEW_KEYS_POS,
    POS_CONF_PREF_KEYS,
    PosEnabled,
    STORAGE_KEY
} = require('../../stores/SettingsStore');
const { verifyWrappedInvoice } = require('../../utils/LspUtils');

const StorageMock = jest.requireMock('../../storage');

const RIG = __dirname;
const ROOT = path.join(RIG, '..', '..');
const read = (p) => fs.readFileSync(path.join(RIG, p), 'utf8');
const zeusScript = read('bin/zeus');

// Loads lib/prelude.js the way cdp.js does, in a fresh context, with
// Z.S() returning the given stores.
const loadZ = (stores) => {
    const ctx = vm.createContext({ setTimeout });
    vm.runInContext(read('lib/prelude.js'), ctx);
    ctx.Z.S = () => stores;
    return ctx.Z;
};

// A real SettingsStore whose persisted settings are `stored` and whose
// in-memory settings have not been loaded, the state right after an app
// restart.
const unloadedSettingsStore = (stored) => {
    for (const key of Object.keys(StorageMock._backing)) {
        delete StorageMock._backing[key];
    }
    StorageMock._backing[STORAGE_KEY] = JSON.stringify(stored);
    const store = new SettingsStore();
    expect(store.settingsLoaded).toBe(false);
    return store;
};
const persisted = () => JSON.parse(StorageMock._backing[STORAGE_KEY]);

beforeEach(() => {
    // getSettings logs every load
    jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('regtest rig: app internals it calls', () => {
    const sources = ['lib/prelude.js', 'lib/cdp.js', 'lib/nwc.js']
        .map(read)
        .concat(
            fs
                .readdirSync(path.join(RIG, 'bin'))
                .map((f) => read(path.join('bin', f)))
        )
        .join('\n');

    it('every module path passed to Z.mod/Z.def/Z.modId exists', () => {
        const paths = [
            ...sources.matchAll(/Z\.(?:mod|def|modId)\('([^']+)'\)/g)
        ]
            .map((m) => m[1])
            // usage examples in comments
            .filter((p) => !p.startsWith('path/'));
        expect(paths.length).toBeGreaterThan(0);
        for (const p of new Set(paths)) {
            expect([p, fs.existsSync(path.join(ROOT, p))]).toEqual([p, true]);
        }
    });

    const declares = (file, member) =>
        new RegExp(
            `^\\s*(@\\w+(\\([^)]*\\))?\\s+)*(public |private )?(async )?(get )?${member}\\b`,
            'm'
        ).test(fs.readFileSync(path.join(ROOT, file), 'utf8'));

    it.each([
        ['stores/SettingsStore.ts', 'settings'],
        ['stores/SettingsStore.ts', 'settingsLoaded'],
        ['stores/SettingsStore.ts', 'updateSettings'],
        ['stores/SettingsStore.ts', 'implementation'],
        ['stores/NodeInfoStore.ts', 'nodeInfo'],
        ['stores/BalanceStore.ts', 'lightningBalance'],
        ['stores/BalanceStore.ts', 'totalBlockchainBalance'],
        ['stores/CashuStore.ts', 'addMint'],
        ['stores/CashuStore.ts', 'createInvoice'],
        ['stores/CashuStore.ts', 'checkInvoicePaid'],
        ['stores/CashuStore.ts', 'mintUrls'],
        ['stores/CashuStore.ts', 'selectedMintUrl'],
        ['stores/CashuStore.ts', 'totalBalanceSats'],
        ['stores/InvoicesStore.ts', 'createUnifiedInvoice'],
        ['stores/NostrWalletConnectStore.ts', 'createConnection']
    ])('%s declares %s', (file, member) => {
        expect(declares(file, member)).toBe(true);
    });

    it('Stores.ts exports the stores the rig uses', () => {
        const stores = fs.readFileSync(
            path.join(ROOT, 'stores/Stores.ts'),
            'utf8'
        );
        for (const name of [
            'settingsStore',
            'nodeInfoStore',
            'balanceStore',
            'cashuStore',
            'invoicesStore',
            'nostrWalletConnectStore'
        ]) {
            expect([name, stores.includes(`export const ${name} =`)]).toEqual([
                name,
                true
            ]);
        }
    });

    it('LdkNodeUtils exports createLdkNodeWallet', () => {
        expect(
            declares('utils/LdkNodeUtils.ts', 'createLdkNodeWallet') ||
                /export async function createLdkNodeWallet\b/.test(
                    fs.readFileSync(
                        path.join(ROOT, 'utils/LdkNodeUtils.ts'),
                        'utf8'
                    )
                )
        ).toBe(true);
    });
});

describe('regtest rig: settings values bin/zeus writes', () => {
    const posLine = zeusScript
        .split('\n')
        .find((l) => l.includes('standalone) cdp'));
    const field = (name) => posLine.match(new RegExp(`${name}: '([^']+)'`))[1];

    it('pos standalone uses a POS tab name for defaultView', () => {
        expect(DEFAULT_VIEW_KEYS_POS.map((k) => k.value)).toContain(
            field('defaultView')
        );
    });

    it('pos standalone uses valid posEnabled and confirmation values', () => {
        expect(Object.values(PosEnabled)).toContain(field('posEnabled'));
        expect(POS_CONF_PREF_KEYS.map((k) => k.value)).toContain(
            field('confirmationPreference')
        );
    });
});

describe('regtest rig: Z.mergeSettings / Z.settings', () => {
    it('merges nested groups one level and keeps sibling fields', () => {
        const Z = loadZ({});
        expect(
            Z.mergeSettings(
                { pos: { posEnabled: 'disabled', disableTips: false } },
                { pos: { disableTips: true }, enableLSP: true }
            )
        ).toEqual({
            pos: { posEnabled: 'disabled', disableTips: true },
            enableLSP: true
        });
    });

    it('replaces arrays and primitives instead of merging them', () => {
        const Z = loadZ({});
        expect(
            Z.mergeSettings(
                { nodes: [{ a: 1 }], fiat: 'USD' },
                {
                    nodes: [],
                    fiat: 'EUR'
                }
            )
        ).toEqual({ nodes: [], fiat: 'EUR' });
    });

    it('merges against the stored settings, not the in-memory copy', async () => {
        const ss = unloadedSettingsStore({
            nodes: [{ nickname: 'alice' }],
            invoices: { memo: 'm', routeHints: true }
        });
        const Z = loadZ({ settingsStore: ss });
        await Z.settings({ invoices: { routeHints: false } });
        expect(persisted().nodes).toEqual([{ nickname: 'alice' }]);
        expect(persisted().invoices).toEqual({ memo: 'm', routeHints: false });
    });
});

describe('regtest rig: Z.upsertNodes / Z.upsertNode', () => {
    const LND_KEYS = { matchKeys: ['implementation', 'host', 'port'] };
    const lnd = (nickname, port, extra) => ({
        nickname,
        implementation: 'lnd',
        host: 'https://localhost',
        port,
        ...extra
    });

    it('replaces an existing node in place and keeps the selection', () => {
        const Z = loadZ({});
        const cur = {
            nodes: [lnd('alice', '24610'), lnd('bob', '24620')],
            selectedNode: 0
        };
        const r = Z.upsertNodes(
            cur,
            lnd('alice', '24610', { macaroonHex: 'new' }),
            LND_KEYS
        );
        expect(r.index).toBe(0);
        expect(r.patch.nodes.map((n) => n.nickname)).toEqual(['alice', 'bob']);
        expect(r.patch.nodes[0].macaroonHex).toBe('new');
        expect(r.patch).not.toHaveProperty('selectedNode');
    });

    it('matches ports given as numbers or strings', () => {
        const Z = loadZ({});
        const r = Z.upsertNodes(
            { nodes: [lnd('bob', 24620)] },
            lnd('bob', '24620'),
            LND_KEYS
        );
        expect(r.index).toBe(0);
        expect(r.patch.nodes).toHaveLength(1);
    });

    it('appends a new node and selects it only with select', () => {
        const Z = loadZ({});
        const cur = { nodes: [lnd('alice', '24610')], selectedNode: 0 };
        const plain = Z.upsertNodes(cur, lnd('carol', '24630'), LND_KEYS);
        expect(plain.index).toBe(1);
        expect(plain.patch).not.toHaveProperty('selectedNode');

        const selected = Z.upsertNodes(cur, lnd('carol', '24630'), {
            ...LND_KEYS,
            select: true
        });
        expect(selected.patch.selectedNode).toBe(1);
        // the stored settings object is not mutated
        expect(cur.nodes).toHaveLength(1);
    });

    it('always appends without matchKeys (LDK wallets)', () => {
        const Z = loadZ({});
        const ldk = { nickname: 'LDK', implementation: 'ldk-node' };
        const r = Z.upsertNodes({ nodes: [ldk] }, { ...ldk }, {});
        expect(r.index).toBe(1);
        expect(r.patch.nodes).toHaveLength(2);
    });

    it('keeps stored wallets when the in-memory settings are not loaded', async () => {
        const ldk = {
            nickname: 'LDK',
            implementation: 'ldk-node',
            ldkMnemonic: 'abandon'
        };
        const ss = unloadedSettingsStore({
            nodes: [ldk, lnd('alice', '24610')],
            selectedNode: 0
        });
        const Z = loadZ({ settingsStore: ss });
        const index = await Z.upsertNode(
            lnd('alice', '24610', { macaroonHex: 'new' }),
            LND_KEYS
        );
        expect(index).toBe(1);
        expect(persisted().nodes).toEqual([
            ldk,
            lnd('alice', '24610', { macaroonHex: 'new' })
        ]);
        expect(persisted().selectedNode).toBe(0);
    });
});

describe('regtest rig: bin/zeus invoices value parsing', () => {
    const filter = zeusScript.match(
        /jq -n --arg k "\$k" --arg v "\$v" '([^']+)'/
    )[1];
    let hasJq = true;
    try {
        execFileSync('jq', ['--version']);
    } catch (e) {
        hasJq = false;
    }
    const parse = (v) =>
        JSON.parse(
            execFileSync('jq', [
                '-cn',
                '--arg',
                'k',
                'k',
                '--arg',
                'v',
                v,
                filter
            ]).toString()
        ).k;

    (hasJq ? it : it.skip).each([
        ['false', false],
        ['true', true],
        ['null', null],
        ['0', 0],
        ['3600', 3600],
        ['lightning', 'lightning'],
        ['"quoted"', 'quoted']
    ])('%s -> %p', (input, expected) => {
        expect(parse(input)).toEqual(expected);
    });
});

describe('regtest rig: stub LSP wrapped-invoice amount', () => {
    // INNER fixture from utils/LspUtils.test.ts. Only the amount in the
    // human-readable part changes; verifyWrappedInvoice does not check the
    // signature, so re-encoding the checksum is enough.
    const BASE =
        'lnbc990u1pj48ugqpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygsdqgd9hxuetjxqyz5vqcqpj9qypqsqdf53ayr0meh6f8uxhzpz4wzlt3kss4uzw49w968dcsaudvndkk8zk076rgp0ygfxvwqzdf4d4agpwxrrsm2cahg6rj0j5lfct8spz2gqtdet4r';
    // 1 msat = 10 pico-BTC
    const withMsat = (msat) =>
        bech32.encode(`lnbc${msat}0p`, bech32.decode(BASE, 2000).words, 2000);

    const INNER_MSAT = '1000500';

    it('adds the fee in msat', () => {
        expect(jitAmountMsat('1000500', 3000500)).toBe('4001000');
        expect(jitAmountMsat('1000500', null)).toBe('1000500');
    });

    it('passes verification for an msat inner invoice with no fee', () => {
        const wrapped = withMsat(jitAmountMsat(INNER_MSAT, 0));
        expect(verifyWrappedInvoice(withMsat(INNER_MSAT), wrapped, 0)).toEqual({
            valid: true
        });
    });

    it('passes verification for an msat inner invoice with a fee', () => {
        const feeMsat = 3000500;
        const wrapped = withMsat(jitAmountMsat(INNER_MSAT, feeMsat));
        expect(
            verifyWrappedInvoice(
                withMsat(INNER_MSAT),
                wrapped,
                Math.floor(feeMsat / 1000)
            )
        ).toEqual({ valid: true });
    });

    it('the old whole-sat sum fails for an msat inner invoice', () => {
        // num_satoshis + floor(fee / 1000) with no fee: 1000 sat < 1000.5
        expect(
            verifyWrappedInvoice(withMsat(INNER_MSAT), withMsat('1000000'), 0)
        ).toEqual({ valid: false, error: 'amount_mismatch' });
    });
});
