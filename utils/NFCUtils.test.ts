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
    NfcTech: { IsoDep: 'IsoDep' },
    Ndef: { text: { decodePayload: () => {} } }
}));

import { decodeNdefTextPayload, buildNdefTextMessage } from './NFCUtils';

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

describe('buildNdefTextMessage', () => {
    it('builds a valid NDEF text message with NLEN prefix', () => {
        const msg = buildNdefTextMessage('hello');
        // First 2 bytes are NLEN (big-endian length of the NDEF record)
        const nlen = (msg[0] << 8) | msg[1];
        expect(nlen).toBe(msg.length - 2);

        // NDEF record flags: MB=1, ME=1, SR=1, TNF=01 => 0xD1
        expect(msg[2]).toBe(0xd1);
        // Type length = 1
        expect(msg[3]).toBe(0x01);
        // Type = 'T' (Text)
        expect(msg[5]).toBe(0x54);

        // Payload: status byte (lang length=2) + "en" + "hello"
        expect(msg[6]).toBe(0x02); // lang code length
        expect(msg[7]).toBe(0x65); // 'e'
        expect(msg[8]).toBe(0x6e); // 'n'
        // "hello" bytes
        expect(msg[9]).toBe(0x68);
        expect(msg[10]).toBe(0x65);
        expect(msg[11]).toBe(0x6c);
        expect(msg[12]).toBe(0x6c);
        expect(msg[13]).toBe(0x6f);
    });

    it('handles empty text', () => {
        const msg = buildNdefTextMessage('');
        const nlen = (msg[0] << 8) | msg[1];
        expect(nlen).toBeGreaterThan(0);
        // Should still have the NDEF header + lang code
        expect(msg[2]).toBe(0xd1);
    });

    it('handles UTF-8 multi-byte characters', () => {
        const msg = buildNdefTextMessage('ü');
        // ü in UTF-8 is 0xC3 0xBC (2 bytes)
        const nlen = (msg[0] << 8) | msg[1];
        const recordBytes = msg.slice(2, 2 + nlen);
        // payload length should account for lang (3 bytes: status + "en") + 2 bytes for ü
        const payloadLen = recordBytes[2]; // SR payload length byte
        expect(payloadLen).toBe(2 + 2 + 1); // langLen(2) + "en" + status byte... wait
        // Actually: status(1) + lang(2) + text(2) = 5
        expect(payloadLen).toBe(5);
    });

    it('produces a CREQ-sized message correctly', () => {
        const creq = 'creqA' + 'x'.repeat(200);
        const msg = buildNdefTextMessage(creq);
        const nlen = (msg[0] << 8) | msg[1];
        expect(msg.length).toBe(2 + nlen);
    });
});
