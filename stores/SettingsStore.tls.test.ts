// Coverage for the TLS transport defaults applied when a node config is
// loaded: certVerification must default to true for configs that predate
// the field or never set it (secure by default), while a saved explicit
// opt-out (trust-all) must be respected; pinnedCerts (from lndconnect
// cert= / clnrest certs= connection-string params) must be copied onto
// the store for the REST backends, and cleared when no node is selected.

jest.mock('react-native-biometrics', () => ({ BiometryType: {} }));
jest.mock('react-native-blob-util', () => ({
    fs: {
        dirs: { LibraryDir: '/lib', DocumentDir: '/docs' }
    }
}));
jest.mock('react-native-encrypted-storage', () => ({
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../utils/BackendUtils', () => ({}));
jest.mock('../utils/BiometricUtils', () => ({
    getSupportedBiometryType: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('../utils/LocaleUtils', () => ({
    localeString: (s: string) => s
}));
jest.mock('../utils/MigrationUtils', () => ({
    keychainCloudSyncMigration: jest.fn().mockResolvedValue(undefined),
    migrateRgsDefaultToZeus: jest.fn().mockResolvedValue(undefined),
    migrateInvoiceExpiryDisplay: jest.fn().mockResolvedValue(undefined),
    legacySettingsMigrations: jest.fn().mockResolvedValue({}),
    storageMigrationV2: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('../utils/TorUtils', () => ({
    doTorRequest: jest.fn(),
    RequestMethod: {}
}));
jest.mock('../utils/LdkNodeUtils', () => ({
    DEFAULT_SCORER_URL: '',
    DEFAULT_VSS_SERVER: '',
    getDefaultEsploraServer: jest.fn().mockReturnValue(''),
    getDefaultRgsServer: jest.fn().mockReturnValue('')
}));

jest.mock('../storage', () => ({
    getItem: jest.fn(async () => false),
    setItem: jest.fn(async () => true),
    removeItem: jest.fn(async () => true)
}));

import SettingsStore from './SettingsStore';

describe('SettingsStore.updateNodeProperties TLS defaults', () => {
    it('defaults certVerification to true when the node predates the field', () => {
        const store = new SettingsStore();
        (store as any).updateNodeProperties({
            nodes: [{ implementation: 'lnd', host: 'example.com' }],
            selectedNode: 0
        });
        expect(store.certVerification).toEqual(true);
    });

    it('respects an explicit certVerification opt-out on saved nodes', () => {
        const store = new SettingsStore();
        (store as any).updateNodeProperties({
            nodes: [{ implementation: 'lnd', certVerification: false }],
            selectedNode: 0
        });
        expect(store.certVerification).toEqual(false);
    });

    it('copies pinned certs from the node and resets them with no node selected', () => {
        const store = new SettingsStore();
        (store as any).updateNodeProperties({
            nodes: [
                { implementation: 'lnd', pinnedCerts: ['bXktZGVyLWNlcnQ='] }
            ],
            selectedNode: 0
        });
        expect(store.pinnedCerts).toEqual(['bXktZGVyLWNlcnQ=']);

        (store as any).updateNodeProperties({ nodes: [], selectedNode: 0 });
        expect(store.pinnedCerts).toBeUndefined();
        expect(store.certVerification).toEqual(true);
    });
});
