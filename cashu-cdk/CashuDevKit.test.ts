jest.mock('react-native', () => {
    const methods = [
        'initializeWallet',
        'recoverIncompleteSagas',
        'melt',
        'meltPartial',
        'checkMeltQuote',
        'mint',
        'mintExternal',
        'prepareSend',
        'confirmSend',
        'receive',
        'decodeToken',
        'restore',
        'restoreFromSeed'
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
import { CashuDevKit } from './CashuDevKit';

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

    it('does not let a previous wallet hold up recovery', async () => {
        const pending = deferred<string>();
        mockNative.melt.mockReturnValue(pending.promise);

        const melting = cdk.melt(MINT, 'q1');
        await flush();
        await cdk.initializeWallet('abandon about', 'sat');

        await expect(cdk.recoverIncompleteSagas(MINT)).resolves.toEqual(REPORT);

        pending.resolve('{}');
        await melting;
    });
});
