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
        unregisterTagEvent: jest.fn(async () => {}),
        requestTechnology: jest.fn(),
        cancelTechnologyRequest: jest.fn(),
        getTag: jest.fn(),
        isoDepHandler: { transceive: jest.fn() },
        ndefHandler: { getNdefMessage: jest.fn() }
    },
    NfcAdapter: {
        FLAG_READER_NFC_A: 0x1,
        FLAG_READER_NFC_B: 0x2,
        FLAG_READER_NFC_F: 0x4,
        FLAG_READER_NFC_V: 0x8
    },
    NfcEvents: { DiscoverTag: 'DiscoverTag', SessionClosed: 'SessionClosed' },
    NfcTech: { IsoDep: 'IsoDep', Ndef: 'Ndef' },
    // the record helpers are plain JS, so tags are built and read with the
    // real ones
    Ndef: jest.requireActual('react-native-nfc-manager/ndef-lib')
}));

// LocaleUtils transitively loads Stores → backends → react-native-blob-util,
// which fails in the Jest environment. Stub it.
jest.mock('./LocaleUtils', () => ({
    localeString: (s: string) => s
}));

jest.mock('../cashu-cdk', () => ({
    __esModule: true,
    default: { decodePaymentRequest: jest.fn() }
}));

import { Platform } from 'react-native';
import { observable } from 'mobx';
import NfcManager, { Ndef, NdefRecord } from 'react-native-nfc-manager';
import CashuDevKit from '../cashu-cdk';
import ModalStore from '../stores/ModalStore';
import {
    buildNdefTextMessage,
    decodeNdefRecord,
    decodeNdefTextPayload,
    decodeNdefUriPayload,
    extractTagCREQ,
    extractTagInvoice,
    isNfcWithdraw,
    NfcRequestKind,
    parseCapabilityContainer,
    payViaNfcTap,
    pickNfcRecord,
    scanNfcTag
} from './NFCUtils';
import type { NfcTapOptions } from './NFCUtils';
import { isTagRedelivery } from './NfcRedeliveryUtils';

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
        ['an Android application record', Ndef.androidApplicationRecord('x')],
        ['another MIME type', mimeRecord('image/png', 'png')],
        ['a CDF record', mimeRecord('cdf/lnw', 'https://w.example.org/w')],
        ['a smart poster', record(Ndef.TNF_WELL_KNOWN, 'Sp', [0x00])],
        ['an empty record', record(Ndef.TNF_EMPTY, '', [])]
    ])('returns null for %s', (_, ndefRecord) => {
        expect(decodeNdefRecord(ndefRecord)).toBeNull();
    });
});

describe('pickNfcRecord', () => {
    const SITE = 'https://bitcoin.example.org/get-a-wallet';
    const site = uriRecord(SITE);

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
        expect(pickNfcRecord([site, textRecord(data)])).toBe(data);
    });

    it.each([
        ['"cashub" in another case', 'https://shop.example.org/cashubox'],
        [
            '"cashuA" without a token body',
            'https://example.org/?ref=cashuAfrica'
        ],
        ['a token behind an http address', `http://zeusln.com/e/${TOKEN}`]
    ])('does not take a web page holding %s for an ecash token', (_, page) => {
        expect(
            pickNfcRecord([uriRecord(page), textRecord('lightning:lnbc1a')])
        ).toBe('lightning:lnbc1a');
    });

    it('ignores CDF records', () => {
        expect(
            pickNfcRecord([
                site,
                mimeRecord('cdf/lnw', 'Card;https://card.example.org/w?id=1')
            ])
        ).toBe(SITE);
    });

    it('takes the first of several wallet records', () => {
        expect(
            pickNfcRecord([
                textRecord('lightning:lnbc1a'),
                uriRecord(`cashu://${TOKEN}`)
            ])
        ).toBe('lightning:lnbc1a');
    });

    describe('with a preferred request', () => {
        it('takes an lnurlp: or lnurlw: URI of that kind', () => {
            const uris = [
                uriRecord('lnurlw://card.example.com/w'),
                uriRecord('LNURLP://card.example.com/p')
            ];
            expect(pickNfcRecord(uris, 'pay')).toBe(
                'LNURLP://card.example.com/p'
            );
            expect(pickNfcRecord(uris, 'withdraw')).toBe(
                'lnurlw://card.example.com/w'
            );
        });

        it('falls back to the first wallet record without one', () => {
            expect(
                pickNfcRecord(
                    [site, textRecord('lnbc10u1pexample')],
                    'withdraw'
                )
            ).toBe('lnbc10u1pexample');
        });
    });

    it('falls back to the first record with text', () => {
        expect(
            pickNfcRecord([
                Ndef.androidApplicationRecord('x'),
                textRecord('  '),
                site,
                textRecord('hello')
            ])
        ).toBe(SITE);
        // e.g. a node URI for OpenChannel, which matches no wallet scheme
        expect(pickNfcRecord([textRecord('02abc@node.example:9735')])).toBe(
            '02abc@node.example:9735'
        );
    });

    it('returns undefined when no record has text', () => {
        expect(pickNfcRecord([])).toBeUndefined();
        expect(
            pickNfcRecord([record(Ndef.TNF_EMPTY, '', []), textRecord('')])
        ).toBeUndefined();
    });
});

describe('scanNfcTag', () => {
    const modalStore = {
        toggleAndroidNfcModal: jest.fn()
    } as unknown as ModalStore;

    const tap = async (
        ndefMessage: NdefRecord[] | undefined,
        prefer?: NfcRequestKind
    ) => {
        const scan = scanNfcTag(modalStore, prefer);
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

    it('reads the withdraw record of a card that can also be paid', async () => {
        await expect(
            tap(
                [
                    uriRecord('https://bitcoin.example.org/'),
                    uriRecord('lnurlp://card.example.com/p'),
                    uriRecord('lnurlw://card.example.com/w')
                ],
                'withdraw'
            )
        ).resolves.toBe('lnurlw://card.example.com/w');
    });

    it('resolves undefined for a tag without NDEF records', async () => {
        await expect(tap(undefined)).resolves.toBeUndefined();
        expect(NfcManager.unregisterTagEvent).toHaveBeenCalled();
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
        // status(1) + "en"(2) + ü(2)
        expect(payloadLen).toBe(5);
    });

    it('produces a CREQ-sized message correctly', () => {
        const creq = 'creqA' + 'x'.repeat(200);
        const msg = buildNdefTextMessage(creq);
        const nlen = (msg[0] << 8) | msg[1];
        expect(msg.length).toBe(2 + nlen);
    });
});

describe('buildNdefTextMessage long records', () => {
    it('switches to a 4-byte payload length at 256 payload bytes', () => {
        const msg = buildNdefTextMessage('x'.repeat(253));
        // MB|ME|TNF=01 without SR
        expect(msg[2]).toBe(0xc1);
        expect(msg.slice(4, 8)).toEqual([0x00, 0x00, 0x01, 0x00]);
        expect(Ndef.decodeMessage(msg.slice(2))[0].payload).toHaveLength(256);
    });
});

describe('parseCapabilityContainer', () => {
    // react-native-hce's CC: MLe 0x0100, MLc 0x00FF, file E104, 32 KB
    const HCE_CC = [
        0x00, 0x0f, 0x20, 0x01, 0x00, 0x00, 0xff, 0x04, 0x06, 0xe1, 0x04, 0x7f,
        0xff, 0x00, 0x00
    ];

    it('reads limits, file id and write access', () => {
        expect(parseCapabilityContainer(HCE_CC)).toEqual({
            maxRead: 255,
            maxWrite: 255,
            ndefFileId: [0xe1, 0x04],
            maxNdefSize: 0x7fff,
            writable: true
        });
    });

    it('reports read-only tags', () => {
        const cc = [...HCE_CC];
        cc[14] = 0xff;
        expect(parseCapabilityContainer(cc).writable).toBe(false);
    });

    it('rejects a CC without the NDEF file control TLV', () => {
        expect(() => parseCapabilityContainer(HCE_CC.slice(0, 7))).toThrow();
    });
});

describe('extractTagCREQ', () => {
    it('takes a bare CREQ', () => {
        expect(extractTagCREQ('creqAoWFhZA')).toBe('creqAoWFhZA');
    });

    it("takes the CREQ parameter of Numo's uppercase BIP-321 URI", () => {
        expect(
            extractTagCREQ('BITCOIN:?LIGHTNING=LNBC210N1XYZ&CREQ=CREQB1QYQQSE')
        ).toBe('CREQB1QYQQSE');
    });

    it('takes a CREQ that is the first parameter', () => {
        expect(
            extractTagCREQ('bitcoin:?creq=creqAoWFhZA&lightning=lnbc1')
        ).toBe('creqAoWFhZA');
    });

    it('ignores tags without a CREQ', () => {
        expect(extractTagCREQ('lnurlw://example.com/w')).toBeUndefined();
        expect(extractTagCREQ('bitcoin:bc1qxyz?amount=1')).toBeUndefined();
        expect(extractTagCREQ('bitcoin:?creq=notacreq')).toBeUndefined();
    });
});

describe('extractTagInvoice', () => {
    it("takes the lightning parameter of Numo's uppercase BIP-321 URI", () => {
        expect(
            extractTagInvoice(
                'BITCOIN:?LIGHTNING=LNBC210N1XYZ&CREQ=CREQB1QYQQSE'
            )
        ).toBe('LNBC210N1XYZ');
    });

    it('takes a lightning parameter after other parameters', () => {
        expect(
            extractTagInvoice('bitcoin:bc1qxyz?amount=1&lightning=lnbc1')
        ).toBe('lnbc1');
    });

    it('ignores tags without one', () => {
        expect(extractTagInvoice('creqAoWFhZA')).toBeUndefined();
        expect(extractTagInvoice('lightning:lnbc1')).toBeUndefined();
        expect(extractTagInvoice('bitcoin:?creq=creqAoWFhZA')).toBeUndefined();
    });
});

describe('payViaNfcTap', () => {
    const nfc = NfcManager as any;
    const decodePaymentRequest = CashuDevKit.decodePaymentRequest as jest.Mock;
    const OK = [0x90, 0x00];
    const ERROR = [0x6a, 0x82];
    const TOKEN = 'cashuB' + 'o'.repeat(400);

    /**
     * An NFC Forum Type 4 tag that handles APDUs the way react-native-hce
     * does, recording NLEN after every write
     */
    const fakeType4Tag = (
        content: string,
        { writable = true, failWrites = false } = {}
    ) => {
        const ndefFile = new Array(0x7fff).fill(0);
        buildNdefTextMessage(content).forEach((b, i) => (ndefFile[i] = b));
        const cc = [
            0x00,
            0x0f,
            0x20,
            0x01,
            0x00,
            0x00,
            0xff,
            0x04,
            0x06,
            0xe1,
            0x04,
            0x7f,
            0xff,
            0x00,
            writable ? 0x00 : 0xff
        ];
        let selected: 'cc' | 'ndef' | undefined;
        const nlenAfterWrites: number[] = [];

        nfc.isoDepHandler.transceive.mockImplementation(
            async (apdu: number[]) => {
                const offset = (apdu[2] << 8) | apdu[3];
                if (apdu[1] === 0xa4 && apdu[2] === 0x04) return OK;
                if (apdu[1] === 0xa4) {
                    const id = (apdu[5] << 8) | apdu[6];
                    selected =
                        id === 0xe103
                            ? 'cc'
                            : id === 0xe104
                            ? 'ndef'
                            : undefined;
                    return selected ? OK : ERROR;
                }
                if (apdu[1] === 0xb0) {
                    const file = selected === 'cc' ? cc : ndefFile;
                    return [...file.slice(offset, offset + apdu[4]), ...OK];
                }
                if (apdu[1] === 0xd6) {
                    if (selected !== 'ndef' || !writable || failWrites)
                        return ERROR;
                    apdu.slice(5, 5 + apdu[4]).forEach(
                        (b, i) => (ndefFile[offset + i] = b)
                    );
                    nlenAfterWrites.push((ndefFile[0] << 8) | ndefFile[1]);
                    return OK;
                }
                return ERROR;
            }
        );

        const records = () => {
            const nlen = (ndefFile[0] << 8) | ndefFile[1];
            return Ndef.decodeMessage(ndefFile.slice(2, 2 + nlen));
        };
        const writtenText = () =>
            decodeNdefTextPayload(new Uint8Array(records()[0].payload));

        return { nlenAfterWrites, records, writtenText };
    };

    const makeModalStore = () =>
        observable({
            showAndroidNfcModal: false,
            toggleAndroidNfcModal(status: boolean) {
                this.showAndroidNfcModal = status;
            }
        });

    const makeCashuStore = (overrides: any = {}) => ({
        mintUrls: ['https://mint.example.com'],
        mintBalances: { 'https://mint.example.com': 1000 },
        selectedMintUrl: 'https://mint.example.com',
        sendTokenForRequest: jest.fn(async () => ({ token: TOKEN })),
        ...overrides
    });

    const pay = (
        cashuStore: any,
        modalStore: any = makeModalStore(),
        options?: NfcTapOptions
    ) => payViaNfcTap(modalStore, cashuStore, options);

    const originalOS = Platform.OS;

    beforeEach(() => {
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        nfc.isEnabled.mockResolvedValue(true);
        nfc.start.mockResolvedValue(undefined);
        nfc.unregisterTagEvent.mockResolvedValue(undefined);
        nfc.cancelTechnologyRequest.mockResolvedValue(undefined);
        nfc.requestTechnology.mockResolvedValue('IsoDep');
        nfc.getTag.mockResolvedValue({});
        nfc.ndefHandler.getNdefMessage.mockResolvedValue(null);
        decodePaymentRequest.mockResolvedValue({
            amount: 21,
            unit: 'sat',
            mints: [],
            transports: []
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
        (console.warn as jest.Mock).mockRestore();
        Platform.OS = originalOS;
    });

    describe('on Android', () => {
        beforeEach(() => {
            Platform.OS = 'android';
        });

        const NUMO_TAG = 'BITCOIN:?LIGHTNING=LNBC210N1XYZ&CREQ=CREQB1QYQQSE';

        // Android reads the NDEF message during discovery
        const cacheNdef = (text: string) =>
            nfc.getTag.mockResolvedValue({
                ndefMessage: Ndef.decodeMessage(
                    buildNdefTextMessage(text).slice(2)
                )
            });

        it("pays Numo's NUT-26 request and writes the token back", async () => {
            const tag = fakeType4Tag(NUMO_TAG);
            cacheNdef(NUMO_TAG);
            const cashuStore = makeCashuStore();

            const result = await pay(cashuStore);

            expect(result).toEqual({ status: 'paid', amount: 21 });
            expect(decodePaymentRequest).toHaveBeenCalledWith('CREQB1QYQQSE');
            expect(cashuStore.sendTokenForRequest).toHaveBeenCalledWith(
                'https://mint.example.com',
                21,
                undefined
            );
            expect(tag.writtenText()).toBe(TOKEN);
        });

        it('uses reader mode so the tag is not also dispatched as an intent', async () => {
            fakeType4Tag(NUMO_TAG);
            cacheNdef(NUMO_TAG);

            await pay(makeCashuStore());

            expect(nfc.unregisterTagEvent).toHaveBeenCalled();
            expect(nfc.requestTechnology).toHaveBeenCalledWith(
                ['IsoDep', 'Ndef'],
                expect.objectContaining({
                    isReaderModeEnabled: true,
                    readerModeFlags: 0xf
                })
            );
        });

        it('keeps NLEN at 0 until the whole token is written', async () => {
            const tag = fakeType4Tag(NUMO_TAG);
            cacheNdef(NUMO_TAG);

            await pay(makeCashuStore());

            const full = buildNdefTextMessage(TOKEN).length - 2;
            // clear, two chunks for a ~410 byte message, then NLEN
            expect(tag.nlenAfterWrites).toEqual([0, 0, 0, full]);
        });

        it('hands any other tag content back for the regular handlers', async () => {
            fakeType4Tag('lnurlw://example.com/withdraw');
            cacheNdef('lnurlw://example.com/withdraw');
            const cashuStore = makeCashuStore();

            await expect(pay(cashuStore)).resolves.toEqual({
                status: 'read',
                text: 'lnurlw://example.com/withdraw'
            });
            expect(decodePaymentRequest).not.toHaveBeenCalled();
            expect(cashuStore.sendTokenForRequest).not.toHaveBeenCalled();
        });

        it('finds a request stored after a web page', async () => {
            fakeType4Tag(NUMO_TAG);
            nfc.getTag.mockResolvedValue({
                ndefMessage: [
                    uriRecord('https://numo.example.org/'),
                    textRecord(NUMO_TAG)
                ]
            });

            await expect(pay(makeCashuStore())).resolves.toEqual({
                status: 'paid',
                amount: 21
            });
        });

        it.each([
            [
                'the pay record of a card that can also be withdrawn from',
                [
                    uriRecord('https://bitcoin.example.org/'),
                    uriRecord('lnurlw://w.example.org/w?id=1'),
                    uriRecord('lnurlp://w.example.org/p?id=1')
                ],
                'lnurlp://w.example.org/p?id=1'
            ],
            [
                'a URI record with the abbreviated https:// prefix',
                [uriRecord('https://card.example.com/lnurlp/abc')],
                'https://card.example.com/lnurlp/abc'
            ]
        ])('hands back %s', async (_, ndefMessage, text) => {
            fakeType4Tag('');
            nfc.getTag.mockResolvedValue({ ndefMessage });

            await expect(pay(makeCashuStore())).resolves.toEqual({
                status: 'read',
                text
            });
        });

        it('reads an NDEF-only tag without IsoDep', async () => {
            nfc.requestTechnology.mockResolvedValue('Ndef');
            cacheNdef('lnurlw://example.com/withdraw');

            await expect(pay(makeCashuStore())).resolves.toEqual({
                status: 'read',
                text: 'lnurlw://example.com/withdraw'
            });
            expect(nfc.isoDepHandler.transceive).not.toHaveBeenCalled();
        });

        it.each([
            ['msat', 'views.Cashu.CREQPayment.unsupportedUnit'],
            ['usd', 'views.Cashu.CREQPayment.unsupportedUnit']
        ])(
            'refuses a bare request in %s without creating a token',
            async (unit, error) => {
                fakeType4Tag('creqAoWFhZA');
                cacheNdef('creqAoWFhZA');
                decodePaymentRequest.mockResolvedValue({
                    amount: 21000,
                    unit,
                    mints: [],
                    transports: []
                });
                const cashuStore = makeCashuStore();

                await expect(pay(cashuStore)).resolves.toEqual({
                    status: 'failed',
                    error
                });
                expect(cashuStore.sendTokenForRequest).not.toHaveBeenCalled();
            }
        );

        it('offers the URI to the regular handlers when its CREQ cannot be paid', async () => {
            fakeType4Tag(NUMO_TAG);
            cacheNdef(NUMO_TAG);
            const cashuStore = makeCashuStore({ mintBalances: {} });

            await expect(pay(cashuStore)).resolves.toEqual({
                status: 'read',
                text: NUMO_TAG
            });
            expect(cashuStore.sendTokenForRequest).not.toHaveBeenCalled();
        });

        it('only pays from a mint the request lists', async () => {
            fakeType4Tag('creqAoWFhZA');
            cacheNdef('creqAoWFhZA');
            decodePaymentRequest.mockResolvedValue({
                amount: 21,
                unit: 'sat',
                mints: ['https://other.example.com'],
                transports: []
            });
            const cashuStore = makeCashuStore();

            await expect(pay(cashuStore)).resolves.toEqual({
                status: 'failed',
                error: 'views.Cashu.CREQPayment.noCompatibleMint'
            });
            expect(cashuStore.sendTokenForRequest).not.toHaveBeenCalled();
        });

        it('does not create a token for a read-only tag', async () => {
            fakeType4Tag('creqAoWFhZA', { writable: false });
            cacheNdef('creqAoWFhZA');
            const cashuStore = makeCashuStore();

            await expect(pay(cashuStore)).resolves.toEqual({
                status: 'failed',
                error: 'utils.NFCUtils.tagNotWritable'
            });
            expect(cashuStore.sendTokenForRequest).not.toHaveBeenCalled();
        });

        it('reports a saved token when the write-back fails', async () => {
            fakeType4Tag('creqAoWFhZA', { failWrites: true });
            cacheNdef('creqAoWFhZA');
            const cashuStore = makeCashuStore();

            await expect(pay(cashuStore)).resolves.toEqual({
                status: 'failed',
                error: 'utils.NFCUtils.tokenNotDelivered',
                tokenSaved: true
            });
            expect(cashuStore.sendTokenForRequest).toHaveBeenCalled();
        });

        it('passes on token creation errors', async () => {
            fakeType4Tag('creqAoWFhZA');
            cacheNdef('creqAoWFhZA');
            const cashuStore = makeCashuStore({
                sendTokenForRequest: jest.fn(async () => {
                    throw new Error('Insufficient funds');
                })
            });

            await expect(pay(cashuStore)).resolves.toEqual({
                status: 'failed',
                error: 'Insufficient funds'
            });
        });

        describe('tap-to-pay limit', () => {
            it('pays a request at the limit', async () => {
                fakeType4Tag(NUMO_TAG);
                cacheNdef(NUMO_TAG);

                await expect(
                    pay(makeCashuStore(), undefined, { limit: 21 })
                ).resolves.toEqual({ status: 'paid', amount: 21 });
            });

            it('asks for confirmation above the limit without creating a token', async () => {
                const tag = fakeType4Tag(NUMO_TAG);
                cacheNdef(NUMO_TAG);
                const cashuStore = makeCashuStore();

                await expect(
                    pay(cashuStore, undefined, { limit: 20 })
                ).resolves.toEqual({
                    status: 'confirm',
                    creqParams: expect.objectContaining({
                        amount: 21,
                        unit: 'sat'
                    }),
                    creqString: 'CREQB1QYQQSE',
                    invoice: 'LNBC210N1XYZ'
                });
                expect(cashuStore.sendTokenForRequest).not.toHaveBeenCalled();
                expect(tag.nlenAfterWrites).toEqual([]);
            });

            it('confirms every payment with a limit of 0', async () => {
                fakeType4Tag('creqAoWFhZA');
                cacheNdef('creqAoWFhZA');

                await expect(
                    pay(makeCashuStore(), undefined, { limit: 0 })
                ).resolves.toMatchObject({ status: 'confirm' });
            });

            it('routes an unpayable request before applying the limit', async () => {
                fakeType4Tag(NUMO_TAG);
                cacheNdef(NUMO_TAG);

                await expect(
                    pay(makeCashuStore({ mintBalances: {} }), undefined, {
                        limit: 0
                    })
                ).resolves.toEqual({ status: 'read', text: NUMO_TAG });
            });
        });

        describe('with a confirmed request', () => {
            const confirmed = { amount: 21, unit: 'sat', mints: [] };

            it('pays the same request, ignoring the limit', async () => {
                const tag = fakeType4Tag(NUMO_TAG);
                cacheNdef(NUMO_TAG);

                await expect(
                    pay(makeCashuStore(), undefined, {
                        expected: confirmed,
                        limit: 0
                    })
                ).resolves.toEqual({ status: 'paid', amount: 21 });
                expect(tag.writtenText()).toBe(TOKEN);
            });

            it('refuses a tag that holds another request', async () => {
                const tag = fakeType4Tag(NUMO_TAG);
                cacheNdef(NUMO_TAG);
                const cashuStore = makeCashuStore();

                await expect(
                    pay(cashuStore, undefined, {
                        expected: { ...confirmed, amount: 2100 }
                    })
                ).resolves.toEqual({
                    status: 'failed',
                    error: 'utils.NFCUtils.requestChanged'
                });
                expect(cashuStore.sendTokenForRequest).not.toHaveBeenCalled();
                expect(tag.nlenAfterWrites).toEqual([]);
            });

            describe('from a QR code with a Lightning invoice', () => {
                // Numo's QR request has another id than its NFC request
                beforeEach(() =>
                    decodePaymentRequest.mockResolvedValue({
                        id: 'nfc-id',
                        amount: 21,
                        unit: 'sat',
                        mints: [],
                        transports: []
                    })
                );
                const fromQr = { ...confirmed, id: 'qr-id' };

                it('pays the tag with the same invoice', async () => {
                    const tag = fakeType4Tag(NUMO_TAG);
                    cacheNdef(NUMO_TAG);

                    await expect(
                        pay(makeCashuStore(), undefined, {
                            expected: fromQr,
                            expectedInvoice: 'lnbc210n1xyz'
                        })
                    ).resolves.toEqual({ status: 'paid', amount: 21 });
                    expect(tag.writtenText()).toBe(TOKEN);
                });

                it('refuses a tag with another invoice', async () => {
                    const tag = fakeType4Tag(NUMO_TAG);
                    cacheNdef(NUMO_TAG);
                    const cashuStore = makeCashuStore();

                    await expect(
                        pay(cashuStore, undefined, {
                            expected: fromQr,
                            expectedInvoice: 'lnbc210n1abc'
                        })
                    ).resolves.toEqual({
                        status: 'failed',
                        error: 'utils.NFCUtils.requestChanged'
                    });
                    expect(
                        cashuStore.sendTokenForRequest
                    ).not.toHaveBeenCalled();
                    expect(tag.nlenAfterWrites).toEqual([]);
                });

                it('compares ids for a bare request on the tag', async () => {
                    fakeType4Tag('creqAoWFhZA');
                    cacheNdef('creqAoWFhZA');

                    await expect(
                        pay(makeCashuStore(), undefined, {
                            expected: fromQr,
                            expectedInvoice: 'lnbc210n1xyz'
                        })
                    ).resolves.toEqual({
                        status: 'failed',
                        error: 'utils.NFCUtils.requestChanged'
                    });
                });
            });

            it('refuses a tag without a payment request', async () => {
                fakeType4Tag('lnurlw://example.com/withdraw');
                cacheNdef('lnurlw://example.com/withdraw');

                await expect(
                    pay(makeCashuStore(), undefined, { expected: confirmed })
                ).resolves.toEqual({
                    status: 'failed',
                    error: 'utils.NFCUtils.requestNotFound'
                });
            });

            it('fails instead of routing a URI it cannot pay', async () => {
                fakeType4Tag(NUMO_TAG);
                cacheNdef(NUMO_TAG);

                await expect(
                    pay(makeCashuStore({ mintBalances: {} }), undefined, {
                        expected: confirmed
                    })
                ).resolves.toEqual({
                    status: 'failed',
                    error: 'views.Cashu.CREQPayment.noCompatibleMint'
                });
            });
        });

        it('cancels the pending request when the NFC modal is dismissed', async () => {
            let rejectRequest: (e: Error) => void = () => {};
            nfc.requestTechnology.mockImplementation(
                () =>
                    new Promise((_, reject) => {
                        rejectRequest = reject;
                    })
            );
            nfc.cancelTechnologyRequest.mockImplementation(async () =>
                rejectRequest(new Error('cancelled'))
            );
            const modalStore = makeModalStore();

            const result = pay(makeCashuStore(), modalStore);
            await new Promise((resolve) => setImmediate(resolve));
            expect(modalStore.showAndroidNfcModal).toBe(true);
            modalStore.toggleAndroidNfcModal(false);

            await expect(result).resolves.toEqual({ status: 'cancelled' });
            expect(nfc.cancelTechnologyRequest).toHaveBeenCalled();
        });

        describe('Android delivering the tag again', () => {
            it.each([
                ['paid', 'creqAoWFhZA', {}],
                ['above the limit', NUMO_TAG, { limit: 0 }],
                ['failed', 'creqAoWFhZA', { expected: { amount: 2100 } }],
                ['not a CREQ', 'lnurlw://example.com/withdraw', {}]
            ])(
                'recognizes the tag of a session that %s',
                async (_, text, options) => {
                    fakeType4Tag(text);
                    cacheNdef(text);

                    await pay(makeCashuStore(), undefined, options);

                    expect(isTagRedelivery(text)).toBe(true);
                }
            );
        });

        it('stops early when NFC is off', async () => {
            nfc.isEnabled.mockResolvedValue(false);

            await expect(pay(makeCashuStore())).resolves.toEqual({
                status: 'failed',
                error: 'utils.NFCUtils.nfcNotEnabled'
            });
            expect(nfc.requestTechnology).not.toHaveBeenCalled();
        });
    });

    describe('on iOS', () => {
        beforeEach(() => {
            Platform.OS = 'ios';
        });

        it('reads the request over APDUs and writes the token back', async () => {
            const tag = fakeType4Tag('creqAoWFhZA');
            const cashuStore = makeCashuStore();

            await expect(pay(cashuStore)).resolves.toEqual({
                status: 'paid',
                amount: 21
            });
            expect(nfc.getTag).not.toHaveBeenCalled();
            expect(tag.writtenText()).toBe(TOKEN);
        });

        it('reads non-ISO 7816 tags through the NDEF handler', async () => {
            nfc.requestTechnology.mockResolvedValue('Ndef');
            nfc.ndefHandler.getNdefMessage.mockResolvedValue({
                ndefMessage: Ndef.decodeMessage(
                    buildNdefTextMessage('lnurlw://example.com/w').slice(2)
                )
            });

            await expect(pay(makeCashuStore())).resolves.toEqual({
                status: 'read',
                text: 'lnurlw://example.com/w'
            });
        });

        it('treats a session that ends before a tag as cancelled', async () => {
            nfc.requestTechnology.mockRejectedValue(new Error('UserCancel'));

            await expect(pay(makeCashuStore())).resolves.toEqual({
                status: 'cancelled'
            });
        });
    });
});
