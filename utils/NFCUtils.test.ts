// Explicit jest type reference required: the import chain goes through
// react-native-nfc-manager's ambient module declaration, which causes
// tsserver to lose automatic @types/jest inclusion (tsc is unaffected).
/// <reference types="jest" />

jest.mock('react-native-nfc-manager', () => ({
    __esModule: true,
    default: {
        isEnabled: () => {},
        setEventListener: () => {},
        start: () => {},
        registerTagEvent: () => {},
        unregisterTagEvent: () => {}
    },
    NfcEvents: { DiscoverTag: 'DiscoverTag', SessionClosed: 'SessionClosed' },
    Ndef: { text: { decodePayload: () => {} } }
}));

import { decodeNdefTextPayload } from './NFCUtils';

// NDEF Text Record payload structure:
//   byte 0:   status byte — lower 6 bits = language code length
//   bytes 1–N: language code (e.g. "en" = 2 bytes)
//   remaining: actual text (UTF-8)
const withHeader = (...textBytes: number[]) =>
    new Uint8Array([0x02, 0x65, 0x6e, ...textBytes]); // 0x02 = 2-char lang, "en"

describe('decodeNdefTextPayload', () => {
    it('returns empty string for empty input', () => {
        expect(decodeNdefTextPayload(new Uint8Array([]))).toBe('');
    });

    it('returns empty string when payload contains only the header', () => {
        expect(decodeNdefTextPayload(withHeader())).toBe('');
    });

    it('decodes a plain ASCII payload', () => {
        // "hello" = 0x68 0x65 0x6c 0x6c 0x6f
        expect(
            decodeNdefTextPayload(withHeader(0x68, 0x65, 0x6c, 0x6c, 0x6f))
        ).toBe('hello');
    });

    it('decodes a multi-byte UTF-8 character (ü = 0xC3 0xBC)', () => {
        expect(decodeNdefTextPayload(withHeader(0xc3, 0xbc))).toBe('ü');
    });

    it('returns null for an invalid UTF-8 sequence', () => {
        expect(decodeNdefTextPayload(withHeader(0xff))).toBeNull();
    });

    it('returns null for a truncated multi-byte sequence', () => {
        // 0xC3 starts a 2-byte sequence but has no continuation byte
        expect(decodeNdefTextPayload(withHeader(0xc3))).toBeNull();
    });
});
