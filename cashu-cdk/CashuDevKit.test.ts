jest.mock('react-native', () => ({
    NativeModules: { CashuDevKitModule: { fetchMintInfo: jest.fn() } }
}));
jest.mock('../utils/ErrorUtils', () => ({
    parseCashuDevKitError: (error: any) => String(error?.message)
}));

import { NativeModules } from 'react-native';
import CashuDevKit from './CashuDevKit';

// What the wallet makes of a mint's answer to GET /v1/info
const mintInfoFrom = (answer: unknown) => {
    (
        NativeModules.CashuDevKitModule.fetchMintInfo as jest.Mock
    ).mockResolvedValue(JSON.stringify(answer));
    return CashuDevKit.fetchMintInfo('https://mint.example.com');
};

describe('CashuDevKit.fetchMintInfo', () => {
    it('keeps a well-formed mint info unchanged', async () => {
        const info = {
            name: 'Mint',
            pubkey: '02aa',
            version: 'Nutshell/0.16.5',
            description: 'short',
            description_long: 'long',
            contact: [{ method: 'email', info: 'hello@mint.example.com' }],
            motd: 'hi',
            icon_url: 'https://mint.example.com/icon.png',
            nuts: {
                '4': { methods: [{ method: 'bolt11', unit: 'sat' }] },
                '15': [{ method: 'bolt11', unit: 'sat' }]
            }
        };
        expect(await mintInfoFrom(info)).toEqual(info);
    });

    it('drops members of the wrong JSON type', async () => {
        const info = await mintInfoFrom({
            name: 1,
            pubkey: true,
            description: {},
            icon_url: ['https://mint.example.com/icon.png'],
            contact: 'hello@mint.example.com',
            motd: [],
            nuts: 4
        });
        expect(info).toEqual({});
        expect(typeof info?.name).toBe('undefined');
    });

    it('drops contacts that are not a pair of strings', async () => {
        const info = await mintInfoFrom({
            contact: [
                { method: 1, info: 'a' },
                { method: 'email', info: ['b'] },
                ['email', 'b'],
                null,
                { method: 'email', info: 'c' }
            ]
        });
        expect(info?.contact).toEqual([{ method: 'email', info: 'c' }]);
    });

    it.each([
        [{ methods: 1 }, []],
        [{ methods: [{ method: 1, unit: 'sat' }, null] }, []],
        [
            { methods: [{ method: 'bolt11', unit: 'sat' }] },
            [{ method: 'bolt11', unit: 'sat' }]
        ],
        [
            [{ method: 'bolt11', unit: 'sat' }],
            [{ method: 'bolt11', unit: 'sat' }]
        ],
        ['bolt11', []]
    ])('reduces NUT-15 %j to a list of methods', async (nut15, methods) => {
        const info = await mintInfoFrom({ nuts: { '15': nut15 } });
        expect(info?.nuts?.['15']).toEqual(methods);
    });

    it('drops members that are not part of the mint info', async () => {
        expect(
            await mintInfoFrom({
                name: 'Mint',
                mintUrl: 'https://other.example.com',
                _mintInfo: { mintUrl: 'https://other.example.com' }
            })
        ).toEqual({ name: 'Mint' });
    });

    it('limits the length of text fields', async () => {
        const info = await mintInfoFrom({
            name: 'n'.repeat(1000),
            version: 'v'.repeat(1000),
            description: 'd'.repeat(20000),
            description_long: 'l'.repeat(20000),
            motd: 'm'.repeat(20000),
            contact: [{ method: 'e'.repeat(1000), info: 'i'.repeat(20000) }]
        });
        expect(info?.name).toHaveLength(256);
        expect(info?.version).toHaveLength(256);
        expect(info?.description).toHaveLength(10000);
        expect(info?.description_long).toHaveLength(10000);
        expect(info?.motd).toHaveLength(10000);
        expect(info?.contact?.[0].method).toHaveLength(256);
        expect(info?.contact?.[0].info).toHaveLength(10000);
    });

    it('drops an icon URL that is too long to be used', async () => {
        const info = await mintInfoFrom({
            icon_url: `https://mint.example.com/${'a'.repeat(20000)}.png`
        });
        expect(info?.icon_url).toBeUndefined();
    });

    it('limits the number of contacts and NUT-15 methods', async () => {
        const info = await mintInfoFrom({
            contact: Array(500).fill({ method: 'email', info: 'a@b.c' }),
            nuts: {
                '15': Array(500).fill({ method: 'bolt11', unit: 'sat' })
            }
        });
        expect(info?.contact).toHaveLength(50);
        expect(info?.nuts?.['15']).toHaveLength(50);
    });

    it.each([[[]], ['text'], [1], [null]])(
        'returns no mint info for the answer %j',
        async (answer) => {
            expect(await mintInfoFrom(answer)).toBeNull();
        }
    );

    it('returns null when the native module has no answer', async () => {
        (
            NativeModules.CashuDevKitModule.fetchMintInfo as jest.Mock
        ).mockResolvedValue(null);
        expect(
            await CashuDevKit.fetchMintInfo('https://mint.example.com')
        ).toBeNull();
    });
});
