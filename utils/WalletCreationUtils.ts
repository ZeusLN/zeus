import { v4 as uuidv4 } from 'uuid';

import { optimizeNeutrinoPeers, createLndWallet } from './LndMobileUtils';
import { createLdkNodeWallet } from './LdkNodeUtils';
import { localeString } from './LocaleUtils';

import SettingsStore, { Settings } from '../stores/SettingsStore';

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

    // Refuse to create a new wallet if one already exists. Overwriting the
    // `nodes` array would orphan the existing node directory and any funds it
    // holds. Treat this as a successful no-op so callers route the user back
    // to the Wallet view rather than into an error state.
    if (settings?.nodes?.length) {
        console.warn(
            'createOnboardingWallet: existing node detected, skipping creation'
        );
        onSuccess();
        return;
    }

    // Merged into the settings current when the write runs: wallet
    // creation takes seconds, and a group spread from `settings` here
    // would revert privacy or ecash changes made in the meantime.
    const commonSettings = (current: Settings) => ({
        privacy: {
            ...current.privacy,
            clipboard
        },
        fiatEnabled,
        fiat: selectedCurrency,
        fiatRatesSource,
        ecash: {
            ...current.ecash,
            enableCashu,
            ...(initialMintUrls && initialMintUrls.length > 0
                ? { initialMintUrls }
                : {})
        }
    });

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
                        ldkNetwork: 'mainnet',
                        ldkNodeDir: nodeDir,
                        ldkMnemonic: response.mnemonic,
                        nickname: localeString('general.defaultNodeNickname')
                    }
                ];

                await updateSettings((current: Settings) => ({
                    nodes,
                    ...commonSettings(current)
                }));

                // Node is already built — tell Wallet.tsx to skip re-init
                settingsStore.walletJustCreated = true;

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
                    isSqlite: false
                }
            ];

            await updateSettings((current: Settings) => ({
                nodes,
                ...commonSettings(current)
            }));

            setConnectingStatus(true);
            onSuccess();
        } else {
            onError();
        }
    }
}
