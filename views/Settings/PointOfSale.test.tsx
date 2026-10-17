jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../../stores/SettingsStore', () => ({
    PosEnabled: {
        Disabled: 'disabled',
        Square: 'square',
        Standalone: 'standalone'
    },
    POS_ENABLED_KEYS: [],
    POS_CONF_PREF_KEYS: [],
    DEFAULT_VIEW_KEYS_POS: []
}));
jest.mock('../../utils/BackendUtils', () => ({
    __esModule: true,
    default: { isLNDBased: () => true }
}));
jest.mock('../../utils/LocaleUtils');
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
jest.mock('../../assets/images/SVG/Caret Right.svg', () => 'CaretRight');
jest.mock('../../components/DropdownSetting', () => 'DropdownSetting');
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/layout/Row', () => ({ Row: 'Row' }));
jest.mock('../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../../components/ShowHideToggle', () => {
    const { Pressable } = require('react-native');
    return ({ onPress }: any) => (
        <Pressable testID="show-hide-toggle" onPress={onPress} />
    );
});
jest.mock('../../components/Switch', () => 'Switch');
jest.mock('../../components/Text', () => 'Text');
jest.mock('../../components/TextInput', () => {
    const { TextInput } = require('react-native');
    return (props: any) => <TextInput {...props} />;
});
jest.mock('../../components/SuccessErrorMessage', () => {
    const { Text } = require('react-native');
    return {
        ErrorMessage: ({ message }: any) => <Text>{message}</Text>,
        WarningMessage: ({ message }: any) => <Text>{message}</Text>
    };
});

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import PointOfSale from './PointOfSale';

// The POS settings warn when no lock is set, since POS mode relies on it.
// A PIN still in plaintext counts as set, one an older build deleted
// ('' beside its old verifier) does not.
const AUTH_WARNING = 'pos.views.Settings.PointOfSale.authWarning';
const record = { v: 1, kdf: 'pbkdf2-sha256', salt: 'aa', hash: 'bb' };

const renderPointOfSale = async (settings: any) =>
    render(
        <PointOfSale
            SettingsStore={
                {
                    settings,
                    getSettings: jest.fn(async () => settings),
                    flushPendingSettings: jest.fn(),
                    updateSettingsGroup: jest.fn(),
                    updateSettingsGroupDebounced: jest.fn()
                } as any
            }
            navigation={{ navigate: jest.fn() } as any}
        />
    );

describe('PointOfSale lock warning', () => {
    it.each([
        ['a PIN still in plaintext', { pin: '1234' }],
        ['a PIN verifier', { pinVerifier: record }],
        ['a passphrase still in plaintext', { passphrase: 'open sesame' }]
    ])('is not shown with %s', async (_, settings) => {
        await renderPointOfSale(settings);

        expect(screen.queryByText(AUTH_WARNING)).toBeNull();
    });

    it.each([
        ['no lock', {}],
        ['a PIN an older build deleted', { pinVerifier: record, pin: '' }]
    ])('is shown with %s', async (_, settings) => {
        await renderPointOfSale(settings);

        expect(screen.getByText(AUTH_WARNING)).toBeTruthy();
    });
});

const SQUARE_ACCESS_TOKEN = 'EAAAl-square-access-token';

const renderView = async () => {
    const settings = {
        fiatEnabled: true,
        pos: {
            posEnabled: 'square',
            squareAccessToken: SQUARE_ACCESS_TOKEN
        }
    };
    const SettingsStore = {
        settings,
        getSettings: jest.fn(async () => settings),
        flushPendingSettings: jest.fn(),
        updateSettingsGroup: jest.fn(),
        updateSettingsGroupDebounced: jest.fn()
    };
    await render(
        <PointOfSale
            navigation={{ navigate: jest.fn() } as any}
            SettingsStore={SettingsStore as any}
        />
    );
    return SettingsStore;
};

describe('PointOfSale Square access token', () => {
    it('masks the stored Square access token when the screen opens', async () => {
        await renderView();

        expect(
            screen.getByDisplayValue(SQUARE_ACCESS_TOKEN).props.secureTextEntry
        ).toBe(true);
    });

    it('shows the Square access token after the show/hide toggle is pressed', async () => {
        await renderView();

        await fireEvent.press(screen.getByTestId('show-hide-toggle'));

        expect(
            screen.getByDisplayValue(SQUARE_ACCESS_TOKEN).props.secureTextEntry
        ).toBe(false);
    });

    it('still saves an edited Square access token', async () => {
        const SettingsStore = await renderView();

        await fireEvent.changeText(
            screen.getByDisplayValue(SQUARE_ACCESS_TOKEN),
            'EAAAl-new-token'
        );

        expect(SettingsStore.updateSettingsGroupDebounced).toHaveBeenCalledWith(
            'pos',
            { squareAccessToken: 'EAAAl-new-token' }
        );
    });
});
