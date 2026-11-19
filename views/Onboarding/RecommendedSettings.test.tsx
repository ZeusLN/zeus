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
// The header shows its title, so the tests can read it
jest.mock('../../components/Header', () => {
    const { Text } = require('react-native');
    return ({ centerComponent }: any) => (
        <Text testID="title">{centerComponent.text}</Text>
    );
});
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

const RECOMMENDED = 'views.RecommendedSettings.title';
const CUSTOMIZED = 'views.RecommendedSettings.titleCustomized';

const MINT_URLS = [
    'https://mint.example.com/one',
    'https://mint.example.com/two'
];

// What a fresh install stores before onboarding changes anything
// (DEFAULT_SETTINGS in stores/SettingsStore.ts)
const FRESH_INSTALL = {
    fiatEnabled: true,
    fiat: 'USD',
    fiatRatesSource: 'Zeus',
    privacy: { clipboard: true }
};

// Renders the summary with the saved settings and route params. focus() fires
// its focus listener, which loads the saved settings, as it does when the
// summary first opens and on every return from a sub-screen. WalletType and
// NodeChoice return with popTo, which keeps the mounted summary and replaces
// its route params: returnWith() re-renders it with the new params and fires
// focus, as the navigator does.
const renderSummary = async (saved: any, params?: any) => {
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
    const SettingsStore = { getSettings: jest.fn(async () => saved) };
    const summary = (routeParams: any) => (
        <RecommendedSettings
            navigation={navigation as any}
            route={{ params: routeParams } as any}
            CashuStore={CashuStore as any}
            SettingsStore={SettingsStore as any}
        />
    );

    const view = await render(summary(params));
    const focus = () => act(() => onFocus());
    const returnWith = async (routeParams: any) => {
        await view.rerender(summary(routeParams));
        await focus();
    };
    return { CashuStore, focus, returnWith };
};

// Renders the summary, then gains focus with the saved settings
const openSummary = async (saved: any, params?: any) => {
    const summary = await renderSummary(saved, params);
    await summary.focus();
    return summary;
};

const title = () => screen.getByTestId('title').props.children;

beforeEach(() => {
    jest.clearAllMocks();
});

describe('RecommendedSettings title', () => {
    it('calls the summary recommended as it opens, before the saved settings load', async () => {
        await renderSummary(FRESH_INSTALL);

        expect(title()).toBe(RECOMMENDED);
    });

    it('calls the untouched defaults recommended', async () => {
        await openSummary(FRESH_INSTALL);

        expect(title()).toBe(RECOMMENDED);
    });

    it('calls the defaults recommended when nothing is saved yet', async () => {
        await openSummary({});

        expect(title()).toBe(RECOMMENDED);
    });

    it('calls the settings customized once fiat rates are turned off', async () => {
        await openSummary({ ...FRESH_INSTALL, fiatEnabled: false });

        expect(title()).toBe(CUSTOMIZED);
    });

    it('calls the settings customized once another currency is chosen', async () => {
        await openSummary({ ...FRESH_INSTALL, fiat: 'EUR' });

        expect(title()).toBe(CUSTOMIZED);
    });

    it('calls the settings customized once another rates source is chosen', async () => {
        await openSummary({ ...FRESH_INSTALL, fiatRatesSource: 'Yadio' });

        expect(title()).toBe(CUSTOMIZED);
    });

    it('calls the settings customized once clipboard reading is turned off', async () => {
        await openSummary({ ...FRESH_INSTALL, privacy: { clipboard: false } });

        expect(title()).toBe(CUSTOMIZED);
    });

    it('calls the settings customized for a self-custodial wallet', async () => {
        await openSummary(FRESH_INSTALL, { enableCashu: false });

        expect(title()).toBe(CUSTOMIZED);
    });

    it('calls the settings customized for Embedded LND', async () => {
        await openSummary(FRESH_INSTALL, { implementation: 'embedded-lnd' });

        expect(title()).toBe(CUSTOMIZED);
    });

    it('calls the settings customized for mints from all sources', async () => {
        await openSummary(FRESH_INSTALL, { discoverMode: 'all' });

        expect(title()).toBe(CUSTOMIZED);
    });

    // The summary loads the saved settings again each time it regains focus
    it.each([
        ['the currency changes back to USD', { fiat: 'EUR' }],
        ['fiat rates are turned back on', { fiatEnabled: false }]
    ])('calls the defaults recommended again once %s', async (_, change) => {
        const saved: any = { ...FRESH_INSTALL, ...change };
        const { focus } = await renderSummary(saved);
        await focus();
        expect(title()).toBe(CUSTOMIZED);

        Object.assign(saved, FRESH_INSTALL);
        await focus();

        expect(title()).toBe(RECOMMENDED);
    });
});

describe('RecommendedSettings Create wallet', () => {
    const createWallet = async () =>
        await fireEvent.press(
            screen.getByText('views.RecommendedSettings.createWallet')
        );

    it('passes the defaults when pressed before the saved settings load', async () => {
        await renderSummary(FRESH_INSTALL);

        await createWallet();

        expect(createOnboardingWallet).toHaveBeenCalledWith(
            expect.objectContaining({
                fiatEnabled: true,
                selectedCurrency: 'USD',
                fiatRatesSource: 'Zeus',
                clipboard: true
            })
        );
    });

    it('passes the saved choices once they load', async () => {
        await openSummary({
            fiatEnabled: false,
            fiat: 'EUR',
            fiatRatesSource: 'Yadio',
            privacy: { clipboard: false }
        });

        await createWallet();

        expect(createOnboardingWallet).toHaveBeenCalledWith(
            expect.objectContaining({
                fiatEnabled: false,
                selectedCurrency: 'EUR',
                fiatRatesSource: 'Yadio',
                clipboard: false
            })
        );
    });
});

describe('RecommendedSettings returning from an editor', () => {
    it('keeps the node and fetches the mints when switched to ecash', async () => {
        // the questionnaire's self-custody path, with Embedded LND
        const { CashuStore, returnWith } = await openSummary(FRESH_INSTALL, {
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
        const { CashuStore, returnWith } = await openSummary(FRESH_INSTALL, {
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
        const { CashuStore, returnWith } = await openSummary(FRESH_INSTALL);

        // MintDiscovery, with an npub whose follows recommend no mints
        await returnWith({ discoverMode: 'custom', initialMintUrls: [] });
        // WalletType: self-custody, then ecash again
        await returnWith({ enableCashu: false });
        await returnWith({ enableCashu: true });

        // only the fetch on mount
        expect(CashuStore.fetchMintsFromFollows).toHaveBeenCalledTimes(1);
    });

    it('does not fetch the ZEUS follows over mints from all sources', async () => {
        const { CashuStore, returnWith } = await openSummary(FRESH_INSTALL, {
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
        const { returnWith } = await openSummary(FRESH_INSTALL, {
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
