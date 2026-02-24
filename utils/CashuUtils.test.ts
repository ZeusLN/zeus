// Mock CashuDevKit to avoid native module dependency in tests
jest.mock('../cashu-cdk', () => ({
    __esModule: true,
    default: {
        isAvailable: () => false,
        isValidToken: jest.fn(),
        decodeToken: jest.fn()
    }
}));

import CashuDevKit from '../cashu-cdk';
import CashuUtils, { cashuTokenPrefixes } from './CashuUtils';

const mockIsValidToken = CashuDevKit.isValidToken as jest.Mock;
const mockDecodeToken = CashuDevKit.decodeToken as jest.Mock;

// Hardcoded test tokens — no cashu-ts dependency
const cashuAToken =
    'cashuAeyJ0b2tlbiI6IFt7InByb29mcyI6IFtdLCAibWludCI6ICJodHRwczovL21pbnQuZXhhbXBsZS5jb20ifV19';
const cashuBToken =
    'cashuBo2FteBhodHRwczovL21pbnQuZXhhbXBsZS5jb21hdWNzYXRhdIGiYWlIAK0mjU0fWCZhcIGjYWEBYXN4QGFjYzEyNDM1ZTdiODQ4NGMzY2YxODUwMTQ5MjE4YWY5MGY3MTZhNTJiZjRhNWVkMzQ3ZTQ4ZWNjMTNmNzczODhhY1ghAkRTgxmeSF1cvtOymmQr7lh5N1q556Yg4R5IukgkIfPP';

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

        it('rejects tokens without cashuA/cashuB prefix', () => {
            expect(CashuUtils.isValidCashuToken('')).toBe(false);
            expect(CashuUtils.isValidCashuToken('notavalidtoken')).toBe(false);
        });

        it('accepts any token with cashuA/cashuB prefix (prefix check only)', () => {
            expect(CashuUtils.isValidCashuToken('cashuAinvalidpayload')).toBe(
                true
            );
            expect(CashuUtils.isValidCashuToken('cashuBinvalidpayload')).toBe(
                true
            );
        });

        it('rejects null/undefined', () => {
            expect(CashuUtils.isValidCashuToken(null as any)).toBe(false);
            expect(CashuUtils.isValidCashuToken(undefined as any)).toBe(false);
        });
    });

    describe('isValidCashuTokenAsync', () => {
        beforeEach(() => {
            mockIsValidToken.mockReset();
        });

        it('delegates to CDK for deep validation', async () => {
            mockIsValidToken.mockResolvedValue(true);
            expect(await CashuUtils.isValidCashuTokenAsync(cashuAToken)).toBe(
                true
            );
            expect(mockIsValidToken).toHaveBeenCalledWith(cashuAToken);
        });

        it('rejects invalid payload via CDK', async () => {
            mockIsValidToken.mockResolvedValue(false);
            expect(
                await CashuUtils.isValidCashuTokenAsync('cashuAinvalidpayload')
            ).toBe(false);
        });

        it('returns false for empty/null input', async () => {
            expect(await CashuUtils.isValidCashuTokenAsync('')).toBe(false);
            expect(await CashuUtils.isValidCashuTokenAsync(null as any)).toBe(
                false
            );
        });
    });

    describe('decodeCashuTokenAsync', () => {
        beforeEach(() => {
            mockDecodeToken.mockReset();
        });

        it('decodes cashuA token via CDK', async () => {
            mockDecodeToken.mockResolvedValue({
                value: 1,
                mint_url: 'https://mint.example.com',
                encoded: cashuAToken,
                proofs: [
                    {
                        amount: 1,
                        secret: 'abc',
                        c: 'def',
                        keyset_id: '00ad268d4d1f5826'
                    }
                ]
            });
            const decoded = await CashuUtils.decodeCashuTokenAsync(cashuAToken);
            expect(decoded.mint_url).toBe('https://mint.example.com');
            expect(decoded.proofs).toHaveLength(1);
            expect(decoded.proofs[0].amount).toBe(1);
            expect(mockDecodeToken).toHaveBeenCalledWith(cashuAToken);
        });

        it('decodes cashuB token via CDK', async () => {
            mockDecodeToken.mockResolvedValue({
                value: 1,
                mint_url: 'https://mint.example.com',
                encoded: cashuBToken,
                proofs: [
                    {
                        amount: 1,
                        secret: 'abc',
                        c: 'def',
                        keyset_id: '00ad268d4d1f5826'
                    }
                ]
            });
            const decoded = await CashuUtils.decodeCashuTokenAsync(cashuBToken);
            expect(decoded.mint_url).toBe('https://mint.example.com');
            expect(decoded.proofs).toHaveLength(1);
            expect(decoded.proofs[0].amount).toBe(1);
        });

        it('rejects on invalid token', async () => {
            mockDecodeToken.mockRejectedValue(new Error('Invalid token'));
            await expect(
                CashuUtils.decodeCashuTokenAsync('invalidtoken')
            ).rejects.toThrow('Invalid token');
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
