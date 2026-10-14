import { Platform } from 'react-native';
import NfcManager, {
    NfcEvents,
    NfcTech,
    TagEvent,
    Ndef,
    NdefRecord
} from 'react-native-nfc-manager';
import ModalStore from '../stores/ModalStore';
import CashuStore from '../stores/CashuStore';
import {
    isCREQ,
    decodeCREQ,
    findCompatibleMint,
    CREQParams
} from './CREQUtils';
import { localeString } from './LocaleUtils';

const decodeUtf8 = (data: Uint8Array): string | null => {
    try {
        return new global.TextDecoder('utf-8', { fatal: true }).decode(data);
    } catch {
        return null;
    }
};

export function decodeNdefTextPayload(data: Uint8Array): string | null {
    if (data.length === 0) return '';
    const langCodeLen = data[0] & 0x3f;
    return decodeUtf8(data.slice(1 + langCodeLen));
}

/**
 * Decodes the payload of an NDEF URI record. Its first byte is not text:
 * it stands for one of the URI prefixes the NFC Forum abbreviates (0x04 is
 * "https://"), and 0x00 means the URI is written out in full.
 */
export function decodeNdefUriPayload(data: Uint8Array): string | null {
    if (data.length === 0) return null;
    const rest = decodeUtf8(data.slice(1));
    if (rest === null) return null;
    return (Ndef.RTD_URI_PROTOCOLS[data[0]] || '') + rest;
}

/**
 * An LNURL request a screen can ask scanNfcTag to prefer when a tag holds
 * more than one
 */
export type NfcRequestKind = 'pay' | 'withdraw';

const recordType = (record: NdefRecord): string =>
    typeof record.type === 'string'
        ? record.type
        : String.fromCharCode(...(record.type || []));

/**
 * The text an NDEF record carries, read according to the record's type, or
 * null for records that carry none (e.g. an Android application record).
 */
export function decodeNdefRecord(record: NdefRecord): string | null {
    const payload = new Uint8Array(record.payload || []);
    const type = recordType(record);
    switch (record.tnf) {
        case Ndef.TNF_WELL_KNOWN:
            if (type === Ndef.RTD_TEXT) return decodeNdefTextPayload(payload);
            if (type === Ndef.RTD_URI) return decodeNdefUriPayload(payload);
            return null;
        case Ndef.TNF_ABSOLUTE_URI:
            // the URI is the record type, the payload is unused
            return type || null;
        case Ndef.TNF_MIME_MEDIA:
            return type.toLowerCase() === 'text/plain'
                ? decodeUtf8(payload)
                : null;
        default:
            return null;
    }
}

// A record holding something for a wallet rather than, say, a web page
// telling people without one where to get one
const WALLET_RECORD = new RegExp(
    [
        // URI schemes, including those Zeus registers for NFC on Android
        '^(lightning|bitcoin|lnurl[wcp]?|keyauth|web\\+cashu|cashu|lndconnect):',
        // bare LNURLs, BOLT 11 invoices and BOLT 12 offers
        '^(lnurl1|ln(bc|tbs|tb|bcrt)\\w*1|lno1)',
        // LNURLs behind a web address
        '^https?://\\S*(/lnurl|lnurl1)'
    ].join('|'),
    'i'
);

// Ecash tokens, bare or behind a web address, matched as handleAnything
// matches them: case-sensitive and with a body, so a web page whose address
// holds, say, "?ref=cashuAfrica" is not taken for one
const CASHU_TOKEN = /cashu[AB][0-9A-Za-z+/_=-]{10,}/;

const isWalletText = (text: string): boolean => {
    if (WALLET_RECORD.test(text)) return true;
    const token = text.search(CASHU_TOKEN);
    return token === 0 || (token > 0 && /^https:\/\//i.test(text));
};

interface TagRecord {
    text: string;
    isWallet: boolean;
    kind?: NfcRequestKind;
}

const readTagRecord = (record: NdefRecord): TagRecord | null => {
    const text = decodeNdefRecord(record)?.trim();
    if (!text) return null;
    const scheme = text.match(/^lnurl([pw]):/i)?.[1].toLowerCase();
    return {
        text,
        isWallet: isWalletText(text),
        kind: scheme === 'p' ? 'pay' : scheme === 'w' ? 'withdraw' : undefined
    };
};

/**
 * Which of a tag's records to act on. A tag can hold several (e.g. a web
 * page first, for phones without a wallet, and the wallet data after it),
 * so the first that looks like wallet data wins. With `prefer`, an LNURL
 * request of that kind (by lnurlp:/lnurlw: scheme) wins over the others,
 * for a card that can be both paid and withdrawn from. Without
 * wallet data, the first record that has text is used.
 */
export function pickNfcRecord(
    records: NdefRecord[],
    prefer?: NfcRequestKind
): string | undefined {
    const read = records
        .map(readTagRecord)
        .filter((record): record is TagRecord => !!record);
    return (
        (prefer && read.find((record) => record.kind === prefer)) ||
        read.find((record) => record.isWallet) ||
        read[0]
    )?.text;
}

/**
 * Whether a handleAnything result for an NFC read in the receive views is
 * an LNURL-withdraw request (e.g. a Bolt Card), the only kind those views
 * act on. The route is checked as well as the tag: for a Lightning address
 * the tag comes from the server, and the route is LnurlPay whatever it
 * says. With ecash enabled, a withdraw request opens ChoosePaymentMethod
 * instead of Receive.
 */
export function isNfcWithdraw(
    route: string,
    lnurlParams?: { tag?: string }
): boolean {
    return (
        ['Receive', 'ChoosePaymentMethod'].includes(route) &&
        lnurlParams?.tag === 'withdrawRequest'
    );
}

/**
 * Checks whether NFC is enabled on the device.
 * If not, shows the AndroidNfcModal with the disabled state and returns false.
 * On iOS, NfcManager.isEnabled() always returns true, so this function
 * only ever returns false on Android.
 */
export async function checkNfcEnabled(
    modalStore: ModalStore
): Promise<boolean> {
    const nfcEnabled = await NfcManager.isEnabled();
    if (!nfcEnabled) {
        modalStore.toggleAndroidNfcModal(true, false);
        return false;
    }
    return true;
}

export async function scanNfcTag(
    modalStore: ModalStore,
    prefer?: NfcRequestKind
): Promise<string | undefined> {
    if (!(await checkNfcEnabled(modalStore))) return undefined;

    NfcManager.setEventListener(NfcEvents.DiscoverTag, null);
    NfcManager.setEventListener(NfcEvents.SessionClosed, null);
    await NfcManager.start().catch((e) => console.warn(e.message));

    return new Promise((resolve) => {
        let tagFound: TagEvent | null = null;

        if (Platform.OS === 'android') modalStore.toggleAndroidNfcModal(true);

        NfcManager.setEventListener(NfcEvents.DiscoverTag, (tag: TagEvent) => {
            tagFound = tag;
            const str = pickNfcRecord(tag.ndefMessage || [], prefer);

            if (Platform.OS === 'android')
                modalStore.toggleAndroidNfcModal(false);

            resolve(str);
            NfcManager.unregisterTagEvent().catch(() => 0);
        });

        NfcManager.setEventListener(NfcEvents.SessionClosed, () => {
            if (Platform.OS === 'android')
                modalStore.toggleAndroidNfcModal(false);

            if (!tagFound) resolve(undefined);
        });

        NfcManager.registerTagEvent();
    });
}

// --- APDU helpers for NFC Type 4 tag communication (CREQ tap-to-pay) ---

const NDEF_AID = [0xd2, 0x76, 0x00, 0x00, 0x85, 0x01, 0x01];
const FILE_CC = [0xe1, 0x03];
const FILE_NDEF = [0xe1, 0x04];

function buildSelectAidApdu(aid: number[]): number[] {
    // CLA=00 INS=A4 P1=04 P2=00 Lc=len data Le=00
    return [0x00, 0xa4, 0x04, 0x00, aid.length, ...aid, 0x00];
}

function buildSelectFileApdu(fileId: number[]): number[] {
    // CLA=00 INS=A4 P1=00 P2=0C Lc=02 fileId
    return [0x00, 0xa4, 0x00, 0x0c, 0x02, ...fileId];
}

function buildReadBinaryApdu(offset: number, length: number): number[] {
    return [0x00, 0xb0, (offset >> 8) & 0xff, offset & 0xff, length];
}

function buildUpdateBinaryApdu(offset: number, data: number[]): number[] {
    return [
        0x00,
        0xd6,
        (offset >> 8) & 0xff,
        offset & 0xff,
        data.length,
        ...data
    ];
}

/**
 * Parse APDU response, extracting data and status word.
 * iOS returns [...data, sw1, sw2] while Android returns [...data, sw1, sw2]
 * as the last two bytes of the array (same format from transceive).
 */
function parseApduResponse(response: number[]): {
    data: number[];
    sw1: number;
    sw2: number;
    ok: boolean;
} {
    const sw1 = response[response.length - 2];
    const sw2 = response[response.length - 1];
    const data = response.slice(0, response.length - 2);
    return { data, sw1, sw2, ok: sw1 === 0x90 && sw2 === 0x00 };
}

/**
 * Build an NDEF Text record matching NFC Forum Type 4 format.
 * TNF=0x01 (Well Known), RTD=0x54 ('T'), language="en", UTF-8 payload.
 * Returns the full NDEF file content: [NLEN_hi, NLEN_lo, record_bytes...]
 */
export function buildNdefTextMessage(text: string): number[] {
    const langCode = [0x65, 0x6e]; // "en"
    const textBytes = Array.from(Buffer.from(text, 'utf-8'));
    const payloadLength = 1 + langCode.length + textBytes.length;

    // NDEF record header
    const record: number[] = [];
    // Flags: MB=1, ME=1, CF=0, SR depends on payloadLength, IL=0, TNF=01
    const isShortRecord = payloadLength < 256;
    record.push(isShortRecord ? 0xd1 : 0xc1); // MB|ME|SR|TNF=01
    record.push(0x01); // Type length = 1
    if (isShortRecord) {
        record.push(payloadLength); // Payload length (1 byte for SR)
    } else {
        // 4-byte payload length (big-endian)
        record.push((payloadLength >> 24) & 0xff);
        record.push((payloadLength >> 16) & 0xff);
        record.push((payloadLength >> 8) & 0xff);
        record.push(payloadLength & 0xff);
    }
    record.push(0x54); // Type: 'T' for Text

    // Payload: status byte (UTF-8, lang length) + lang code + text
    record.push(langCode.length & 0x3f);
    record.push(...langCode);
    record.push(...textBytes);

    // NLEN prefix (2 bytes big-endian)
    const nlen = record.length;
    return [(nlen >> 8) & 0xff, nlen & 0xff, ...record];
}

// --- Session-internal APDU operations (call within an active IsoDep session) ---

async function selectNdefApp(): Promise<void> {
    const resp = parseApduResponse(
        await NfcManager.isoDepHandler.transceive(buildSelectAidApdu(NDEF_AID))
    );
    if (!resp.ok) throw new Error('Failed to select NDEF application');
}

async function readNdefText(): Promise<string | null> {
    // SELECT CC
    let resp = parseApduResponse(
        await NfcManager.isoDepHandler.transceive(buildSelectFileApdu(FILE_CC))
    );
    if (!resp.ok) throw new Error('Failed to select CC file');

    // READ CC
    resp = parseApduResponse(
        await NfcManager.isoDepHandler.transceive(buildReadBinaryApdu(0, 15))
    );
    if (!resp.ok) throw new Error('Failed to read CC');

    // SELECT NDEF file
    resp = parseApduResponse(
        await NfcManager.isoDepHandler.transceive(
            buildSelectFileApdu(FILE_NDEF)
        )
    );
    if (!resp.ok) throw new Error('Failed to select NDEF file');

    // READ NLEN
    resp = parseApduResponse(
        await NfcManager.isoDepHandler.transceive(buildReadBinaryApdu(0, 2))
    );
    if (!resp.ok) throw new Error('Failed to read NLEN');
    const nlen = (resp.data[0] << 8) | resp.data[1];

    // READ body in chunks
    const ndefBytes: number[] = [];
    let offset = 2;
    while (ndefBytes.length < nlen) {
        const toRead = Math.min(nlen - ndefBytes.length, 255);
        resp = parseApduResponse(
            await NfcManager.isoDepHandler.transceive(
                buildReadBinaryApdu(offset, toRead)
            )
        );
        if (!resp.ok) throw new Error('Failed to read NDEF body');
        ndefBytes.push(...resp.data);
        offset += resp.data.length;
    }

    return parseNdefTextPayload(ndefBytes);
}

async function writeNdefText(token: string): Promise<void> {
    // SELECT NDEF file
    let resp = parseApduResponse(
        await NfcManager.isoDepHandler.transceive(
            buildSelectFileApdu(FILE_NDEF)
        )
    );
    if (!resp.ok) throw new Error('Failed to select NDEF file');

    const ndefMessage = buildNdefTextMessage(token);

    // Write in chunks (max 255 bytes per UPDATE BINARY)
    let offset = 0;
    while (offset < ndefMessage.length) {
        const chunkSize = Math.min(ndefMessage.length - offset, 255);
        const chunk = ndefMessage.slice(offset, offset + chunkSize);
        resp = parseApduResponse(
            await NfcManager.isoDepHandler.transceive(
                buildUpdateBinaryApdu(offset, chunk)
            )
        );
        if (!resp.ok) throw new Error(`Failed to write at offset ${offset}`);
        offset += chunkSize;
    }
}

// --- Public NFC operations ---

/**
 * Write a Cashu token to an NFC Type 4 tag via IsoDep UPDATE BINARY APDUs.
 * The tag must already be writable (merchant HCE with writable=true).
 */
export async function writeTokenToTag(
    modalStore: ModalStore,
    token: string
): Promise<boolean> {
    if (!(await checkNfcEnabled(modalStore))) return false;

    try {
        if (Platform.OS === 'android') modalStore.toggleAndroidNfcModal(true);

        await NfcManager.requestTechnology(NfcTech.IsoDep);
        await selectNdefApp();
        await writeNdefText(token);

        return true;
    } catch (e) {
        console.warn('writeTokenToTag error:', e);
        return false;
    } finally {
        if (Platform.OS === 'android') modalStore.toggleAndroidNfcModal(false);
        NfcManager.cancelTechnologyRequest().catch(() => 0);
    }
}

/**
 * Single-tap NFC payment: read CREQ from merchant tag, create Cashu token,
 * write it back — all in one NFC session. No user confirmation.
 *
 * Returns the decoded CREQ params on success, or an error string on failure.
 */
export async function payViaNfcTap(
    modalStore: ModalStore,
    cashuStore: CashuStore
): Promise<
    | { success: true; creqParams: CREQParams }
    | { success: false; error: string }
> {
    if (!(await checkNfcEnabled(modalStore)))
        return {
            success: false,
            error: localeString('utils.NFCUtils.nfcNotEnabled')
        };

    try {
        if (Platform.OS === 'android') modalStore.toggleAndroidNfcModal(true);

        await NfcManager.requestTechnology(NfcTech.IsoDep);

        // 1. Read CREQ from merchant
        await selectNdefApp();
        const text = await readNdefText();
        if (!text || !isCREQ(text)) {
            return {
                success: false,
                error: localeString('utils.NFCUtils.noCreqOnTag')
            };
        }

        const creqParams = decodeCREQ(text);
        if (!creqParams.amount) {
            return {
                success: false,
                error: localeString('utils.NFCUtils.creqNoAmount')
            };
        }

        // 2. Find a compatible mint and create token
        const mintUrl = findCompatibleMint(
            creqParams,
            cashuStore.mintUrls,
            cashuStore.mintBalances,
            cashuStore.selectedMintUrl
        );
        if (!mintUrl) {
            return {
                success: false,
                error: localeString('views.Cashu.CREQPayment.noCompatibleMint')
            };
        }

        const token = await cashuStore.sendTokenCDK(
            mintUrl,
            creqParams.amount,
            creqParams.description
        );

        // 3. Write token back to merchant tag
        await writeNdefText(token.encoded);

        return { success: true, creqParams };
    } catch (e: any) {
        console.warn('payViaNfcTap error:', e);
        return {
            success: false,
            error: e.message || localeString('utils.NFCUtils.nfcPaymentFailed')
        };
    } finally {
        if (Platform.OS === 'android') modalStore.toggleAndroidNfcModal(false);
        NfcManager.cancelTechnologyRequest().catch(() => 0);
    }
}

/**
 * Parse NDEF Text record bytes to extract the text content.
 * Input is the raw NDEF record bytes (after NLEN).
 */
function parseNdefTextPayload(recordBytes: number[]): string | null {
    // Minimal NDEF record: flags(1) + typeLen(1) + payloadLen(1+) + type(1) + payload
    if (recordBytes.length < 5) return null;

    const flags = recordBytes[0];
    const tnf = flags & 0x07;
    if (tnf !== 0x01) return null; // Not Well Known

    const sr = (flags >> 4) & 0x01;
    const typeLen = recordBytes[1];

    let payloadLen: number;
    let headerSize: number;
    if (sr) {
        payloadLen = recordBytes[2];
        headerSize = 3 + typeLen;
    } else {
        payloadLen =
            (recordBytes[2] << 24) |
            (recordBytes[3] << 16) |
            (recordBytes[4] << 8) |
            recordBytes[5];
        headerSize = 6 + typeLen;
    }

    const type = recordBytes.slice(sr ? 3 : 6, sr ? 3 + typeLen : 6 + typeLen);
    if (type[0] !== 0x54) return null; // Not Text record ('T')

    const payload = recordBytes.slice(headerSize, headerSize + payloadLen);
    if (payload.length === 0) return null;

    const langLen = payload[0] & 0x3f;
    const textData = payload.slice(1 + langLen);
    return Buffer.from(textData).toString('utf-8');
}
