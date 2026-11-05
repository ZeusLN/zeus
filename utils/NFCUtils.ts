import { Platform } from 'react-native';
import { reaction } from 'mobx';
import NfcManager, {
    NfcAdapter,
    NfcEvents,
    NfcTech,
    NdefRecord,
    TagEvent,
    Ndef
} from 'react-native-nfc-manager';
import ModalStore from '../stores/ModalStore';
import CashuStore from '../stores/CashuStore';
import {
    isCREQ,
    decodeCREQ,
    creqPaymentError,
    findCompatibleMint,
    sameRequest,
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

        // Cancelling the AndroidNfcModal only hides it; stop listening too,
        // or the next scan finds the tag event still registered
        const stopWatchingModal =
            Platform.OS === 'android'
                ? reaction(
                      () => modalStore.showAndroidNfcModal,
                      (shown) => {
                          if (shown) return;
                          stopWatchingModal();
                          NfcManager.unregisterTagEvent().catch(() => 0);
                          resolve(undefined);
                      }
                  )
                : () => {};

        NfcManager.setEventListener(NfcEvents.DiscoverTag, (tag: TagEvent) => {
            stopWatchingModal();
            tagFound = tag;
            const str = pickNfcRecord(tag.ndefMessage || [], prefer);

            if (Platform.OS === 'android')
                modalStore.toggleAndroidNfcModal(false);

            resolve(str);
            NfcManager.unregisterTagEvent().catch(() => 0);
        });

        NfcManager.setEventListener(NfcEvents.SessionClosed, () => {
            stopWatchingModal();
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
// Largest Lc/Le of a short APDU
const SHORT_APDU_MAX = 255;

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
 * Split an APDU response into data and status word. Both platforms return
 * [...data, sw1, sw2] from transceive.
 */
function parseApduResponse(response: number[]): {
    data: number[];
    ok: boolean;
} {
    const sw1 = response[response.length - 2];
    const sw2 = response[response.length - 1];
    const data = response.slice(0, response.length - 2);
    return { data, ok: sw1 === 0x90 && sw2 === 0x00 };
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

export interface CapabilityContainer {
    /** Largest READ BINARY response, from MLe */
    maxRead: number;
    /** Largest UPDATE BINARY data, from MLc */
    maxWrite: number;
    ndefFileId: number[];
    /** Size of the NDEF file, NLEN included */
    maxNdefSize: number;
    writable: boolean;
}

/**
 * Parse a Type 4 Tag capability container (CC file): CCLEN(2) version(1)
 * MLe(2) MLc(2), then the NDEF File Control TLV T=04 L=06 file id(2)
 * max NDEF size(2) read access(1) write access(1).
 */
export function parseCapabilityContainer(cc: number[]): CapabilityContainer {
    if (cc.length < 15 || cc[7] !== 0x04 || cc[8] < 0x06) {
        throw new Error('Invalid capability container');
    }
    const mle = (cc[3] << 8) | cc[4];
    const mlc = (cc[5] << 8) | cc[6];
    return {
        maxRead: Math.max(1, Math.min(mle, SHORT_APDU_MAX)),
        maxWrite: Math.max(1, Math.min(mlc, SHORT_APDU_MAX)),
        ndefFileId: [cc[9], cc[10]],
        maxNdefSize: (cc[11] << 8) | cc[12],
        writable: cc[14] === 0x00
    };
}

// --- Session-internal APDU operations (call within an active IsoDep session) ---

async function transceive(apdu: number[], step: string): Promise<number[]> {
    const resp = parseApduResponse(
        await NfcManager.isoDepHandler.transceive(apdu)
    );
    if (!resp.ok) throw new Error(`NFC tag rejected ${step}`);
    return resp.data;
}

/**
 * Select the NDEF application, read its capability container and leave the
 * NDEF file selected.
 */
async function openNdefFile(): Promise<CapabilityContainer> {
    await transceive(buildSelectAidApdu(NDEF_AID), 'SELECT NDEF application');
    await transceive(buildSelectFileApdu(FILE_CC), 'SELECT CC');
    const cc = parseCapabilityContainer(
        await transceive(buildReadBinaryApdu(0, 15), 'READ CC')
    );
    await transceive(buildSelectFileApdu(cc.ndefFileId), 'SELECT NDEF file');
    return cc;
}

/** Read the NDEF message (without NLEN) from the selected NDEF file */
async function readNdefBytes(cc: CapabilityContainer): Promise<number[]> {
    const nlenBytes = await transceive(buildReadBinaryApdu(0, 2), 'READ NLEN');
    const nlen = (nlenBytes[0] << 8) | nlenBytes[1];
    if (nlen + 2 > cc.maxNdefSize) throw new Error('NLEN exceeds NDEF file');

    const ndefBytes: number[] = [];
    while (ndefBytes.length < nlen) {
        const toRead = Math.min(nlen - ndefBytes.length, cc.maxRead);
        const data = await transceive(
            buildReadBinaryApdu(2 + ndefBytes.length, toRead),
            'READ NDEF'
        );
        if (data.length === 0) throw new Error('Empty READ NDEF response');
        ndefBytes.push(...data);
    }
    return ndefBytes.slice(0, nlen);
}

/**
 * Write an NDEF file (NLEN included) the way NFC Forum Type 4 Tags expect:
 * NLEN 0, then the message, then the real NLEN. A reader that parses the
 * file after every write, like react-native-hce, then never sees a full
 * length over a half-written message.
 */
async function writeNdefBytes(
    cc: CapabilityContainer,
    ndefFile: number[]
): Promise<void> {
    if (ndefFile.length > cc.maxNdefSize) {
        throw new Error('Token does not fit the NDEF file');
    }
    await transceive(buildUpdateBinaryApdu(0, [0x00, 0x00]), 'clear NLEN');
    let offset = 2;
    while (offset < ndefFile.length) {
        const chunk = ndefFile.slice(offset, offset + cc.maxWrite);
        await transceive(
            buildUpdateBinaryApdu(offset, chunk),
            `UPDATE NDEF at ${offset}`
        );
        offset += chunk.length;
    }
    await transceive(buildUpdateBinaryApdu(0, ndefFile.slice(0, 2)), 'NLEN');
}

// --- Public NFC operations ---

// Reader mode keeps Android from also dispatching the tag to the app as an
// NDEF_DISCOVERED intent, which would route it a second time
const readerModeOptions = () => ({
    isReaderModeEnabled: true,
    readerModeFlags:
        NfcAdapter.FLAG_READER_NFC_A |
        NfcAdapter.FLAG_READER_NFC_B |
        NfcAdapter.FLAG_READER_NFC_F |
        NfcAdapter.FLAG_READER_NFC_V
});

/**
 * Hide-the-modal handler for Android tech sessions: cancelling the
 * AndroidNfcModal only hides it, so cancel the pending request with it.
 * Returns a disposer, and the callback sees whether the user cancelled.
 */
function cancelOnModalClose(
    modalStore: ModalStore,
    onCancel: () => void
): () => void {
    if (Platform.OS !== 'android') return () => {};
    return reaction(
        () => modalStore.showAndroidNfcModal,
        (shown) => {
            if (shown) return;
            onCancel();
            NfcManager.cancelTechnologyRequest().catch(() => 0);
        }
    );
}

/** Text of a tag's first NDEF record, decoded like scanNfcTag does */
function ndefPayloadToString(payload: number[] | Uint8Array): string {
    const bytes = new Uint8Array(payload);
    const decoded = Ndef.text.decodePayload(bytes);
    if (decoded.match(/^(https?|lnurl)/)) return decoded;
    return decodeNdefTextPayload(bytes) || '';
}

/**
 * The Cashu payment request on a tag: either the whole text, or the creq
 * parameter of a BIP-321 URI (what Numo broadcasts, next to a lightning
 * invoice).
 */
export function extractTagCREQ(text: string): string | undefined {
    if (isCREQ(text)) return text;
    const match = text.match(/^bitcoin:[^?]*\?(?:[^#]*&)?creq=([^&#]+)/i);
    if (!match) return undefined;
    try {
        const creq = decodeURIComponent(match[1]);
        return isCREQ(creq) ? creq : undefined;
    } catch {
        return undefined;
    }
}

export type NfcTapResult =
    /** a token for the tag's payment request was delivered */
    | { status: 'paid'; amount: number }
    /** not paid here: hand the tag's text to the regular input handlers */
    | { status: 'read'; text?: string }
    /** above the tap-to-pay limit: nothing paid, the user has to confirm */
    | { status: 'confirm'; creqParams: CREQParams; creqString: string }
    | { status: 'failed'; error: string; tokenSaved?: boolean }
    | { status: 'cancelled' };

export interface NfcTapOptions {
    /**
     * Pay only this request, which the user has already confirmed. The tag
     * must hold the same request, and the limit doesn't apply.
     */
    expected?: CREQParams;
    /** Sats above which a request comes back as 'confirm' unpaid */
    limit?: number;
}

/**
 * Single-tap NFC payment: read the tag, and if it holds a Cashu payment
 * request (CREQ), create a token and write it back, all in one NFC session.
 * No user confirmation up to the limit.
 *
 * Any other tag content comes back as 'read' so the caller can route it
 * without a second tap. A CREQ that can't be paid also comes back as 'read'
 * when it sits in a URI with other payment methods, so the user can pick
 * one of those instead. With an expected request, both are failures.
 */
export async function payViaNfcTap(
    modalStore: ModalStore,
    cashuStore: CashuStore,
    { expected, limit }: NfcTapOptions = {}
): Promise<NfcTapResult> {
    if (!(await checkNfcEnabled(modalStore)))
        return {
            status: 'failed',
            error: localeString('utils.NFCUtils.nfcNotEnabled')
        };

    let cancelled = false;
    let connected = false;
    const stopWatchingModal = cancelOnModalClose(modalStore, () => {
        cancelled = true;
    });

    try {
        await NfcManager.start().catch((e) => console.warn(e.message));
        // a leftover tag event registration would keep reader mode off
        if (Platform.OS === 'android')
            await NfcManager.unregisterTagEvent().catch(() => 0);
        if (Platform.OS === 'android') modalStore.toggleAndroidNfcModal(true);

        const tech = await NfcManager.requestTechnology(
            [NfcTech.IsoDep, NfcTech.Ndef],
            readerModeOptions()
        );
        connected = true;
        // from here on the payment finishes even if the modal is dismissed
        stopWatchingModal();

        let cc: CapabilityContainer | undefined;
        if (tech === NfcTech.IsoDep) {
            try {
                cc = await openNdefFile();
            } catch (e) {
                console.warn('payViaNfcTap: no NDEF application', e);
            }
        }

        let records: NdefRecord[] | undefined;
        if (Platform.OS === 'android') {
            records = (await NfcManager.getTag())?.ndefMessage;
        } else if (tech !== NfcTech.IsoDep) {
            records = (await NfcManager.ndefHandler.getNdefMessage())
                ?.ndefMessage;
        }
        if (!records?.length && cc) {
            records = Ndef.decodeMessage(await readNdefBytes(cc));
        }

        const payload = records?.[0]?.payload;
        const text = payload?.length ? ndefPayloadToString(payload) : '';
        const creq = text ? extractTagCREQ(text) : undefined;
        if (!creq) {
            return expected
                ? {
                      status: 'failed',
                      error: localeString('utils.NFCUtils.requestNotFound')
                  }
                : { status: 'read', text: text || undefined };
        }

        const hasOtherMethods = creq !== text && !expected;
        const cannotPay = (error: string): NfcTapResult =>
            hasOtherMethods
                ? { status: 'read', text }
                : { status: 'failed', error: localeString(error) };

        let creqParams: CREQParams;
        try {
            creqParams = await decodeCREQ(creq);
        } catch (e) {
            console.warn('payViaNfcTap: invalid CREQ', e);
            return cannotPay('views.Cashu.CREQPayment.invalidRequest');
        }

        if (expected && !sameRequest(creqParams, expected)) {
            return cannotPay('utils.NFCUtils.requestChanged');
        }

        const requestError = creqPaymentError(creqParams);
        if (requestError) return cannotPay(requestError);

        if (!cc?.writable) return cannotPay('utils.NFCUtils.tagNotWritable');

        const mintUrl = findCompatibleMint(
            creqParams,
            cashuStore.mintUrls,
            cashuStore.mintBalances,
            cashuStore.selectedMintUrl
        );
        if (!mintUrl)
            return cannotPay('views.Cashu.CREQPayment.noCompatibleMint');

        const amount = creqParams.amount!;
        if (!expected && limit != null && amount > limit) {
            return { status: 'confirm', creqParams, creqString: creq };
        }

        let token: string;
        try {
            ({ token } = await cashuStore.sendTokenForRequest(
                mintUrl,
                amount,
                creqParams.description
            ));
        } catch (e: any) {
            console.warn('payViaNfcTap: token creation failed', e);
            return {
                status: 'failed',
                error:
                    e?.message ||
                    localeString('views.Cashu.CREQPayment.failedToCreateToken')
            };
        }

        try {
            // openNdefFile left the NDEF file selected
            await writeNdefBytes(cc, buildNdefTextMessage(token));
        } catch (e) {
            console.warn('payViaNfcTap: token write failed', e);
            return {
                status: 'failed',
                error: localeString('utils.NFCUtils.tokenNotDelivered'),
                tokenSaved: true
            };
        }

        return { status: 'paid', amount };
    } catch (e: any) {
        if (cancelled || !connected) {
            // user cancel, session timeout or a session that never started
            if (!cancelled) console.warn('payViaNfcTap session error:', e);
            return { status: 'cancelled' };
        }
        console.warn('payViaNfcTap error:', e);
        return {
            status: 'failed',
            error: localeString('utils.NFCUtils.nfcPaymentFailed')
        };
    } finally {
        stopWatchingModal();
        if (Platform.OS === 'android') modalStore.toggleAndroidNfcModal(false);
        NfcManager.cancelTechnologyRequest().catch(() => 0);
    }
}
