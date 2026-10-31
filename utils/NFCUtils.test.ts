// Explicit jest type reference required: the import chain goes through
// react-native-nfc-manager's ambient module declaration, which causes
// tsserver to lose automatic @types/jest inclusion (tsc is unaffected).
/// <reference types="jest" />

jest.mock('react-native-nfc-manager', () => ({
    __esModule: true,
    default: {
        isEnabled: jest.fn(async () => true),
        setEventListener: jest.fn(),
        start: jest.fn(async () => {}),
        registerTagEvent: jest.fn(),
        unregisterTagEvent: jest.fn(async () => {})
    },
    NfcEvents: { DiscoverTag: 'DiscoverTag', SessionClosed: 'SessionClosed' },
    // the record helpers are plain JS, so tags are built and read with the
    // real ones
    Ndef: jest.requireActual('react-native-nfc-manager/ndef-lib')
}));

import NfcManager, { Ndef, NdefRecord } from 'react-native-nfc-manager';
import ModalStore from '../stores/ModalStore';
import {
    decodeNdefRecord,
    decodeNdefTextPayload,
    decodeNdefUriPayload,
    isNfcWithdraw,
    pickNfcRecord,
    scanNfcTag
} from './NFCUtils';

const bytes = (text: string) => Array.from(Buffer.from(text, 'utf-8'));

// Android hands the record type over as bytes, not as a string
const record = (
    tnf: NdefRecord['tnf'],
    type: string,
    payload: number[]
): NdefRecord => ({ tnf, type: bytes(type), payload });

// typed as returning a record, but they return the payload bytes
const uriPayload = (uri: string) =>
    Ndef.uri.encodePayload(uri) as unknown as number[];
const textPayload = (text: string) =>
    Ndef.text.encodePayload(text) as unknown as number[];

const uriRecord = (uri: string) =>
    record(Ndef.TNF_WELL_KNOWN, 'U', uriPayload(uri));
const textRecord = (text: string) =>
    record(Ndef.TNF_WELL_KNOWN, 'T', textPayload(text));
const mimeRecord = (type: string, text: string) =>
    record(Ndef.TNF_MIME_MEDIA, type, bytes(text));

const TOKEN = 'cashuBo2FteCJodHRwczovL21pbnQuZXhhbXBsZS5jb20';

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

describe('isNfcWithdraw', () => {
    it.each(['Receive', 'ChoosePaymentMethod'])(
        'accepts a withdraw request routed to %s',
        (route) => {
            expect(isNfcWithdraw(route, { tag: 'withdrawRequest' })).toBe(true);
        }
    );

    it.each([
        ['an LNURL-pay request', 'LnurlPay', { tag: 'payRequest' }],
        // the Lightning address server picks the tag
        [
            'a Lightning address answering withdrawRequest',
            'LnurlPay',
            { tag: 'withdrawRequest' }
        ],
        ['an LNURL-channel request', 'LnurlChannel', { tag: 'channelRequest' }],
        ['an LNURL-auth request', 'LnurlAuth', { tag: 'login' }],
        ['a Receive result with another tag', 'Receive', { tag: 'payRequest' }],
        ['a result without lnurlParams', 'Send', undefined],
        ['a Receive result without lnurlParams', 'Receive', undefined]
    ])('rejects %s', (_, route, lnurlParams) => {
        expect(isNfcWithdraw(route, lnurlParams)).toBe(false);
    });
});

describe('decodeNdefUriPayload', () => {
    it('reads a URI written out in full', () => {
        const payload = uriPayload(`cashu://${TOKEN}`);
        expect(payload[0]).toBe(0x00);
        expect(decodeNdefUriPayload(new Uint8Array(payload))).toBe(
            `cashu://${TOKEN}`
        );
    });

    it.each([
        ['https://', 0x04, 'https://card.example.com/lnurlw?p=1'],
        ['https://www.', 0x02, 'https://www.example.com/']
    ])('expands the abbreviated %s prefix', (_, code: number, uri: string) => {
        const payload = uriPayload(uri);
        expect(payload[0]).toBe(code);
        expect(decodeNdefUriPayload(new Uint8Array(payload))).toBe(uri);
    });

    it('returns null for an empty payload or invalid UTF-8', () => {
        expect(decodeNdefUriPayload(new Uint8Array([]))).toBeNull();
        expect(decodeNdefUriPayload(new Uint8Array([0x00, 0xff]))).toBeNull();
    });
});

describe('decodeNdefRecord', () => {
    it('reads Text and URI records by their type', () => {
        expect(decodeNdefRecord(textRecord(TOKEN))).toBe(TOKEN);
        expect(
            decodeNdefRecord(uriRecord('https://card.example.com/lnurlw'))
        ).toBe('https://card.example.com/lnurlw');
    });

    it('reads a record whose type is a string', () => {
        expect(decodeNdefRecord(Ndef.uriRecord('lightning:lnbc1x'))).toBe(
            'lightning:lnbc1x'
        );
    });

    it('reads an absolute URI record from its type', () => {
        expect(
            decodeNdefRecord(
                record(Ndef.TNF_ABSOLUTE_URI, 'lnurlw://card.example/w', [])
            )
        ).toBe('lnurlw://card.example/w');
    });

    it('reads a text/plain MIME record whole', () => {
        expect(decodeNdefRecord(mimeRecord('text/plain', TOKEN))).toBe(TOKEN);
    });

    it.each([
        ['with a label', 'Wallet 1;https://w.example.org/w?id=1'],
        ['without a label', 'https://w.example.org/w?id=1']
    ])('reads a CDF record %s', (_, text) => {
        expect(decodeNdefRecord(mimeRecord('cdf/lnw', text))).toBe(
            'https://w.example.org/w?id=1'
        );
    });

    it.each([
        ['an Android application record', Ndef.androidApplicationRecord('x')],
        ['another MIME type', mimeRecord('image/png', 'png')],
        ['a smart poster', record(Ndef.TNF_WELL_KNOWN, 'Sp', [0x00])],
        ['an empty record', record(Ndef.TNF_EMPTY, '', [])]
    ])('returns null for %s', (_, ndefRecord) => {
        expect(decodeNdefRecord(ndefRecord)).toBeNull();
    });
});

describe('pickNfcRecord', () => {
    const SITE = 'https://bitcoin.example.org/get-a-wallet';

    it.each([
        ['an ecash token URI', `cashu://${TOKEN}`],
        ['a bare ecash token', TOKEN],
        [
            'an ecash token behind a web address',
            `https://zeusln.com/e/${TOKEN}`
        ],
        ['an LNURL-withdraw URI', 'lnurlw://card.example.com/ln?p=1&c=2'],
        ['an LNURL web address', 'https://card.example.com/lnurlw/abc'],
        ['a bech32 LNURL', 'LNURL1DP68GURN8GHJ7'],
        ['a BIP21 URI', 'bitcoin:bc1qexample?lightning=lnbc1x'],
        ['a BOLT 11 invoice', 'lnbc10u1pexample']
    ])('skips a web page in front of %s', (_, data) => {
        expect(pickNfcRecord([SITE, data])).toBe(data);
    });

    it('takes the first of several wallet records', () => {
        expect(pickNfcRecord(['lightning:lnbc1a', `cashu://${TOKEN}`])).toBe(
            'lightning:lnbc1a'
        );
    });

    it('falls back to the first record with text', () => {
        expect(pickNfcRecord([null, '  ', SITE, 'hello'])).toBe(SITE);
        // e.g. a node URI for OpenChannel, which matches no wallet scheme
        expect(pickNfcRecord(['02abc@node.example:9735'])).toBe(
            '02abc@node.example:9735'
        );
    });

    it('returns undefined when no record has text', () => {
        expect(pickNfcRecord([])).toBeUndefined();
        expect(pickNfcRecord([null, ''])).toBeUndefined();
    });
});

describe('scanNfcTag', () => {
    const modalStore = {
        toggleAndroidNfcModal: jest.fn()
    } as unknown as ModalStore;

    const tap = async (ndefMessage: NdefRecord[] | undefined) => {
        const scan = scanNfcTag(modalStore);
        await new Promise(process.nextTick);
        const onTag = (
            NfcManager.setEventListener as jest.Mock
        ).mock.calls.find(
            ([event, listener]) => event === 'DiscoverTag' && listener
        )[1];
        onTag({ ndefMessage });
        return scan;
    };

    beforeEach(() => jest.clearAllMocks());

    it('reads an ecash token stored after a web page', async () => {
        await expect(
            tap([
                uriRecord('https://bitcoin.example.org/'),
                uriRecord(`cashu://${TOKEN}`)
            ])
        ).resolves.toBe(`cashu://${TOKEN}`);
    });

    it('reads an LNURL-withdraw https URI record with the abbreviated prefix', async () => {
        await expect(
            tap([uriRecord('https://card.example.com/lnurlw?p=1')])
        ).resolves.toBe('https://card.example.com/lnurlw?p=1');
    });

    it('resolves undefined for a tag without NDEF records', async () => {
        await expect(tap(undefined)).resolves.toBeUndefined();
        expect(NfcManager.unregisterTagEvent).toHaveBeenCalled();
    });
});
