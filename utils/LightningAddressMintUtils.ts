import { Alert } from 'react-native';

import type CashuStore from '../stores/CashuStore';
import type LightningAddressStore from '../stores/LightningAddressStore';
import type SettingsStore from '../stores/SettingsStore';

import { localeString } from './LocaleUtils';

// Trailing slashes and scheme/host case do not make a different mint.
// The path is kept byte-exact, matching LightningAddressStore.
const normalizeMintUrl = (url?: string): string => {
    if (typeof url !== 'string' || !url) return '';
    return url
        .trim()
        .replace(/\/+$/, '')
        .replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, (schemeAndHost) =>
            schemeAndHost.toLowerCase()
        );
};

export const isSameMintUrl = (a?: string, b?: string): boolean => {
    const normalizedA = normalizeMintUrl(a);
    return !!normalizedA && normalizedA === normalizeMintUrl(b);
};

// The mint a Cashu Lightning address pays into, as last set from this
// device. ZEUS Pay's status reply does not include it, so it is unknown
// after a reinstall or after switching from an NWC address.
export const getLightningAddressMintUrl = (
    lightningAddressStore?: LightningAddressStore,
    settingsStore?: SettingsStore
): string | undefined => {
    if (
        !lightningAddressStore?.lightningAddress ||
        lightningAddressStore.lightningAddressType !== 'cashu'
    ) {
        return undefined;
    }
    return settingsStore?.settings?.lightningAddress?.mintUrl || undefined;
};

export const shouldOfferLightningAddressMintSwitch = ({
    lightningAddress,
    lightningAddressType,
    addressMintUrl,
    newMintUrl
}: {
    lightningAddress?: string;
    lightningAddressType?: string;
    addressMintUrl?: string;
    newMintUrl?: string;
}): boolean =>
    !!lightningAddress &&
    lightningAddressType === 'cashu' &&
    !!newMintUrl &&
    !isSameMintUrl(addressMintUrl, newMintUrl);

const mintName = (cashuStore: CashuStore, mintUrl: string): string =>
    cashuStore.mintInfos?.[mintUrl]?.name || mintUrl;

// After the user picks a new wallet mint, offer to move the Lightning
// address to it as well. The wallet mint only applies to invoices, so
// without this the address keeps paying into the old mint.
export const offerLightningAddressMintSwitch = ({
    lightningAddressStore,
    settingsStore,
    cashuStore,
    newMintUrl
}: {
    lightningAddressStore: LightningAddressStore;
    settingsStore: SettingsStore;
    cashuStore: CashuStore;
    newMintUrl?: string;
}): void => {
    const { lightningAddress, lightningAddressType } = lightningAddressStore;
    const addressMintUrl = settingsStore.settings?.lightningAddress?.mintUrl;

    if (
        !newMintUrl ||
        !shouldOfferLightningAddressMintSwitch({
            lightningAddress,
            lightningAddressType,
            addressMintUrl,
            newMintUrl
        })
    ) {
        return;
    }

    const message = addressMintUrl
        ? localeString('views.Cashu.LightningAddress.switchMint.message')
              .replace('{{address}}', lightningAddress)
              .replace('{{currentMint}}', mintName(cashuStore, addressMintUrl))
              .replace('{{newMint}}', mintName(cashuStore, newMintUrl))
        : localeString(
              'views.Cashu.LightningAddress.switchMint.messageUnknownCurrent'
          )
              .replace('{{address}}', lightningAddress)
              .replace('{{newMint}}', mintName(cashuStore, newMintUrl));

    Alert.alert(
        localeString('views.Cashu.LightningAddress.receivingMint'),
        message,
        [
            {
                text: localeString(
                    'views.Cashu.LightningAddress.switchMint.keep'
                ),
                style: 'cancel'
            },
            {
                text: localeString(
                    'views.Cashu.LightningAddress.switchMint.switch'
                ),
                onPress: () => {
                    lightningAddressStore
                        .setMintUrl(newMintUrl)
                        .catch((e: any) =>
                            Alert.alert(
                                localeString('general.error'),
                                lightningAddressStore.error_msg || e?.toString()
                            )
                        );
                }
            }
        ]
    );
};
