import { getEncodedToken, getEncodedTokenV4 } from '@cashu/cashu-ts';

// Mock CashuDevKit to avoid native module dependency in tests
jest.mock('../cashu-cdk', () => ({
    __esModule: true,
    default: {
        isAvailable: () => false,
        isValidToken: jest.fn(),
        decodeToken: jest.fn()
    }
}));

import CashuUtils, { cashuTokenPrefixes } from './CashuUtils';

// Generate valid cashuA (v3) and cashuB (v4) tokens from the library
const sampleToken = {
    mint: 'https://mint.example.com',
    proofs: [
        {
            id: '00ad268d4d1f5826',
            amount: 1,
            secret: 'acc12435e7b8484c3cf1850149218af90f716a52bf4a5ed347e48ecc13f77388',
            C: '02445383199e485d5cbed3b29a642bee5879375ab9e7a620e11e48ba482421f3cf'
        }
    ],
    unit: 'sat' as const
};

// Use the library to create real encoded tokens
const cashuAToken = getEncodedToken(sampleToken, { version: 3 });
const cashuBToken = getEncodedTokenV4(sampleToken);

describe('CashuUtils', () => {
    describe('extractTokenString', () => {
        it('returns empty string for null/undefined/empty input', () => {
            expect(CashuUtils.extractTokenString('')).toBe('');
            expect(CashuUtils.extractTokenString(null as any)).toBe('');
            expect(CashuUtils.extractTokenString(undefined as any)).toBe('');
        });

        it('returns cashuA token as-is when no prefix', () => {
            const result = CashuUtils.extractTokenString(cashuAToken);
            expect(result).toBe(cashuAToken);
            expect(result.startsWith('cashuA')).toBe(true);
        });

        it('returns cashuB token as-is when no prefix', () => {
            const result = CashuUtils.extractTokenString(cashuBToken);
            expect(result).toBe(cashuBToken);
            expect(result.startsWith('cashuB')).toBe(true);
        });

        it('extracts cashuA token from URL prefixes', () => {
            for (const prefix of cashuTokenPrefixes) {
                const input = `${prefix}${cashuAToken}`;
                const result = CashuUtils.extractTokenString(input);
                expect(result).toBe(cashuAToken);
            }
        });

        it('extracts cashuB token from URL prefixes', () => {
            for (const prefix of cashuTokenPrefixes) {
                const input = `${prefix}${cashuBToken}`;
                const result = CashuUtils.extractTokenString(input);
                expect(result).toBe(cashuBToken);
            }
        });

        it('extracts cashuA token embedded in arbitrary text', () => {
            const input = `some garbage before ${cashuAToken} and after`;
            const result = CashuUtils.extractTokenString(input);
            expect(result.startsWith('cashuA')).toBe(true);
        });

        it('extracts cashuB token embedded in arbitrary text', () => {
            const input = `some garbage before ${cashuBToken} and after`;
            const result = CashuUtils.extractTokenString(input);
            expect(result.startsWith('cashuB')).toBe(true);
        });

        it('trims whitespace', () => {
            expect(CashuUtils.extractTokenString(`  ${cashuAToken}  `)).toBe(
                cashuAToken
            );
            expect(CashuUtils.extractTokenString(`  ${cashuBToken}  `)).toBe(
                cashuBToken
            );
        });

        it('picks the earliest cashu prefix when both are present', () => {
            // cashuA appears first
            const inputAFirst = `${cashuAToken} ${cashuBToken}`;
            expect(
                CashuUtils.extractTokenString(inputAFirst).startsWith('cashuA')
            ).toBe(true);

            // cashuB appears first
            const inputBFirst = `${cashuBToken} ${cashuAToken}`;
            expect(
                CashuUtils.extractTokenString(inputBFirst).startsWith('cashuB')
            ).toBe(true);
        });
    });

    describe('isValidCashuToken', () => {
        it('validates cashuA tokens', () => {
            expect(CashuUtils.isValidCashuToken(cashuAToken)).toBe(true);
        });

        it('validates cashuB tokens', () => {
            expect(CashuUtils.isValidCashuToken(cashuBToken)).toBe(true);
        });

        it('validates cashuA tokens with URL prefix', () => {
            expect(CashuUtils.isValidCashuToken(`cashu:${cashuAToken}`)).toBe(
                true
            );
        });

        it('validates cashuB tokens with URL prefix', () => {
            expect(CashuUtils.isValidCashuToken(`cashu:${cashuBToken}`)).toBe(
                true
            );
        });

        it('rejects invalid tokens', () => {
            expect(CashuUtils.isValidCashuToken('')).toBe(false);
            expect(CashuUtils.isValidCashuToken('notavalidtoken')).toBe(false);
            expect(CashuUtils.isValidCashuToken('cashuAinvalidpayload')).toBe(
                false
            );
            expect(CashuUtils.isValidCashuToken('cashuBinvalidpayload')).toBe(
                false
            );
        });

        it('rejects null/undefined', () => {
            expect(CashuUtils.isValidCashuToken(null as any)).toBe(false);
            expect(CashuUtils.isValidCashuToken(undefined as any)).toBe(false);
        });
    });

    describe('decodeCashuToken', () => {
        it('decodes cashuA token to correct mint and proofs', () => {
            const decoded = CashuUtils.decodeCashuToken(cashuAToken);
            expect(decoded.mint).toBe('https://mint.example.com');
            expect(decoded.proofs).toHaveLength(1);
            expect(decoded.proofs[0].amount).toBe(1);
        });

        it('decodes cashuB token to correct mint and proofs', () => {
            const decoded = CashuUtils.decodeCashuToken(cashuBToken);
            expect(decoded.mint).toBe('https://mint.example.com');
            expect(decoded.proofs).toHaveLength(1);
            expect(decoded.proofs[0].amount).toBe(1);
        });

        it('throws on invalid token', () => {
            expect(() => CashuUtils.decodeCashuToken('invalidtoken')).toThrow();
        });
    });

    describe('sumProofsValue', () => {
        it('sums proof amounts', () => {
            expect(
                CashuUtils.sumProofsValue([
                    { amount: 1 },
                    { amount: 2 },
                    { amount: 4 }
                ])
            ).toBe(7);
        });

        it('returns 0 for empty/null', () => {
            expect(CashuUtils.sumProofsValue([])).toBe(0);
            expect(CashuUtils.sumProofsValue(null)).toBe(0);
            expect(CashuUtils.sumProofsValue(undefined)).toBe(0);
        });
    });

    describe('P2PK helpers', () => {
        // Use a far-future locktime so the token is still considered locked
        const futureLocktime = Math.floor(Date.now() / 1000) + 86400 * 365;
        const p2pkSecret = JSON.stringify([
            'P2PK',
            {
                nonce: 'abc123',
                data: '02abcdef1234567890',
                tags: [['locktime', futureLocktime]]
            }
        ]);

        it('detects P2PK locked tokens', () => {
            expect(
                CashuUtils.isTokenP2PKLocked({
                    proofs: [{ secret: p2pkSecret }]
                })
            ).toBe(true);
        });

        it('returns false for non-P2PK tokens', () => {
            expect(
                CashuUtils.isTokenP2PKLocked({
                    proofs: [{ secret: 'plainSecret' }]
                })
            ).toBe(false);
        });

        it('extracts P2PK pubkey from secret', () => {
            expect(CashuUtils.getP2PKPubkeySecret(p2pkSecret)).toBe(
                '02abcdef1234567890'
            );
        });

        it('returns undefined for non-P2PK secret', () => {
            expect(
                CashuUtils.getP2PKPubkeySecret('plainSecret')
            ).toBeUndefined();
        });

        it('extracts locktime from P2PK secret', () => {
            expect(CashuUtils.getP2PKLocktime(p2pkSecret)).toBe(futureLocktime);
        });

        it('returns undefined locktime for non-P2PK secret', () => {
            expect(CashuUtils.getP2PKLocktime('plainSecret')).toBeUndefined();
        });

        it('returns undefined for malformed JSON', () => {
            expect(CashuUtils.getP2PKPubkeySecret('{bad json')).toBeUndefined();
        });

        it('rejects deeply nested secrets', () => {
            const deep = '[[[[[[[[[[["P2PK",{"data":"key"}]]]]]]]]]]]';
            expect(CashuUtils.getP2PKPubkeySecret(deep)).toBeUndefined();
        });

        it('rejects oversized secrets', () => {
            const big = 'x'.repeat(3000);
            expect(CashuUtils.getP2PKPubkeySecret(big)).toBeUndefined();
        });
    });
});
