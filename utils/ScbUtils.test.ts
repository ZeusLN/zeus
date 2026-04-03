import { scbStringToBytes } from './ScbUtils';
import Base64Utils from './Base64Utils';

describe('ScbUtils', () => {
    describe('scbStringToBytes', () => {
        // "End the Fed" in bytes: [69, 110, 100, 32, 116, 104, 101, 32, 70, 101, 100]
        const expectedBytes = Uint8Array.from([
            69, 110, 100, 32, 116, 104, 101, 32, 70, 101, 100
        ]);
        const base64Input = 'RW5kIHRoZSBGZWQ=';
        const hexInput = '456e642074686520466564';

        it('decodes valid base64 input', () => {
            const result = scbStringToBytes(base64Input);
            expect(result).toEqual(expectedBytes);
        });

        it('decodes valid hex input (even length, all hex chars)', () => {
            const result = scbStringToBytes(hexInput);
            expect(result).toEqual(expectedBytes);
        });

        it('produces same bytes for equivalent base64 and hex inputs', () => {
            const fromBase64 = scbStringToBytes(base64Input);
            const fromHex = scbStringToBytes(hexInput);
            expect(fromBase64).toEqual(fromHex);
        });

        it('trims whitespace before decoding hex', () => {
            const result = scbStringToBytes('  ' + hexInput + '  ');
            expect(result).toEqual(expectedBytes);
        });

        it('trims whitespace before decoding base64', () => {
            const result = scbStringToBytes('  ' + base64Input + '  ');
            expect(result).toEqual(expectedBytes);
        });

        it('falls back to base64 for odd-length hex-like string', () => {
            // "abc" is all hex chars but odd length → base64 decode
            const oddHex = 'abc';
            const result = scbStringToBytes(oddHex);
            expect(result).toEqual(Base64Utils.base64ToBytes(oddHex));
        });

        it('falls back to base64 for strings with non-hex chars', () => {
            // base64 strings often contain +, /, = which are not hex chars
            const result = scbStringToBytes(base64Input);
            expect(result).toEqual(Base64Utils.base64ToBytes(base64Input));
        });

        it('handles a realistic SCB-sized hex string', () => {
            // 64 hex chars = 32 bytes (like a channel point hash)
            const longHex =
                '02825798dbe2eb00eaccd9c1f6bae9b4eacad53fb6d1b784b49fc70ad16de20584';
            const result = scbStringToBytes(longHex);
            expect(result).toEqual(Base64Utils.hexToBytes(longHex));
        });

        it('handles a realistic SCB-sized base64 string', () => {
            const longBase64 = 'AoJXmNvi6wDqzNnB9rrptOrK1T+20beEtJ/HCtFt4gWE';
            const result = scbStringToBytes(longBase64);
            expect(result).toEqual(Base64Utils.base64ToBytes(longBase64));
        });
    });
});
