jest.mock('./Stores', () => ({
    activityStore: { getSortedActivity: jest.fn() }
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
jest.mock('../utils/NostrMintBackup', () => ({}));
jest.mock('../utils/MigrationUtils', () => ({}));
jest.mock('../utils/ThemeUtils', () => ({}));
jest.mock('../utils/LocaleUtils');
jest.mock('../NavigationService', () => ({}));
jest.mock('../cashu-cdk', () => ({
    __esModule: true,
    default: {
        isAvailable: jest.fn(() => true),
        fetchMintInfo: jest.fn()
    }
}));
jest.mock('../storage', () => ({
    __esModule: true,
    default: { setItem: jest.fn(), getItem: jest.fn(), removeItem: jest.fn() },
    getRawItem: jest.fn(),
    removeRawItem: jest.fn(),
    KEY_PREFIX: 'zeus:'
}));

import CashuStore from './CashuStore';
import CashuDevKit from '../cashu-cdk';

const fetchMintInfo = CashuDevKit.fetchMintInfo as jest.Mock;

const newStore = () =>
    new CashuStore(
        { implementation: 'ldk-node', settings: {} } as any,
        {} as any,
        {} as any,
        {} as any
    );

// A NIP-87 kind 38000 recommendation for a Cashu mint (k = 38172)
const recommendation = (mintUrl: unknown, pubkey = 'ab'.repeat(32)) => {
    const tags: Record<string, unknown> = { k: '38172', u: mintUrl };
    return {
        pubkey,
        content: '',
        created_at: 1700000000,
        tagValue: (name: string) => tags[name]
    };
};

const process = (store: CashuStore, events: any[]) =>
    (store as any).processMintRecommendationEvents(new Set(events));

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('CashuStore mint recommendations', () => {
    it('keeps public https mints and counts each recommendation', () => {
        const { recommendations, reviews } = process(newStore(), [
            recommendation('https://mint.example'),
            recommendation('https://mint.example', 'cd'.repeat(32)),
            recommendation('https://other.example/cashu')
        ]);

        expect(recommendations).toEqual([
            { url: 'https://mint.example', count: 2 },
            { url: 'https://other.example/cashu', count: 1 }
        ]);
        expect(reviews.get('https://mint.example')).toHaveLength(2);
    });

    it.each([
        ['plain http', 'http://mint.example'],
        ['loopback', 'https://127.0.0.1:3338'],
        ['localhost', 'https://localhost:3338'],
        ['a private address', 'https://192.168.1.10'],
        ['a link-local address', 'https://169.254.169.254'],
        ['an IPv6 loopback', 'https://[::1]:3338'],
        ['an onion host', 'https://mint.onion'],
        ['a percent-encoded host', 'https://192.168.%31.1'],
        ['a backslash', 'https://mint.example\\@192.168.1.1'],
        ['a value that is not a string', 42]
    ])('drops a recommended mint URL with %s', (_label, mintUrl) => {
        const { recommendations, reviews } = process(newStore(), [
            recommendation(mintUrl),
            recommendation('https://mint.example')
        ]);

        expect(recommendations).toEqual([
            { url: 'https://mint.example', count: 1 }
        ]);
        expect(Array.from(reviews.keys())).toEqual(['https://mint.example']);
    });
});

describe('CashuStore fetchMintInfoBatch', () => {
    it('fetches and caches info only for public https mints', async () => {
        const store = newStore();
        fetchMintInfo.mockImplementation(async (url: string) => ({
            name: url
        }));

        await store.fetchMintInfoBatch([
            'https://mint.example',
            'https://127.0.0.1:3338',
            'http://mint.example',
            'https://10.0.0.5'
        ]);

        expect(fetchMintInfo.mock.calls).toEqual([['https://mint.example']]);
        expect(Array.from(store.mintInfoCache.keys())).toEqual([
            'https://mint.example'
        ]);
    });

    it('does not fetch a mint again while its info is still loading', async () => {
        const store = newStore();
        let answer!: (info: any) => void;
        fetchMintInfo.mockReturnValueOnce(
            new Promise((resolve) => (answer = resolve))
        );

        // The onboarding screens call this on each render until the info
        // is cached
        const first = store.fetchMintInfoBatch(['https://mint.example']);
        await store.fetchMintInfoBatch(['https://mint.example']);
        await store.fetchMintInfoBatch([
            'https://mint.example',
            'https://mint.example'
        ]);
        expect(fetchMintInfo).toHaveBeenCalledTimes(1);

        answer({ name: 'Mint' });
        await first;
        expect(store.mintInfoCache.get('https://mint.example')).toEqual({
            name: 'Mint'
        });

        await store.fetchMintInfoBatch(['https://mint.example']);
        expect(fetchMintInfo).toHaveBeenCalledTimes(1);
    });

    it('tries a mint again after its fetch failed', async () => {
        const store = newStore();
        fetchMintInfo
            .mockRejectedValueOnce(new Error('Mint returned HTTP 302'))
            .mockResolvedValueOnce({ name: 'Mint' });

        await store.fetchMintInfoBatch(['https://mint.example']);
        expect(store.mintInfoCache.has('https://mint.example')).toBe(false);

        await store.fetchMintInfoBatch(['https://mint.example']);
        expect(fetchMintInfo).toHaveBeenCalledTimes(2);
        expect(store.mintInfoCache.get('https://mint.example')).toEqual({
            name: 'Mint'
        });
    });
});
