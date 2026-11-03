jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('@rneui/themed', () => ({ ButtonGroup: 'ButtonGroup' }));
jest.mock('../../stores/CashuStore', () => ({}));
jest.mock('../../stores/ChannelsStore', () => ({}));
jest.mock('../../stores/ModalStore', () => ({}));
jest.mock('../../stores/Stores', () => ({
    activityStore: {},
    settingsStore: { settings: { ecash: { enableCashu: true } } }
}));
jest.mock('../../models/CashuToken', () => ({}));
jest.mock('../../components/Amount', () => 'Amount');
jest.mock('../../components/AnimatedQRDisplay', () => 'AnimatedQRDisplay');
jest.mock('../../components/Button', () => 'Button');
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/KeyValue', () => 'KeyValue');
jest.mock('../../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../../components/Text', () => {
    const { Text } = require('react-native');
    return ({ children }: any) => <Text>{children}</Text>;
});
jest.mock('../../components/SuccessErrorMessage', () => {
    const { Text } = require('react-native');
    return {
        SuccessMessage: ({ message }: any) => <Text>{message}</Text>,
        WarningMessage: ({ message }: any) => <Text>{message}</Text>,
        ErrorMessage: ({ message }: any) => <Text>{message}</Text>
    };
});
jest.mock('../../utils/AddressUtils', () => ({
    ZEUS_ECASH_GIFT_URL: 'https://gift/'
}));
jest.mock('../../utils/BackendUtils', () => ({
    supportsCashuWallet: () => true,
    supportsChannelManagement: () => false
}));
jest.mock('../../utils/buttonGroupStyles', () => ({
    getButtonGroupStyles: () => ({})
}));
jest.mock('../../utils/DateTimeUtils', () => ({}));
jest.mock('../../utils/LocaleUtils');
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: (key: string) => `theme:${key}`
}));
jest.mock('../../utils/UrlUtils', () => ({}));

import * as React from 'react';
import { render, screen } from '@testing-library/react-native';
import CashuTokenView from './CashuToken';

const SAVE_FAILED = 'views.Cashu.CashuToken.saveFailed';

const sentToken = {
    memo: '',
    mint: 'https://a.mint',
    unit: 'sat',
    proofs: [],
    getAmount: 1000,
    isSupported: true,
    received: false,
    sent: true,
    spent: false,
    pendingClaim: false,
    encodedToken: 'cashuBtoken',
    getDisplayTime: ''
};

const renderView = (params: Record<string, any>) =>
    render(
        <CashuTokenView
            navigation={{ navigate: jest.fn(), popTo: jest.fn() } as any}
            route={
                {
                    params: {
                        token: 'cashuBtoken',
                        decoded: sentToken,
                        ...params
                    }
                } as any
            }
            CashuStore={
                {
                    // no added mints, so the view does not poll for spent state
                    mintUrls: [],
                    cashuWallets: {},
                    clearToken: jest.fn(),
                    checkTokenSpent: jest.fn(),
                    markTokenSpent: jest.fn(),
                    initializeWallet: jest.fn(),
                    claimToken: jest.fn(),
                    loading: false,
                    errorAddingMint: false,
                    error_msg: undefined
                } as any
            }
            ChannelsStore={{ channels: [] } as any}
        />
    );

describe('CashuToken save failure warning', () => {
    it('warns that the token was not saved when the send could not record it', async () => {
        await renderView({ startOnQrTab: true, saveFailed: true });

        expect(screen.getByText(SAVE_FAILED)).toBeOnTheScreen();
    });

    it('shows no warning for a token that was saved', async () => {
        await renderView({ startOnQrTab: true, saveFailed: false });

        expect(screen.queryByText(SAVE_FAILED)).not.toBeOnTheScreen();
    });

    it('shows no warning when opened from activity', async () => {
        await renderView({});

        expect(screen.queryByText(SAVE_FAILED)).not.toBeOnTheScreen();
    });
});
