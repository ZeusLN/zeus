import { v4 as uuidv4 } from 'uuid';

import { optimizeNeutrinoPeers, createLndWallet } from './LndMobileUtils';
import { createLdkNodeWallet } from './LdkNodeUtils';
import { localeString } from './LocaleUtils';

import SettingsStore from '../stores/SettingsStore';

interface WalletCreationParams {
    settingsStore: SettingsStore;
    enableCashu: boolean;
    clipboard: boolean;
    fiatEnabled: boolean;
    selectedCurrency: string;
    fiatRatesSource: string;
    initialMintUrls?: string[];
    implementation?: string;
    onChoosingPeers: () => void;
    onCreatingWallet: () => void;
    onError: () => void;
    onSuccess: () => void;
}

export async function createOnboardingWallet(params: WalletCreationParams) {
    const {
        settingsStore,
        enableCashu,
        clipboard,
        fiatEnabled,
        selectedCurrency,
        fiatRatesSource,
        initialMintUrls,
        implementation,
        onChoosingPeers,
        onCreatingWallet,
        onError,
        onSuccess
    } = params;

    const { setConnectingStatus, updateSettings, settings } = settingsStore;

    const commonSettings = {
        privacy: {
            ...settings.privacy,
            clipboard
        },
        fiatEnabled,
        fiat: selectedCurrency,
        fiatRatesSource,
        ecash: {
            ...settings.ecash,
            enableCashu,
            ...(initialMintUrls && initialMintUrls.length > 0
                ? { initialMintUrls }
                : {})
        }
    };

    if (implementation === 'ldk-node') {
        onCreatingWallet();

        const nodeDir = uuidv4();

        try {
            const response = await createLdkNodeWallet({
                nodeDir,
                network: 'mainnet'
            });

            if (response && response.mnemonic) {
                const nodes = [
                    {
                        implementation: 'ldk-node',
                        embeddedLdkNetwork: 'mainnet',
                        ldkNodeDir: nodeDir,
                        ldkMnemonic: response.mnemonic,
                        nickname: localeString('general.defaultNodeNickname')
                    }
                ];

                await updateSettings({
                    nodes,
                    ...commonSettings
                });

                setConnectingStatus(true);
                onSuccess();
            } else {
                onError();
            }
        } catch (e) {
            onError();
        }
    } else {
        // Default: embedded-lnd
        onChoosingPeers();

        try {
            await optimizeNeutrinoPeers(undefined);
        } catch (e) {
            onError();
            return;
        }

        onCreatingWallet();

        const lndDir = uuidv4();

        let response;
        try {
            response = await createLndWallet({ lndDir });
        } catch (e) {
            onError();
            return;
        }

        const { wallet, seed, randomBase64 }: any = response;
        if (wallet && wallet.admin_macaroon) {
            const nodes = [
                {
                    adminMacaroon: wallet.admin_macaroon,
                    seedPhrase: seed.cipher_seed_mnemonic,
                    walletPassword: randomBase64,
                    embeddedLndNetwork: 'Mainnet',
                    implementation: 'embedded-lnd',
                    nickname: localeString('general.defaultNodeNickname'),
                    lndDir,
                    isSqlite: true
                }
            ];

            await updateSettings({
                nodes,
                ...commonSettings
            });

            setConnectingStatus(true);
            onSuccess();
        } else {
            onError();
        }
    }
}
