// The POS settings warn when no lock is set, since POS mode relies on it.
// A PIN still in plaintext counts as set, one an older build deleted
// ('' beside its old verifier) does not.
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
jest.mock('../../components/Switch', () => 'Switch');
jest.mock('../../components/Text', () => 'Text');
jest.mock('../../components/TextInput', () => 'TextInput');
jest.mock('../../components/SuccessErrorMessage', () => {
    const { Text } = require('react-native');
    return {
        ErrorMessage: ({ message }: any) => <Text>{message}</Text>,
        WarningMessage: ({ message }: any) => <Text>{message}</Text>
    };
});

import * as React from 'react';
import { render, screen } from '@testing-library/react-native';

import PointOfSale from './PointOfSale';

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
