// NIP-05 lookups must not follow redirects. nostr-tools asks for that with
// { redirect: 'manual' }, which React Native's fetch ignores, so the lookup
// has to go through a client whose redirect handling can be turned off.
const mockBlobFetch = jest.fn();
const mockBlobConfig = jest.fn((_options: any) => ({
    fetch: mockBlobFetch
}));
jest.mock('react-native-blob-util', () => ({
    __esModule: true,
    default: { config: (options: any) => mockBlobConfig(options) }
}));

const PUBKEY =
    '5d4e6c6c1e6f1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f70819203';

// Stands in for React Native's fetch, which follows a redirect to wherever
// it points. nostr-tools reads the global fetch when it loads, so it is set
// before nostr-tools is required.
const globalFetch = jest.fn(async () => ({
    status: 200,
    json: async () => ({ names: { alice: PUBKEY } })
}));
(global as any).fetch = globalFetch;

const { nip05 } = require('nostr-tools');
require('./Nip05FetchConfig');

const blobResponse = (status: number, body: any = {}) => ({
    info: () => ({ status }),
    json: () => body
});

describe('NIP-05 fetch', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('requests nostr.json with redirects off', async () => {
        mockBlobFetch.mockResolvedValue(
            blobResponse(200, {
                names: { alice: PUBKEY },
                relays: { [PUBKEY]: ['wss://relay.example'] }
            })
        );

        const profile = await nip05.queryProfile('alice@example.com');

        expect(profile).toEqual({
            pubkey: PUBKEY,
            relays: ['wss://relay.example']
        });
        expect(mockBlobConfig).toHaveBeenCalledWith({ followRedirect: false });
        expect(mockBlobFetch).toHaveBeenCalledWith(
            'get',
            'https://example.com/.well-known/nostr.json?name=alice'
        );
        expect(globalFetch).not.toHaveBeenCalled();
    });

    it.each([301, 302, 303, 307, 308])(
        'finds nothing when the host answers %i',
        async (status) => {
            mockBlobFetch.mockResolvedValue(
                blobResponse(status, { names: { alice: PUBKEY } })
            );

            expect(await nip05.queryProfile('alice@example.com')).toBeNull();
            expect(globalFetch).not.toHaveBeenCalled();
        }
    );

    it('finds nothing when the request fails', async () => {
        mockBlobFetch.mockRejectedValue(new Error('offline'));

        expect(await nip05.queryProfile('alice@example.com')).toBeNull();
    });
});
