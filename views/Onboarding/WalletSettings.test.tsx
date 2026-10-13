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
            Title: ({ children }: any) => <Text>{children}</Text>
        })
    };
});
jest.mock('../../stores/SettingsStore', () => ({
    CURRENCY_KEYS: [],
    DEFAULT_FIAT: 'USD',
    DEFAULT_FIAT_RATES_SOURCE: 'Zeus',
    FIAT_RATES_SOURCE_KEYS: []
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
jest.mock('../../components/DropdownSetting', () => 'DropdownSetting');
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../../components/Text', () => {
    const { Text } = require('react-native');
    return ({ children }: any) => <Text>{children}</Text>;
});

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import WalletSettings from './WalletSettings';
import { createOnboardingWallet } from '../../utils/WalletCreationUtils';

const renderView = async (saved: any, params: any = {}) => {
    const SettingsStore = {
        settings: {},
        getSettings: jest.fn(async () => saved),
        updateSettings: jest.fn(),
        updateSettingsGroup: jest.fn()
    };
    const navigation = {
        addListener: jest.fn(),
        navigate: jest.fn(),
        reset: jest.fn()
    };
    await render(
        <WalletSettings
            navigation={navigation as any}
            route={{ params } as any}
            SettingsStore={SettingsStore as any}
        />
    );
    return { SettingsStore, navigation };
};

// the clipboard row comes before the fiat row
const switches = () => {
    expect(
        screen.getByText('views.Settings.Privacy.clipboard')
    ).toBeOnTheScreen();
    const [clipboard, fiat] = screen.getAllByRole('switch');
    return { clipboard, fiat };
};

const flip = (sw: any, value: boolean) =>
    fireEvent(sw, 'change', { nativeEvent: { value } });

describe('onboarding WalletSettings', () => {
    beforeEach(() => {
        (createOnboardingWallet as jest.Mock).mockReset();
    });

    it.each([
        [true, false],
        [false, true]
    ])(
        'shows a saved clipboard of %s and fiat of %s',
        async (savedClipboard, savedFiat) => {
            await renderView({
                privacy: { clipboard: savedClipboard },
                fiatEnabled: savedFiat
            });

            const { clipboard, fiat } = switches();
            expect(clipboard).toHaveProp('value', savedClipboard);
            expect(fiat).toHaveProp('value', savedFiat);
        }
    );

    it('defaults clipboard and fiat on for new settings', async () => {
        await renderView({});

        const { clipboard, fiat } = switches();
        expect(clipboard).toBeChecked();
        expect(fiat).toBeChecked();
    });

    it('merges the clipboard switch into the privacy group', async () => {
        const { SettingsStore } = await renderView({
            privacy: { clipboard: true },
            fiatEnabled: false
        });

        await flip(switches().clipboard, false);

        // A bare `privacy: { clipboard }` write would replace the whole
        // group (mempool instance, block explorer, lurker mode)
        expect(SettingsStore.updateSettings).not.toHaveBeenCalled();
        expect(SettingsStore.updateSettingsGroup).toHaveBeenCalledWith(
            'privacy',
            { clipboard: false }
        );
        expect(switches().clipboard).not.toBeChecked();
    });

    it('saves the fiat switch at the top level', async () => {
        const { SettingsStore } = await renderView({ fiatEnabled: false });

        await flip(switches().fiat, true);

        expect(SettingsStore.updateSettings).toHaveBeenCalledWith({
            fiatEnabled: true
        });
        expect(switches().fiat).toBeChecked();
    });

    it('creates the wallet with the choices on screen', async () => {
        const { SettingsStore } = await renderView(
            { privacy: { clipboard: true }, fiatEnabled: true, fiat: 'EUR' },
            { enableCashu: true, implementation: 'embedded-lnd' }
        );
        await flip(switches().clipboard, false);

        await fireEvent.press(
            screen.getByRole('button', {
                name: 'views.WalletSettings.createWallet'
            })
        );

        expect(createOnboardingWallet).toHaveBeenCalledWith(
            expect.objectContaining({
                settingsStore: SettingsStore,
                enableCashu: true,
                implementation: 'embedded-lnd',
                clipboard: false,
                fiatEnabled: true,
                selectedCurrency: 'EUR',
                fiatRatesSource: 'Zeus'
            })
        );
    });
});
