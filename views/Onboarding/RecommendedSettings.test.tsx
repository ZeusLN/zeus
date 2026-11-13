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
jest.mock('../../components/Button', () => 'Button');
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
import { act, render, screen } from '@testing-library/react-native';
import RecommendedSettings from './RecommendedSettings';

const RECOMMENDED = 'views.RecommendedSettings.title';
const CUSTOMIZED = 'views.RecommendedSettings.titleCustomized';

// What a fresh install stores before onboarding changes anything
const FRESH_INSTALL = { fiatEnabled: true, privacy: { clipboard: true } };

// Renders the summary, then gains focus with the saved settings, as it
// does when it first opens and on every return from a sub-screen
const openSummary = async (saved: any, params: any = {}) => {
    let onFocus: () => Promise<void> = async () => {};
    const navigation = {
        addListener: jest.fn((event: string, listener: any) => {
            if (event === 'focus') onFocus = listener;
        }),
        navigate: jest.fn()
    };
    const CashuStore = {
        restoreCachedRecommendations: jest.fn(() => true),
        fetchMintsFromFollows: jest.fn(),
        getTopScoredMints: jest.fn(() => []),
        mintInfoCache: new Map(),
        fetchMintInfoBatch: jest.fn(),
        loading: false,
        loadingTrustedMints: false
    };
    const SettingsStore = { getSettings: jest.fn(async () => saved) };
    await render(
        <RecommendedSettings
            navigation={navigation as any}
            route={{ params } as any}
            CashuStore={CashuStore as any}
            SettingsStore={SettingsStore as any}
        />
    );
    await act(() => onFocus());
};

const title = () => screen.getByTestId('title').props.children;

describe('RecommendedSettings title', () => {
    it('calls the untouched defaults recommended', async () => {
        await openSummary(FRESH_INSTALL);

        expect(title()).toBe(RECOMMENDED);
    });

    it('calls the settings customized once fiat rates are turned off', async () => {
        await openSummary({ ...FRESH_INSTALL, fiatEnabled: false });

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
});
