import { Platform } from 'react-native';
import NfcManager, {
    NfcEvents,
    TagEvent,
    Ndef,
    NdefRecord
} from 'react-native-nfc-manager';
import ModalStore from '../stores/ModalStore';

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
