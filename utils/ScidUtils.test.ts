import Long from 'long';

import { formatNonZeroScid, formatScid } from './ScidUtils';

describe('ScidUtils', () => {
    describe('formatScid', () => {
        // Expected values match bolt07 1.9.5 chanFormat, which this replaces
        it.each([
            ['0', '0x0x0'],
            ['1', '0x0x1'],
            ['65535', '0x0x65535'],
            ['65536', '0x1x0'],
            ['16777216', '0x256x0'],
            ['1099511627776', '1x0x0'],
            ['17592186044416001', '16000x0x1'],
            ['827759309813104641', '752842x11855086x49153'],
            ['871903430184222721', '792991x9230995x16385'],
            ['18446744073709551615', '16777215x16777215x65535']
        ])('formats %s as %s', (scid, expected) => {
            expect(formatScid(scid)).toBe(expected);
        });

        it('formats a number', () => {
            expect(formatScid(1099511627776)).toBe('1x0x0');
        });

        it('returns undefined for a number above the safe integer range', () => {
            // 871903430184222721 as a number rounds to 871903430184222700
            expect(formatScid(871903430184222721)).toBeUndefined();
        });

        it('formats an unsigned protobuf Long above the safe integer range', () => {
            const scid = Long.fromString('871903430184222721', true);
            expect(formatScid(scid)).toBe('792991x9230995x16385');
        });

        it.each([
            ['an empty string', ''],
            ['a non-numeric string', 'abc'],
            ['a negative number', '-1'],
            ['a decimal', '1.5'],
            ['a value above uint64', '18446744073709551616'],
            ['a number in exponent form', 1e21]
        ])('returns undefined for %s', (_, scid) => {
            expect(formatScid(scid)).toBeUndefined();
        });

        it('returns undefined for null and undefined', () => {
            expect(formatScid(null)).toBeUndefined();
            expect(formatScid(undefined)).toBeUndefined();
        });
    });

    describe('formatNonZeroScid', () => {
        it('formats a non-zero scid', () => {
            expect(formatNonZeroScid('17592186044416001')).toBe('16000x0x1');
            expect(
                formatNonZeroScid(Long.fromString('17592186044416001', true))
            ).toBe('16000x0x1');
        });

        it.each([
            ['a zero string', '0'],
            ['a zero number', 0],
            ['a zero Long', Long.UZERO],
            ['a malformed value', 'abc'],
            ['an empty string', ''],
            ['null', null],
            ['undefined', undefined]
        ])('returns undefined for %s', (_, scid) => {
            expect(formatNonZeroScid(scid)).toBeUndefined();
        });
    });
});
