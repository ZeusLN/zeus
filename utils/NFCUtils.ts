import { Platform } from 'react-native';
import NfcManager, {
    NfcEvents,
    TagEvent,
    Ndef
} from 'react-native-nfc-manager';
import ModalStore from '../stores/ModalStore';

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
