import BigNumber from 'bignumber.js';
import {
    bigCeil,
    bigFloor,
    calculateReceiveAmount,
    calculateServiceFeeOnSend,
    calculateSendAmount,
    calculateLimit,
    isValidRescueKey
} from './SwapUtils';

describe('SwapUtils', () => {
    describe('bigCeil', () => {
        it('should round up to the nearest integer', () => {
            expect(bigCeil(new BigNumber('1.01')).toString()).toBe('2');
            expect(bigCeil(new BigNumber('3.999')).toString()).toBe('4');
            expect(bigCeil(new BigNumber('5')).toString()).toBe('5');
        });
    });

    describe('bigFloor', () => {
        it('should round down to the nearest integer', () => {
            expect(bigFloor(new BigNumber('1.99')).toString()).toBe('1');
            expect(bigFloor(new BigNumber('3.0001')).toString()).toBe('3');
            expect(bigFloor(new BigNumber('5')).toString()).toBe('5');
        });
    });

    describe('calculateReceiveAmount', () => {
        it('should calculate receive amount correctly in normal mode', () => {
            const result = calculateReceiveAmount(
                new BigNumber('1000'),
                1,
                50,
                false
            );
            expect(result.toString()).toBe('940'); // 1000 - 50 = 950 / 1.01 ≈ 940.59 → floor = 940
        });

        it('should calculate receive amount correctly in reverse mode', () => {
            const result = calculateReceiveAmount(
                new BigNumber('1000'),
                1,
                50,
                true
            );
            expect(result.toString()).toBe('940'); // ceil(1% of 1000) = 10 → 1000 - 10 - 50 = 940
        });
    });

    describe('calculateServiceFeeOnSend', () => {
        it('should return 0 for invalid send amounts', () => {
            expect(
                calculateServiceFeeOnSend(
                    new BigNumber('0'),
                    1,
                    50,
                    false
                ).toString()
            ).toBe('0');
            expect(
                calculateServiceFeeOnSend(
                    new BigNumber('-10'),
                    1,
                    50,
                    true
                ).toString()
            ).toBe('0');
        });

        it('should calculate service fee in reverse mode', () => {
            const result = calculateServiceFeeOnSend(
                new BigNumber('1000'),
                1,
                50,
                true
            );
            expect(result.toString()).toBe('10'); // 1% of 1000 = 10 → ceil = 10
        });

        it('should calculate service fee in non-reverse mode', () => {
            const result = calculateServiceFeeOnSend(
                new BigNumber('1000'),
                1,
                50,
                false
            );
            expect(result.toString()).toBe('10'); // Receive amount ≈ 940, minerFee = 50 → 1000 - 940 - 50 = 10
        });
    });

    describe('calculateSendAmount', () => {
        it('should calculate send amount in reverse mode', () => {
            const result = calculateSendAmount(
                new BigNumber('940'),
                1,
                50,
                true
            );
            expect(result.toString()).toBe('1000'); // (940 + 50) / 0.99 = 1000 → ceil = 1000
        });

        it('should calculate send amount in normal mode', () => {
            const result = calculateSendAmount(
                new BigNumber('940'),
                1,
                50,
                false
            );
            expect(result.toString()).toBe('1000'); // 940 + 9.4 (ceil=10) + 50 = 1000 → ceil = 1000
        });
    });

    describe('calculateLimit', () => {
        it('should return calculated send amount when not in reverse mode', () => {
            const result = calculateLimit(940, 1, 50, false);
            expect(result).toBe(1000);
        });

        it('should return limit as-is when in reverse mode', () => {
            const result = calculateLimit(940, 1, 50, true);
            expect(result).toBe(940);
        });
    });

    describe('isValidRescueKey', () => {
        // BIP39 reference vector (128-bit entropy of all zeroes)
        const validMnemonic =
            'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

        it('should accept a valid 12-word mnemonic', () => {
            expect(isValidRescueKey(validMnemonic)).toBe(true);
            expect(
                isValidRescueKey(
                    'legal winner thank year wave sausage worth useful legal winner thank yellow'
                )
            ).toBe(true);
        });

        it('should tolerate surrounding and irregular whitespace', () => {
            expect(
                isValidRescueKey(`  ${validMnemonic.replace(/ /g, '   ')}  `)
            ).toBe(true);
        });

        it('should reject 12 wordlist words with a bad checksum', () => {
            // all-abandon fails the checksum (valid vector ends in 'about')
            expect(isValidRescueKey('abandon '.repeat(12).trim())).toBe(false);
        });

        it('should reject a single-word typo to another valid word', () => {
            expect(
                isValidRescueKey(validMnemonic.replace(/about$/, 'zoo'))
            ).toBe(false);
        });

        it('should reject a word-order transposition', () => {
            expect(
                isValidRescueKey(
                    'about abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon'
                )
            ).toBe(false);
        });

        it('should reject words outside the BIP39 wordlist', () => {
            expect(
                isValidRescueKey(validMnemonic.replace(/about$/, 'notaword'))
            ).toBe(false);
        });

        it('should reject wrong word counts, including valid 24-word seeds', () => {
            expect(isValidRescueKey('')).toBe(false);
            expect(
                isValidRescueKey(
                    validMnemonic.split(' ').slice(0, 11).join(' ')
                )
            ).toBe(false);
            // valid BIP39 mnemonic, but rescue keys must be exactly 12 words
            expect(
                isValidRescueKey(
                    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art'
                )
            ).toBe(false);
        });
    });
});
