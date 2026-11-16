jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('@rneui/themed', () => {
    const { Text, View } = require('react-native');
    const Passthrough = ({ children }: any) => <View>{children}</View>;
    return {
        Icon: 'Icon',
        ListItem: Object.assign(Passthrough, {
            Content: Passthrough,
            Title: ({ children }: any) => <Text>{children}</Text>,
            Subtitle: ({ children }: any) => <Text>{children}</Text>
        })
    };
});
jest.mock('../../stores/CashuStore', () => ({}));
jest.mock('../../stores/SettingsStore', () => ({
    CURRENCY_KEYS: [],
    DEFAULT_FIAT: 'USD',
    DEFAULT_FIAT_RATES_SOURCE: 'Zeus'
}));
jest.mock('../../utils/WalletCreationUtils', () => ({
    createOnboardingWallet: jest.fn()
}));
jest.mock('../../utils/LocaleUtils');
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
jest.mock('../../assets/images/SVG/wordmark-black.svg', () => 'Wordmark');
jest.mock('../../components/Button', () => {
    const { Pressable, Text } = require('react-native');
    return ({ title, onPress }: any) => (
        <Pressable role="button" onPress={onPress}>
            <Text>{title}</Text>
        </Pressable>
    );
});
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../../components/MintAvatar', () => 'MintAvatar');
jest.mock('../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../../components/Text', () => {
    const { Text } = require('react-native');
    return ({ children }: any) => <Text>{children}</Text>;
});

import * as React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import RecommendedSettings from './RecommendedSettings';
import { createOnboardingWallet } from '../../utils/WalletCreationUtils';

const MINT_URLS = [
    'https://mint.example.com/one',
    'https://mint.example.com/two'
];

// WalletType and NodeChoice return to the summary with popTo, which keeps the
// mounted summary and replaces its route params. Each step re-renders it with
// the new params and fires its focus listener, as the navigator does.
const openSummary = async (params: any) => {
    let onFocus: () => Promise<void> = async () => {};
    const navigation = {
        addListener: jest.fn((event: string, listener: any) => {
            if (event === 'focus') onFocus = listener;
        }),
        navigate: jest.fn()
    };
    const CashuStore = {
        // no recommendations cached yet, as on a fresh install
        restoreCachedRecommendations: jest.fn(() => false),
        fetchMintsFromFollows: jest.fn(),
        getTopScoredMints: jest.fn(() => []),
        mintInfoCache: new Map(),
        fetchMintInfoBatch: jest.fn(),
        loading: false,
        loadingTrustedMints: false
    };
    const SettingsStore = {
        getSettings: jest.fn(async () => ({
            fiatEnabled: true,
            privacy: { clipboard: true }
        }))
    };
    const summary = (routeParams: any) => (
        <RecommendedSettings
            navigation={navigation as any}
            route={{ params: routeParams } as any}
            CashuStore={CashuStore as any}
            SettingsStore={SettingsStore as any}
        />
    );

    const view = await render(summary(params));
    await act(() => onFocus());

    const returnWith = async (routeParams: any) => {
        await view.rerender(summary(routeParams));
        await act(() => onFocus());
    };
    return { CashuStore, returnWith };
};

beforeEach(() => {
    jest.clearAllMocks();
});

describe('RecommendedSettings returning from an editor', () => {
    it('keeps the node and fetches the mints when switched to ecash', async () => {
        // the questionnaire's self-custody path, with Embedded LND
        const { CashuStore, returnWith } = await openSummary({
            enableCashu: false,
            implementation: 'embedded-lnd'
        });
        expect(CashuStore.fetchMintsFromFollows).not.toHaveBeenCalled();

        // WalletType, opened from the summary, picks ecash
        await returnWith({ enableCashu: true });

        expect(
            screen.getByText('views.NodeChoice.embeddedLndDescription')
        ).toBeTruthy();
        expect(
            screen.getByText('views.RecommendedSettings.walletType.cashu')
        ).toBeTruthy();
        expect(CashuStore.fetchMintsFromFollows).toHaveBeenCalledTimes(1);
    });

    it('restores cached recommendations instead of fetching when switched to ecash', async () => {
        const { CashuStore, returnWith } = await openSummary({
            enableCashu: false,
            implementation: 'embedded-lnd'
        });
        CashuStore.restoreCachedRecommendations.mockReturnValue(true);

        await returnWith({ enableCashu: true });

        expect(CashuStore.restoreCachedRecommendations).toHaveBeenCalledWith(
            'zeus'
        );
        expect(CashuStore.fetchMintsFromFollows).not.toHaveBeenCalled();
    });

    // "Your follows" reads the list the ZEUS follows fetch fills, so a
    // round trip through self-custody must not fetch over the user's own
    it("does not fetch the ZEUS follows over the user's own follows", async () => {
        const { CashuStore, returnWith } = await openSummary(undefined);

        // MintDiscovery, with an npub whose follows recommend no mints
        await returnWith({ discoverMode: 'custom', initialMintUrls: [] });
        // WalletType: self-custody, then ecash again
        await returnWith({ enableCashu: false });
        await returnWith({ enableCashu: true });

        // only the fetch on mount
        expect(CashuStore.fetchMintsFromFollows).toHaveBeenCalledTimes(1);
    });

    it('does not fetch the ZEUS follows over mints from all sources', async () => {
        const { CashuStore, returnWith } = await openSummary({
            discoverMode: 'all',
            initialMintUrls: MINT_URLS
        });

        // WalletType: self-custody, then ecash again
        await returnWith({ enableCashu: false });
        await returnWith({ enableCashu: true });

        // only the fetch on mount
        expect(CashuStore.fetchMintsFromFollows).toHaveBeenCalledTimes(1);
    });

    it('creates the wallet with the chosen mints and node', async () => {
        const { returnWith } = await openSummary({
            discoverMode: 'all',
            initialMintUrls: MINT_URLS
        });

        // WalletType and NodeChoice, opened from the summary
        await returnWith({
            enableCashu: true,
            implementation: 'embedded-lnd'
        });
        await fireEvent.press(
            screen.getByText('views.RecommendedSettings.createWallet')
        );

        expect(createOnboardingWallet).toHaveBeenCalledWith(
            expect.objectContaining({
                enableCashu: true,
                implementation: 'embedded-lnd',
                initialMintUrls: MINT_URLS
            })
        );
    });
});
