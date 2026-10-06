import {
    LndErrorCode,
    MAX_TRANSIENT_RPC_RETRIES,
    isStopLndExpectedError,
    isTransientRpcError,
    matchRawErrorToCode,
    matchesLndErrorCode,
    normalizeForMatch,
    retryOnTransientError
} from './LndMobileErrors';

jest.mock('./SleepUtils', () => ({
    sleep: jest.fn()
}));

const SleepMock: { sleep: jest.Mock } = jest.requireMock('./SleepUtils');

describe('normalizeForMatch', () => {
    it('lowercases input', () => {
        expect(normalizeForMatch('ABC DEF')).toBe('abc def');
    });

    it('normalizes curly apostrophes to ASCII apostrophe', () => {
        expect(normalizeForMatch('doesn’t')).toBe("doesn't");
        expect(normalizeForMatch('doesn‘t')).toBe("doesn't");
    });

    it('normalizes backtick apostrophe to ASCII apostrophe', () => {
        expect(normalizeForMatch('doesn`t')).toBe("doesn't");
    });

    it('normalizes smart double quotes to ASCII double quote', () => {
        expect(normalizeForMatch('“lnd.conf”')).toBe('"lnd.conf"');
    });

    it('preserves already-normalized strings', () => {
        expect(normalizeForMatch("folder doesn't exist")).toBe(
            "folder doesn't exist"
        );
    });

    it('normalizes full mixed punctuation sentence', () => {
        expect(normalizeForMatch('The folder “lnd.conf” doesn’t exist.')).toBe(
            `the folder "lnd.conf" doesn't exist.`
        );
    });
});

describe('LndMobileErrors classification', () => {
    it('matches LND_FOLDER_MISSING with smart-quoted input', () => {
        expect(
            matchesLndErrorCode(
                'folder doesn’t exist',
                LndErrorCode.LND_FOLDER_MISSING
            )
        ).toBe(true);
    });

    it('maps full iOS lnd.conf missing sentence to LND_FOLDER_MISSING', () => {
        expect(
            matchRawErrorToCode('The folder “lnd.conf” doesn’t exist.')
        ).toBe(LndErrorCode.LND_FOLDER_MISSING);
    });

    it('maps EOF stream errors correctly', () => {
        expect(matchRawErrorToCode('error reading from server: EOF')).toBe(
            LndErrorCode.STREAM_EOF
        );
    });

    it('maps stream shutdown variants to STREAM_EOF', () => {
        expect(matchRawErrorToCode('channel event store shutting down')).toBe(
            LndErrorCode.STREAM_EOF
        );
    });

    it('maps RPC not-ready variants correctly', () => {
        expect(
            matchRawErrorToCode(
                'walletkit service not yet ready to accept calls'
            )
        ).toBe(LndErrorCode.RPC_NOT_READY);
    });

    it('maps LND already-running variants correctly', () => {
        expect(matchRawErrorToCode('lnd already started')).toBe(
            LndErrorCode.LND_ALREADY_RUNNING
        );
        expect(matchRawErrorToCode('daemon already running')).toBe(
            LndErrorCode.LND_ALREADY_RUNNING
        );
    });

    it('matches wallet locked errors case-insensitively', () => {
        expect(
            matchesLndErrorCode(
                'Wallet Locked: unlock required',
                LndErrorCode.WALLET_LOCKED
            )
        ).toBe(true);
    });

    it('maps macaroon store lock variants correctly', () => {
        expect(matchRawErrorToCode('cannot retrieve macaroon from store')).toBe(
            LndErrorCode.MACAROON_STORE_LOCKED
        );
        expect(matchRawErrorToCode('cannot get macaroon')).toBe(
            LndErrorCode.MACAROON_STORE_LOCKED
        );
    });

    it('maps gen-seed unlocked race errors correctly', () => {
        expect(
            matchRawErrorToCode('WalletUnlocker service is no longer available')
        ).toBe(LndErrorCode.GEN_SEED_UNLOCKED);
        expect(matchRawErrorToCode('wallet already unlocked')).toBe(
            LndErrorCode.GEN_SEED_UNLOCKED
        );
    });

    it('identifies transient RPC errors', () => {
        expect(isTransientRpcError('rpc connection closed by peer')).toBe(true);
        expect(isTransientRpcError('macaroon store is locked')).toBe(true);
        expect(isTransientRpcError('folder missing')).toBe(false);
    });

    it('identifies expected stop-LND errors', () => {
        expect(isStopLndExpectedError('unable to read TLS cert')).toBe(true);
        expect(isStopLndExpectedError('connection refused')).toBe(true);
        expect(isStopLndExpectedError('connection reset by peer')).toBe(true);
        expect(isStopLndExpectedError('wallet locked')).toBe(true);
        expect(isStopLndExpectedError('random fatal error')).toBe(false);
    });

    it('returns false when matching with wrong code', () => {
        expect(
            matchesLndErrorCode(
                'wallet locked',
                LndErrorCode.LND_FOLDER_MISSING
            )
        ).toBe(false);
    });

    it('returns null when no pattern matches', () => {
        expect(
            matchRawErrorToCode('some totally unrelated native failure')
        ).toBeNull();
    });
});

// While retryOnTransientError waits, a connecting=false would show the error
// screen, whose Retry starts a second connect next to the queued one.
describe('retryOnTransientError', () => {
    const error = new Error('server is still starting up');

    beforeEach(() => {
        SleepMock.sleep.mockReset().mockResolvedValue(undefined);
    });

    it('stays in connecting mode while waiting', async () => {
        let releaseSleep: () => void = () => {};
        SleepMock.sleep.mockReturnValue(
            new Promise<void>((resolve) => (releaseSleep = resolve))
        );
        const setConnecting = jest.fn();
        const onRetry = jest.fn();

        const result = retryOnTransientError(
            error,
            error.message,
            'RPC error',
            0,
            setConnecting,
            onRetry
        );
        await Promise.resolve();

        expect(SleepMock.sleep).toHaveBeenCalledTimes(1);
        expect(setConnecting).not.toHaveBeenCalled();
        expect(onRetry).not.toHaveBeenCalled();

        releaseSleep();
        await result;

        expect(setConnecting.mock.calls).toEqual([[true]]);
        expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('re-enters connecting mode before retrying', async () => {
        const order: string[] = [];
        const setConnecting = jest.fn((v: boolean) =>
            order.push(`setConnecting(${v})`)
        );
        const onRetry = jest.fn(() => {
            order.push('onRetry');
        });

        await retryOnTransientError(
            error,
            error.message,
            'RPC error',
            0,
            setConnecting,
            onRetry
        );

        expect(order).toEqual(['setConnecting(true)', 'onRetry']);
    });

    it('doubles the wait with each retry', async () => {
        await retryOnTransientError(
            error,
            error.message,
            'RPC error',
            0,
            jest.fn(),
            jest.fn()
        );
        await retryOnTransientError(
            error,
            error.message,
            'RPC error',
            2,
            jest.fn(),
            jest.fn()
        );

        expect(SleepMock.sleep.mock.calls).toEqual([[2000], [8000]]);
    });

    it('leaves connecting mode and rethrows after the last retry', async () => {
        const setConnecting = jest.fn();
        const onRetry = jest.fn();

        await expect(
            retryOnTransientError(
                error,
                error.message,
                'RPC error',
                MAX_TRANSIENT_RPC_RETRIES,
                setConnecting,
                onRetry
            )
        ).rejects.toBe(error);

        expect(setConnecting.mock.calls).toEqual([[false]]);
        expect(SleepMock.sleep).not.toHaveBeenCalled();
        expect(onRetry).not.toHaveBeenCalled();
    });
});
