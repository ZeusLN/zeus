import {
    LndErrorCode,
    isStopLndExpectedError,
    isTransientRpcError,
    matchRawErrorToCode,
    matchesLndErrorCode,
    normalizeForMatch
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
    it('maps EOF stream errors correctly', () => {
        expect(matchRawErrorToCode('error reading from server: EOF')).toBe(
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

    it('matches wallet locked errors case-insensitively', () => {
        expect(
            matchesLndErrorCode(
                'Wallet Locked: unlock required',
                LndErrorCode.WALLET_LOCKED
            )
        ).toBe(true);
    });

    it('identifies transient RPC errors', () => {
        expect(isTransientRpcError('rpc connection closed by peer')).toBe(true);
        expect(isTransientRpcError('macaroon store is locked')).toBe(true);
        expect(isTransientRpcError('folder missing')).toBe(false);
    });

    it('identifies expected stop-LND errors', () => {
        expect(isStopLndExpectedError('unable to read TLS cert')).toBe(true);
        expect(isStopLndExpectedError('wallet locked')).toBe(true);
        expect(isStopLndExpectedError('random fatal error')).toBe(false);
    });
});
