jest.mock('./Stores', () => ({
    connectivityStore: {
        isOffline: false,
        start: jest.fn(),
        stop: jest.fn(),
        onReconnect: jest.fn()
    }
}));
jest.mock('./SettingsStore', () => ({
    DEFAULT_NOSTR_RELAYS: ['wss://relay.one']
}));
jest.mock('react-native-blob-util', () => ({}));
jest.mock('@nostr-dev-kit/ndk', () => ({
    __esModule: true,
    default: jest.fn()
}));
jest.mock('../utils/NostrUtils', () => ({}));
jest.mock('../utils/NostrMintBackup', () => ({
    deriveMintBackupKeypair: jest.fn(() => ({
        privateKeyHex: 'priv',
        publicKeyHex: 'pub'
    })),
    backupMintsToNostr: jest.fn(),
    restoreMintsFromNostr: jest.fn().mockResolvedValue(null)
}));
jest.mock('../utils/MigrationUtils', () => ({
    migrateLegacyCashuKeysToNodeDir: jest.fn().mockResolvedValue(undefined),
    migrateCashuSeedVersion: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('../utils/ThemeUtils', () => ({}));
jest.mock('../utils/LocaleUtils', () => ({ localeString: (s: string) => s }));
jest.mock('../NavigationService', () => ({}));
jest.mock('../cashu-cdk', () => ({
    isAvailable: jest.fn(() => true),
    initializeWallet: jest.fn().mockResolvedValue(undefined),
    addMint: jest.fn().mockResolvedValue(undefined),
    removeMint: jest.fn().mockResolvedValue(undefined),
    getMintUrls: jest.fn().mockResolvedValue([]),
    getBalances: jest.fn().mockResolvedValue({}),
    getTotalBalance: jest.fn().mockResolvedValue(0),
    listTransactions: jest.fn().mockResolvedValue([])
}));
jest.mock('../storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    getRawItem: jest.fn().mockResolvedValue(null),
    KEY_PREFIX: 'zeus:'
}));

import CashuStore from './CashuStore';
import CashuDevKit from '../cashu-cdk';
import Storage from '../storage';

const cdk = CashuDevKit as unknown as Record<string, jest.Mock>;

const APPROVED = 'https://approved.mint';
const OTHER = 'https://other.mint';
// A mint CDK added on demand, e.g. the source mint of a token swept to
// Lightning. It is in CDK's wallet list but the user never added it.
const ON_DEMAND = 'https://on-demand.mint';

// mintUrls is what LightningAddressStore.redeemCashu trusts besides the
// configured ZEUS Pay mint, so it must hold only mints the user approved.
describe('CashuStore mintUrls holds only approved mints', () => {
    let stored: Map<string, string>;
    let store: CashuStore;

    const storedMintUrls = () =>
        JSON.parse(stored.get('node1-cashu-mintUrls') || 'null');

    beforeEach(() => {
        jest.clearAllMocks();
        cdk.removeMint.mockResolvedValue(undefined);
        cdk.getMintUrls.mockResolvedValue([]);
        stored = new Map();
        (Storage.getItem as jest.Mock).mockImplementation(
            async (key: string) => stored.get(key) ?? false
        );
        (Storage.setItem as jest.Mock).mockImplementation(
            async (key: string, value: any) => {
                stored.set(
                    key,
                    typeof value === 'string' ? value : JSON.stringify(value)
                );
            }
        );
        (Storage.removeItem as jest.Mock).mockImplementation(
            async (key: string) => {
                stored.delete(key);
            }
        );
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});

        store = new CashuStore(
            {
                implementation: 'ldk-node',
                ldkNodeDir: 'node1',
                ldkMnemonic: `${'abandon '.repeat(11)}about`,
                settings: {}
            } as any,
            {} as any,
            { channels: [] } as any,
            {} as any
        );
        jest.spyOn(store, 'initializeWallet').mockResolvedValue(
            undefined as any
        );
        jest.spyOn(store, 'fetchMintInfo').mockResolvedValue(undefined as any);
        jest.spyOn(store, 'syncCDKBalances').mockResolvedValue(
            undefined as any
        );
        jest.spyOn(store, 'nostrBackupMints').mockResolvedValue(
            undefined as any
        );
        jest.spyOn(store, 'setSelectedMint').mockResolvedValue(
            undefined as any
        );
    });

    afterEach(() => jest.restoreAllMocks());

    it('leaves out an orphan wallet that the boot cleanup fails to remove', async () => {
        stored.set('node1-cashu-mintUrls', JSON.stringify([APPROVED]));
        cdk.getMintUrls.mockResolvedValue([APPROVED, ON_DEMAND]);
        cdk.removeMint.mockRejectedValue(new Error('removeMint failed'));

        await store.initializeWallets();

        expect(cdk.removeMint).toHaveBeenCalledWith(ON_DEMAND);
        expect(store.mintUrls).toEqual([APPROVED]);
        expect(storedMintUrls()).toEqual([APPROVED]);
    });

    it('does not adopt an on-demand CDK wallet when the user adds a mint', async () => {
        store.mintUrls = [APPROVED];
        cdk.getMintUrls.mockResolvedValue([APPROVED, ON_DEMAND, OTHER]);

        await store.addMint(OTHER);

        expect(store.mintUrls).toEqual([APPROVED, OTHER]);
        expect(storedMintUrls()).toEqual([APPROVED, OTHER]);
    });

    it("takes CDK's spelling of an added mint whose scheme and host CDK lowercased", async () => {
        cdk.getMintUrls.mockResolvedValue([
            'https://new.mint/Bitcoin',
            'https://new.mint/bitcoin'
        ]);

        await store.addMint('HTTPS://New.Mint/Bitcoin/');

        expect(store.mintUrls).toEqual(['https://new.mint/Bitcoin']);
    });

    it('does not adopt an on-demand CDK wallet when the user removes a mint', async () => {
        store.mintUrls = [APPROVED, OTHER];
        store.selectedMintUrl = OTHER;
        store.selectedMintUrls = [OTHER];
        // A leftover handle can keep the removed mint in CDK's list
        cdk.getMintUrls.mockResolvedValue([OTHER, APPROVED, ON_DEMAND]);

        await store.removeMint(APPROVED);

        expect(store.mintUrls).toEqual([OTHER]);
        expect(storedMintUrls()).toEqual([OTHER]);
    });
});
