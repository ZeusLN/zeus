// Regression guard for #4016: with Display > Select wallet on startup
// enabled, settings writes must not reach a node. Loads the real store
// graph so a settings reaction added to any store is caught.

// Stand-in for native modules: every property, call and construction
// returns another stand-in
const mockDeep = (): any =>
    new Proxy(function () {}, {
        get: (_t, k) =>
            k === '__esModule'
                ? true
                : k === 'then'
                ? undefined
                : k === Symbol.toPrimitive
                ? () => ''
                : mockDeep(),
        apply: () => mockDeep(),
        construct: () => mockDeep()
    });

[
    'react-native-keychain',
    '@react-native-async-storage/async-storage',
    'ecpair',
    '@react-native-community/netinfo',
    'react-native-randombytes',
    '@react-navigation/native',
    'react-native-nitro-tor',
    '@react-native-documents/picker',
    'react-native-notifications',
    'react-native-share',
    'react-native-fs',
    'react-native-device-info',
    'react-native-blob-util'
].forEach((name) => jest.mock(name, () => mockDeep()));
jest.mock('react-native-encrypted-storage', () => ({
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn(),
    removeItem: jest.fn()
}));
jest.mock('../storage', () => {
    const backing: Record<string, string> = {};
    const api = {
        getItem: jest.fn(async (key: string) => backing[key] ?? false),
        setItem: jest.fn(async (key: string, value: any) => {
            backing[key] =
                typeof value === 'string' ? value : JSON.stringify(value);
            return true;
        }),
        removeItem: jest.fn(async (key: string) => {
            delete backing[key];
            return true;
        })
    };
    return {
        __esModule: true,
        _backing: backing,
        default: api,
        ...api,
        KEY_PREFIX: 'zeus:',
        getRawItem: jest.fn(async () => null)
    };
});
jest.mock('../utils/BiometricUtils', () => ({
    getSupportedBiometryType: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('../ldknode/LdkNodeInjection', () => ({}));
// Records the name of every BackendUtils method called
jest.mock('../utils/BackendUtils', () => {
    const calls: string[] = [];
    const backend: any = new Proxy(
        {},
        {
            get: (_t, prop: string) => {
                if (prop === '__esModule') return true;
                if (prop === 'default') return backend;
                if (prop === '__calls') return calls;
                return () => {
                    calls.push(prop);
                    return Promise.resolve({});
                };
            }
        }
    );
    return backend;
});

const nodes = [
    { implementation: 'lnd', macaroonHex: 'aaaa', host: 'a', port: '8080' },
    { implementation: 'lnd', macaroonHex: 'bbbb', host: 'b', port: '8080' }
];

// The real migrations run against the storage mock and log errors they
// recover from; keep the output quiet but fail on a settings load that
// silently fell through
jest.spyOn(console, 'log').mockImplementation(() => {});
const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

jest.requireMock('../storage')._backing['zeus-settings-v2'] = JSON.stringify({
    // FiatStore fetches rates on construction and needs a source
    fiatRatesSource: 'Zeus',
    fiatEnabled: false,
    selectNodeOnStartup: true,
    selectedNode: 0,
    nodes
});
// Loaded here rather than in the test: on a cold transform cache, as in
// CI, loading the store graph takes longer than the test timeout, which
// does not cover module loading. Stores before SettingsStore, or the
// circular import crashes
const { settingsStore } = require('./Stores');
const BackendUtils = require('../utils/BackendUtils').default;

it('settings writes during startup wallet selection reach no node', async () => {
    // Settings loaded while the startup wallet list is open
    await settingsStore.getSettings();
    expect(settingsStore.macaroonHex).toEqual('aaaa');
    expect(BackendUtils.__calls).toEqual([]);

    // What Wallets.tsx does when the user picks the second wallet
    settingsStore.setInitialStart(false);
    await settingsStore.updateSettings({ nodes, selectedNode: 1 });
    await settingsStore.updateSettings({ lurkerMode: true });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(settingsStore.macaroonHex).toEqual('bbbb');
    expect(BackendUtils.__calls).toEqual([]);
    expect(
        errorSpy.mock.calls.filter(
            ([message]) => message === 'Could not load settings'
        )
    ).toEqual([]);
});
