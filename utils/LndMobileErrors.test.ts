import {
    LndErrorCode,
    isStopLndExpectedError,
    isTransientRpcError,
    matchRawErrorToCode,
    matchesLndErrorCode,
    normalizeForMatch,
    retryOnTransientError,
    MAX_TRANSIENT_RPC_RETRIES
} from './LndMobileErrors';

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

describe('retryOnTransientError', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.spyOn(console, 'log').mockImplementation(() => {});
    });
    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    const retry = (retryCount: number, isCurrent?: () => boolean) => {
        const setConnecting = jest.fn();
        const onRetry = jest.fn();
        const done = retryOnTransientError(
            new Error('transient'),
            'transient',
            'test',
            retryCount,
            setConnecting,
            onRetry,
            isCurrent
        );
        return { setConnecting, onRetry, done };
    };

    it('reconnects and retries after the backoff', async () => {
        const { setConnecting, onRetry, done } = retry(1);
        await jest.advanceTimersByTimeAsync(4000);
        await done;
        expect(setConnecting.mock.calls).toEqual([[false], [true]]);
        expect(onRetry).toHaveBeenCalledTimes(1);
        // setConnecting(true) frees the fetch lock that onRetry's fetchData
        // needs, so it has to run first
        expect(setConnecting.mock.invocationCallOrder[1]).toBeLessThan(
            onRetry.mock.invocationCallOrder[0]
        );
    });

    it('stops without reconnecting when the wallet changed during the backoff', async () => {
        let current = true;
        const { setConnecting, onRetry, done } = retry(0, () => current);
        expect(setConnecting.mock.calls).toEqual([[false]]);
        // a wallet switch lands while the retry sleeps
        current = false;
        await jest.advanceTimersByTimeAsync(2000);
        await done;
        expect(setConnecting.mock.calls).toEqual([[false]]);
        expect(onRetry).not.toHaveBeenCalled();
    });

    it('gives up after the retry cap', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
        const { setConnecting, onRetry, done } = retry(
            MAX_TRANSIENT_RPC_RETRIES
        );
        await expect(done).rejects.toThrow('transient');
        expect(setConnecting.mock.calls).toEqual([[false]]);
        expect(onRetry).not.toHaveBeenCalled();
    });
});
