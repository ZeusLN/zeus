import {
    getDecimalLimit,
    validateKeypadInput,
    getAmountFontSize,
    deleteLastCharacter
} from './KeypadUtils';

// Mock stores
const createMockFiatStore = (decimalPlaces?: number) => ({
    symbolLookup: jest
        .fn()
        .mockReturnValue(
            decimalPlaces !== undefined ? { decimalPlaces } : undefined
        )
});

const createMockSettingsStore = (fiat: string = 'USD') => ({
    settings: { fiat }
});

describe('KeypadUtils', () => {
    describe('getDecimalLimit', () => {
        it('returns 3 for sats', () => {
            const fiatStore = createMockFiatStore();
            const settingsStore = createMockSettingsStore();
            expect(
                getDecimalLimit('sats', fiatStore as any, settingsStore as any)
            ).toBe(3);
        });

        it('returns 8 for BTC', () => {
            const fiatStore = createMockFiatStore();
            const settingsStore = createMockSettingsStore();
            expect(
                getDecimalLimit('BTC', fiatStore as any, settingsStore as any)
            ).toBe(8);
        });

        it('returns fiat decimal places from store', () => {
            const fiatStore = createMockFiatStore(2);
            const settingsStore = createMockSettingsStore('USD');
            expect(
                getDecimalLimit('fiat', fiatStore as any, settingsStore as any)
            ).toBe(2);
        });

        it('returns 0 decimal places for currencies like JPY', () => {
            const fiatStore = createMockFiatStore(0);
            const settingsStore = createMockSettingsStore('JPY');
            expect(
                getDecimalLimit('fiat', fiatStore as any, settingsStore as any)
            ).toBe(0);
        });

        it('defaults to 2 decimal places when fiat properties not found', () => {
            const fiatStore = createMockFiatStore(undefined);
            const settingsStore = createMockSettingsStore('UNKNOWN');
            expect(
                getDecimalLimit('fiat', fiatStore as any, settingsStore as any)
            ).toBe(2);
        });

        it('returns null for unknown units', () => {
            const fiatStore = createMockFiatStore();
            const settingsStore = createMockSettingsStore();
            expect(
                getDecimalLimit(
                    'unknown',
                    fiatStore as any,
                    settingsStore as any
                )
            ).toBeNull();
        });
    });

    describe('validateKeypadInput', () => {
        const fiatStore = createMockFiatStore(2);
        const settingsStore = createMockSettingsStore();

        describe('basic input', () => {
            it('accepts valid digit input', () => {
                const result = validateKeypadInput(
                    '0',
                    '5',
                    'sats',
                    fiatStore as any,
                    settingsStore as any
                );
                expect(result).toEqual({ valid: true, newAmount: '5' });
            });

            it('appends digit to existing amount', () => {
                const result = validateKeypadInput(
                    '12',
                    '3',
                    'sats',
                    fiatStore as any,
                    settingsStore as any
                );
                expect(result).toEqual({ valid: true, newAmount: '123' });
            });

            it('accepts decimal point', () => {
                const result = validateKeypadInput(
                    '5',
                    '.',
                    'sats',
                    fiatStore as any,
                    settingsStore as any
                );
                expect(result).toEqual({ valid: true, newAmount: '5.' });
            });

            it('replaces leading zero with digit', () => {
                const result = validateKeypadInput(
                    '0',
                    '7',
                    'sats',
                    fiatStore as any,
                    settingsStore as any
                );
                expect(result).toEqual({ valid: true, newAmount: '7' });
            });

            it('handles decimal point when amount is zero', () => {
                const result = validateKeypadInput(
                    '0',
                    '.',
                    'sats',
                    fiatStore as any,
                    settingsStore as any
                );
                expect(result).toEqual({ valid: true, newAmount: '0.' });
            });
        });

        describe('decimal place limits', () => {
            it('rejects input exceeding sats decimal limit (3)', () => {
                const result = validateKeypadInput(
                    '1.234',
                    '5',
                    'sats',
                    fiatStore as any,
                    settingsStore as any
                );
                expect(result).toEqual({ valid: false, newAmount: '1.234' });
            });

            it('accepts input within sats decimal limit', () => {
                const result = validateKeypadInput(
                    '1.23',
                    '4',
                    'sats',
                    fiatStore as any,
                    settingsStore as any
                );
                expect(result).toEqual({ valid: true, newAmount: '1.234' });
            });

            it('rejects input exceeding BTC decimal limit (8)', () => {
                const result = validateKeypadInput(
                    '1.12345678',
                    '9',
                    'BTC',
                    fiatStore as any,
                    settingsStore as any
                );
                expect(result).toEqual({
                    valid: false,
                    newAmount: '1.12345678'
                });
            });

            it('accepts input within BTC decimal limit', () => {
                const result = validateKeypadInput(
                    '1.1234567',
                    '8',
                    'BTC',
                    fiatStore as any,
                    settingsStore as any
                );
                expect(result).toEqual({
                    valid: true,
                    newAmount: '1.12345678'
                });
            });

            it('rejects input exceeding fiat decimal limit (2)', () => {
                const result = validateKeypadInput(
                    '10.99',
                    '9',
                    'fiat',
                    fiatStore as any,
                    settingsStore as any
                );
                expect(result).toEqual({ valid: false, newAmount: '10.99' });
            });
        });

        describe('decimal point rules', () => {
            it('rejects second decimal point', () => {
                const result = validateKeypadInput(
                    '1.5',
                    '.',
                    'sats',
                    fiatStore as any,
                    settingsStore as any
                );
                expect(result).toEqual({ valid: false, newAmount: '1.5' });
            });

            it('rejects decimal for zero-decimal currencies', () => {
                const jpyFiatStore = createMockFiatStore(0);
                const result = validateKeypadInput(
                    '100',
                    '.',
                    'fiat',
                    jpyFiatStore as any,
                    settingsStore as any
                );
                expect(result).toEqual({ valid: false, newAmount: '100' });
            });
        });

        describe('sats integer limit', () => {
            it('rejects more than 12 integer digits for sats', () => {
                const result = validateKeypadInput(
                    '123456789012',
                    '3',
                    'sats',
                    fiatStore as any,
                    settingsStore as any
                );
                expect(result).toEqual({
                    valid: false,
                    newAmount: '123456789012'
                });
            });

            it('allows decimal point after 12 integer digits for sats', () => {
                const result = validateKeypadInput(
                    '123456789012',
                    '.',
                    'sats',
                    fiatStore as any,
                    settingsStore as any
                );
                expect(result).toEqual({
                    valid: true,
                    newAmount: '123456789012.'
                });
            });

            it('accepts 12th integer digit for sats', () => {
                const result = validateKeypadInput(
                    '12345678901',
                    '2',
                    'sats',
                    fiatStore as any,
                    settingsStore as any
                );
                expect(result).toEqual({
                    valid: true,
                    newAmount: '123456789012'
                });
            });
        });

        describe('BTC integer limit', () => {
            it('rejects more than 8 integer digits for BTC', () => {
                const result = validateKeypadInput(
                    '12345678',
                    '9',
                    'BTC',
                    fiatStore as any,
                    settingsStore as any
                );
                expect(result).toEqual({ valid: false, newAmount: '12345678' });
            });

            it('allows decimal point after 8 integer digits for BTC', () => {
                const result = validateKeypadInput(
                    '12345678',
                    '.',
                    'BTC',
                    fiatStore as any,
                    settingsStore as any
                );
                expect(result).toEqual({ valid: true, newAmount: '12345678.' });
            });

            it('allows digits after decimal with 8 integer digits', () => {
                const result = validateKeypadInput(
                    '12345678.',
                    '1',
                    'BTC',
                    fiatStore as any,
                    settingsStore as any
                );
                expect(result).toEqual({
                    valid: true,
                    newAmount: '12345678.1'
                });
            });
        });

        describe('fiat integer limit', () => {
            it('rejects more than 10 integer digits for fiat', () => {
                const result = validateKeypadInput(
                    '1234567890',
                    '1',
                    'fiat',
                    fiatStore as any,
                    settingsStore as any
                );
                expect(result).toEqual({
                    valid: false,
                    newAmount: '1234567890'
                });
            });

            it('allows decimal point after 10 integer digits for fiat', () => {
                const result = validateKeypadInput(
                    '1234567890',
                    '.',
                    'fiat',
                    fiatStore as any,
                    settingsStore as any
                );
                expect(result).toEqual({
                    valid: true,
                    newAmount: '1234567890.'
                });
            });

            it('allows digits after decimal with 10 integer digits for fiat', () => {
                const result = validateKeypadInput(
                    '1234567890.',
                    '1',
                    'fiat',
                    fiatStore as any,
                    settingsStore as any
                );
                expect(result).toEqual({
                    valid: true,
                    newAmount: '1234567890.1'
                });
            });

            it('accepts 10th integer digit for fiat', () => {
                const result = validateKeypadInput(
                    '123456789',
                    '0',
                    'fiat',
                    fiatStore as any,
                    settingsStore as any
                );
                expect(result).toEqual({
                    valid: true,
                    newAmount: '1234567890'
                });
            });
        });

        describe('capacity limits', () => {
            it('rejects BTC amount exceeding 21 million', () => {
                const result = validateKeypadInput(
                    '21000000',
                    '1',
                    'BTC',
                    fiatStore as any,
                    settingsStore as any
                );
                expect(result).toEqual({ valid: false, newAmount: '21000000' });
            });

            it('accepts BTC amount at exactly 21 million', () => {
                const result = validateKeypadInput(
                    '2100000',
                    '0',
                    'BTC',
                    fiatStore as any,
                    settingsStore as any
                );
                expect(result).toEqual({ valid: true, newAmount: '21000000' });
            });

            it('rejects sats amount exceeding max supply', () => {
                const result = validateKeypadInput(
                    '2100000000000000',
                    '1',
                    'sats',
                    fiatStore as any,
                    settingsStore as any
                );
                expect(result).toEqual({
                    valid: false,
                    newAmount: '2100000000000000'
                });
            });
        });
    });

    describe('getAmountFontSize', () => {
        describe('standard sizing', () => {
            it('returns 80 for short amounts (1-4 chars)', () => {
                expect(getAmountFontSize(1, 0)).toBe(80);
                expect(getAmountFontSize(2, 0)).toBe(80);
                expect(getAmountFontSize(3, 0)).toBe(80);
                expect(getAmountFontSize(4, 0)).toBe(80);
            });

            it('returns progressively smaller sizes for longer amounts', () => {
                expect(getAmountFontSize(5, 0)).toBe(75);
                expect(getAmountFontSize(6, 0)).toBe(65);
                expect(getAmountFontSize(7, 0)).toBe(60);
                expect(getAmountFontSize(8, 0)).toBe(55);
                expect(getAmountFontSize(9, 0)).toBe(50);
                expect(getAmountFontSize(10, 0)).toBe(45);
            });

            it('includes placeholder count in total length', () => {
                expect(getAmountFontSize(3, 2)).toBe(75); // 3 + 2 = 5
                expect(getAmountFontSize(2, 4)).toBe(65); // 2 + 4 = 6
            });
        });

        describe('compact sizing', () => {
            it('returns 80 for short amounts (1-2 chars)', () => {
                expect(getAmountFontSize(1, 0, { compact: true })).toBe(80);
                expect(getAmountFontSize(2, 0, { compact: true })).toBe(80);
            });

            it('returns different sizes than standard mode', () => {
                expect(getAmountFontSize(3, 0, { compact: true })).toBe(65);
                expect(getAmountFontSize(4, 0, { compact: true })).toBe(65);
                expect(getAmountFontSize(5, 0, { compact: true })).toBe(55);
                expect(getAmountFontSize(6, 0, { compact: true })).toBe(55);
                expect(getAmountFontSize(7, 0, { compact: true })).toBe(50);
                expect(getAmountFontSize(8, 0, { compact: true })).toBe(45);
                expect(getAmountFontSize(10, 0, { compact: true })).toBe(35);
            });
        });

        describe('needInbound sizing', () => {
            it('returns larger size when not needing inbound', () => {
                expect(getAmountFontSize(4, 0)).toBe(80);
                expect(getAmountFontSize(4, 0, { needInbound: true })).toBe(70);
            });

            it('returns smaller sizes when needing inbound', () => {
                expect(getAmountFontSize(5, 0)).toBe(75);
                expect(getAmountFontSize(5, 0, { needInbound: true })).toBe(65);

                expect(getAmountFontSize(6, 0)).toBe(65);
                expect(getAmountFontSize(6, 0, { needInbound: true })).toBe(60);

                expect(getAmountFontSize(7, 0)).toBe(60);
                expect(getAmountFontSize(7, 0, { needInbound: true })).toBe(55);

                expect(getAmountFontSize(8, 0)).toBe(55);
                expect(getAmountFontSize(8, 0, { needInbound: true })).toBe(50);

                expect(getAmountFontSize(9, 0)).toBe(50);
                expect(getAmountFontSize(9, 0, { needInbound: true })).toBe(45);

                expect(getAmountFontSize(10, 0)).toBe(45);
                expect(getAmountFontSize(10, 0, { needInbound: true })).toBe(
                    40
                );
            });
        });
    });

    describe('deleteLastCharacter', () => {
        it('returns "0" for single character amount', () => {
            expect(deleteLastCharacter('5')).toBe('0');
            expect(deleteLastCharacter('0')).toBe('0');
        });

        it('removes last character from multi-character amount', () => {
            expect(deleteLastCharacter('123')).toBe('12');
            expect(deleteLastCharacter('10')).toBe('1');
            expect(deleteLastCharacter('1.5')).toBe('1.');
            expect(deleteLastCharacter('1.')).toBe('1');
        });

        it('handles decimal amounts correctly', () => {
            expect(deleteLastCharacter('12.34')).toBe('12.3');
            expect(deleteLastCharacter('0.1')).toBe('0.');
        });
    });
});
