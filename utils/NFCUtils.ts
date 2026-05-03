import { Platform } from 'react-native';
import NfcManager, {
    NfcEvents,
    NfcTech,
    TagEvent,
    Ndef
} from 'react-native-nfc-manager';
import ModalStore from '../stores/ModalStore';
import { isCREQ, decodeCREQ, CREQParams } from './CREQUtils';

export function decodeNdefTextPayload(data: Uint8Array): string | null {
    if (data.length === 0) return '';
    const langCodeLen = data[0] & 0x3f;
    const textData = data.slice(1 + langCodeLen);
    try {
        return new global.TextDecoder('utf-8', { fatal: true }).decode(
            textData
        );
    } catch {
        return null;
    }
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
    modalStore: ModalStore
): Promise<string | undefined> {
    if (!(await checkNfcEnabled(modalStore))) return undefined;

    NfcManager.setEventListener(NfcEvents.DiscoverTag, null);
    NfcManager.setEventListener(NfcEvents.SessionClosed, null);
    await NfcManager.start().catch((e) => console.warn(e.message));

    return new Promise((resolve) => {
        let tagFound: TagEvent | null = null;

        if (Platform.OS === 'android') modalStore.toggleAndroidNfcModal(true);

        NfcManager.setEventListener(NfcEvents.DiscoverTag, (tag: TagEvent) => {
            if (!tag.ndefMessage?.[0]?.payload) {
                if (Platform.OS === 'android')
                    modalStore.toggleAndroidNfcModal(false);
                resolve(undefined);
                NfcManager.unregisterTagEvent().catch(() => 0);
                return;
            }

            tagFound = tag;
            const bytes = new Uint8Array(tag.ndefMessage[0].payload);

            let str: string;
            const decoded = Ndef.text.decodePayload(bytes);
            if (decoded.match(/^(https?|lnurl)/)) {
                str = decoded;
            } else {
                str = decodeNdefTextPayload(bytes) || '';
            }

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
    const textBytes = Array.from(
        new global.TextEncoder().encode(text) as Uint8Array
    );
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

/**
 * Read a CREQ payment request from an NFC Type 4 tag via IsoDep APDUs.
 * Works on both Android and iOS.
 */
export async function readCREQFromTag(
    modalStore: ModalStore
): Promise<{ creqParams: CREQParams; creqString: string } | undefined> {
    if (!(await checkNfcEnabled(modalStore))) return undefined;

    try {
        if (Platform.OS === 'android') modalStore.toggleAndroidNfcModal(true);

        await NfcManager.requestTechnology(NfcTech.IsoDep);

        // SELECT NDEF application
        let resp = parseApduResponse(
            await NfcManager.isoDepHandler.transceive(
                buildSelectAidApdu(NDEF_AID)
            )
        );
        if (!resp.ok) throw new Error('Failed to select NDEF application');

        // SELECT Capability Container
        resp = parseApduResponse(
            await NfcManager.isoDepHandler.transceive(
                buildSelectFileApdu(FILE_CC)
            )
        );
        if (!resp.ok) throw new Error('Failed to select CC file');

        // READ CC (15 bytes)
        resp = parseApduResponse(
            await NfcManager.isoDepHandler.transceive(
                buildReadBinaryApdu(0, 15)
            )
        );
        if (!resp.ok) throw new Error('Failed to read CC');

        // SELECT NDEF file
        resp = parseApduResponse(
            await NfcManager.isoDepHandler.transceive(
                buildSelectFileApdu(FILE_NDEF)
            )
        );
        if (!resp.ok) throw new Error('Failed to select NDEF file');

        // READ NLEN (first 2 bytes)
        resp = parseApduResponse(
            await NfcManager.isoDepHandler.transceive(buildReadBinaryApdu(0, 2))
        );
        if (!resp.ok) throw new Error('Failed to read NLEN');
        const nlen = (resp.data[0] << 8) | resp.data[1];

        // READ NDEF message body in chunks
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

        // Parse NDEF Text record to extract the CREQ string
        const text = parseNdefTextPayload(ndefBytes);
        if (!text || !isCREQ(text)) return undefined;

        return { creqParams: decodeCREQ(text), creqString: text };
    } catch (e) {
        console.warn('readCREQFromTag error:', e);
        return undefined;
    } finally {
        if (Platform.OS === 'android') modalStore.toggleAndroidNfcModal(false);
        NfcManager.cancelTechnologyRequest().catch(() => 0);
    }
}

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

        // SELECT NDEF application
        let resp = parseApduResponse(
            await NfcManager.isoDepHandler.transceive(
                buildSelectAidApdu(NDEF_AID)
            )
        );
        if (!resp.ok) throw new Error('Failed to select NDEF application');

        // SELECT NDEF file
        resp = parseApduResponse(
            await NfcManager.isoDepHandler.transceive(
                buildSelectFileApdu(FILE_NDEF)
            )
        );
        if (!resp.ok) throw new Error('Failed to select NDEF file');

        // Build NDEF message with token as Text record
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
            if (!resp.ok)
                throw new Error(`Failed to write at offset ${offset}`);
            offset += chunkSize;
        }

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
    return new global.TextDecoder('utf-8').decode(new Uint8Array(textData));
}
