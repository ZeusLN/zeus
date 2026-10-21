jest.mock('react-native', () => {
    const methods = [
        'initializeWallet',
        'recoverIncompleteSagas',
        'melt',
        'meltPartial',
        'checkMeltQuote',
        'checkMintQuote',
        'mint',
        'mintExternal',
        'prepareSend',
        'confirmSend',
        'receive',
        'decodeToken',
        'restore',
        'restoreFromSeed',
        'fetchMintInfo'
    ];
    return {
        NativeModules: {
            CashuDevKitModule: Object.fromEntries(
                methods.map((method) => [method, jest.fn()])
            )
        }
    };
});

import { NativeModules } from 'react-native';
import CashuDevKitInstance, { CashuDevKit } from './CashuDevKit';

const mockNative = (NativeModules as any).CashuDevKitModule as Record<
    string,
    jest.Mock
>;

const MINT = 'https://mint.example';
const REPORT = { recovered: 2, compensated: 1, skipped: 0, failed: 0 };

const deferred = <T = void>() => {
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
};

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('CashuDevKit saga recovery', () => {
    let cdk: CashuDevKit;

    beforeEach(() => {
        Object.values(mockNative).forEach((fn) => fn.mockReset());
        mockNative.recoverIncompleteSagas.mockResolvedValue(
            JSON.stringify(REPORT)
        );
        cdk = new CashuDevKit();
    });

    it('returns the parsed recovery report', async () => {
        await expect(cdk.recoverIncompleteSagas(MINT)).resolves.toEqual(REPORT);
        expect(mockNative.recoverIncompleteSagas).toHaveBeenCalledWith(MINT);
    });

    it('maps a native recovery error', async () => {
        mockNative.recoverIncompleteSagas.mockRejectedValue(
            new Error('database is locked')
        );
        await expect(cdk.recoverIncompleteSagas(MINT)).rejects.toMatchObject({
            type: 'Database',
            message: 'database is locked'
        });
    });

    // Each case leaves one native call pending, then tries recovery on the
    // same mint
    const inFlight: Array<[string, string, () => Promise<unknown>]> = [
        ['melt', 'melt', () => cdk.melt(MINT, 'q1')],
        [
            'meltPartial',
            'meltPartial',
            () => cdk.meltPartial(MINT, 'lnbc1', 1000)
        ],
        [
            'checkMeltQuote',
            'checkMeltQuote',
            () => cdk.checkMeltQuote(MINT, 'q1')
        ],
        [
            'checkMintQuote',
            'checkMintQuote',
            () => cdk.checkMintQuote(MINT, 'q1')
        ],
        ['mint', 'mint', () => cdk.mint(MINT, 'q1')],
        ['mintExternal', 'mintExternal', () => cdk.mintExternal(MINT, 'q1', 5)],
        ['restore', 'restore', () => cdk.restore(MINT)],
        [
            'restoreFromSeed',
            'restoreFromSeed',
            () => cdk.restoreFromSeed(MINT, '00')
        ],
        // The gap between prepare and confirm is the window recovery would
        // compensate
        ['send (prepare)', 'prepareSend', () => cdk.send(MINT, 100)],
        ['send (confirm)', 'confirmSend', () => cdk.send(MINT, 100)]
    ];

    it.each(inFlight)(
        'skips recovery while %s is in flight on the mint',
        async (_name, nativeMethod, start) => {
            mockNative.prepareSend.mockResolvedValue(
                JSON.stringify({ id: 'send-1', amount: 100, fee: 0 })
            );
            mockNative.confirmSend.mockResolvedValue('{}');
            const pending = deferred<any>();
            mockNative[nativeMethod].mockReturnValue(pending.promise);

            const operation = start();
            await flush();
            expect(mockNative[nativeMethod]).toHaveBeenCalled();

            await expect(cdk.recoverIncompleteSagas(MINT)).resolves.toBeNull();
            expect(mockNative.recoverIncompleteSagas).not.toHaveBeenCalled();

            const results: Record<string, unknown> = {
                restore: 0,
                restoreFromSeed: 0,
                prepareSend: JSON.stringify({
                    id: 'send-1',
                    amount: 100,
                    fee: 0
                })
            };
            pending.resolve(results[nativeMethod] ?? '{}');
            await operation;
            await expect(cdk.recoverIncompleteSagas(MINT)).resolves.toEqual(
                REPORT
            );
        }
    );

    it('skips recovery while a receive from that mint is in flight', async () => {
        mockNative.decodeToken.mockResolvedValue(
            JSON.stringify({ mint_url: MINT, value: 10 })
        );
        const pending = deferred<number>();
        mockNative.receive.mockReturnValue(pending.promise);

        const receiving = cdk.receive('cashuBtoken');
        await flush();
        expect(mockNative.receive).toHaveBeenCalledWith(
            'cashuBtoken',
            undefined
        );

        await expect(cdk.recoverIncompleteSagas(MINT)).resolves.toBeNull();
        await expect(
            cdk.recoverIncompleteSagas('https://other.mint')
        ).resolves.toEqual(REPORT);

        pending.resolve(10);
        await expect(receiving).resolves.toBe(10);
    });

    it('still receives a token it cannot decode', async () => {
        mockNative.decodeToken.mockRejectedValue(new Error('Invalid token'));
        mockNative.receive.mockRejectedValue(new Error('Invalid token'));

        await expect(cdk.receive('garbage')).rejects.toMatchObject({
            type: 'InvalidToken'
        });
        expect(mockNative.receive).toHaveBeenCalled();
    });

    it('holds a melt until recovery on its mint finishes', async () => {
        const recovery = deferred<string>();
        mockNative.recoverIncompleteSagas.mockReturnValue(recovery.promise);
        mockNative.melt.mockResolvedValue('{"state":"Paid"}');

        const recovering = cdk.recoverIncompleteSagas(MINT);
        const melting = cdk.melt(MINT, 'q1');
        await flush();
        expect(mockNative.melt).not.toHaveBeenCalled();

        recovery.resolve(JSON.stringify(REPORT));
        await expect(recovering).resolves.toEqual(REPORT);
        await expect(melting).resolves.toEqual({ state: 'Paid' });
    });

    it('does not let another wallet hold up recovery', async () => {
        const pending = deferred<string>();
        mockNative.melt.mockReturnValue(pending.promise);

        await cdk.initializeWallet('wallet one', 'sat');
        const melting = cdk.melt(MINT, 'q1');
        await flush();
        await cdk.initializeWallet('wallet two', 'sat');

        await expect(cdk.recoverIncompleteSagas(MINT)).resolves.toEqual(REPORT);

        pending.resolve('{}');
        await melting;
    });

    it('keeps an operation counted when its wallet is initialized again', async () => {
        const pending = deferred<string>();
        mockNative.melt.mockReturnValue(pending.promise);

        await cdk.initializeWallet('wallet one', 'sat');
        const melting = cdk.melt(MINT, 'q1');
        await flush();
        await cdk.initializeWallet('wallet one', 'sat');

        await expect(cdk.recoverIncompleteSagas(MINT)).resolves.toBeNull();
        expect(mockNative.recoverIncompleteSagas).not.toHaveBeenCalled();

        pending.resolve('{}');
        await melting;
        await expect(cdk.recoverIncompleteSagas(MINT)).resolves.toEqual(REPORT);
    });

    it('keeps an operation counted after switching away and back', async () => {
        const pending = deferred<string>();
        mockNative.melt.mockReturnValue(pending.promise);

        await cdk.initializeWallet('wallet one', 'sat');
        const melting = cdk.melt(MINT, 'q1');
        await flush();
        await cdk.initializeWallet('wallet two', 'sat');
        await cdk.initializeWallet('wallet one', 'sat');

        await expect(cdk.recoverIncompleteSagas(MINT)).resolves.toBeNull();

        pending.resolve('{}');
        await melting;
    });
});

// What the wallet makes of a mint's answer to GET /v1/info
const mintInfoFrom = (answer: unknown) => {
    (
        NativeModules.CashuDevKitModule.fetchMintInfo as jest.Mock
    ).mockResolvedValue(JSON.stringify(answer));
    return CashuDevKitInstance.fetchMintInfo('https://mint.example.com');
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
            await CashuDevKitInstance.fetchMintInfo('https://mint.example.com')
        ).toBeNull();
    });
});
