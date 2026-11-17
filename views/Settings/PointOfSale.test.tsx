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
    return (props: any) => <TextInput {...props} editable={!props.locked} />;
});
jest.mock('../../components/SuccessErrorMessage', () => {
    const { Text } = require('react-native');
    return {
        ErrorMessage: ({ message }: any) => <Text>{message}</Text>,
        WarningMessage: ({ message }: any) => <Text>{message}</Text>
    };
});

import * as React from 'react';
import { Keyboard } from 'react-native';
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

const renderView = async (squareAccessToken = SQUARE_ACCESS_TOKEN) => {
    const settings = {
        fiatEnabled: true,
        pos: {
            posEnabled: 'square',
            squareAccessToken
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

    it('does not change the stored Square access token when typing while it is masked', async () => {
        const SettingsStore = await renderView();

        await fireEvent.changeText(
            screen.getByDisplayValue(SQUARE_ACCESS_TOKEN),
            'X'
        );

        expect(
            SettingsStore.updateSettingsGroupDebounced
        ).not.toHaveBeenCalled();
        expect(screen.getByDisplayValue(SQUARE_ACCESS_TOKEN)).toBeTruthy();
    });

    it('lets a first Square access token be typed while the field is masked', async () => {
        const SettingsStore = await renderView('');
        const input = screen
            .getAllByDisplayValue('')
            .find((element) => element.props.secureTextEntry)!;

        await fireEvent(input, 'focus');
        await fireEvent.changeText(input, 'E');
        await fireEvent.changeText(screen.getByDisplayValue('E'), 'EA');

        expect(
            SettingsStore.updateSettingsGroupDebounced
        ).toHaveBeenLastCalledWith('pos', { squareAccessToken: 'EA' });
        expect(screen.getByDisplayValue('EA').props.editable).toBe(true);
        expect(screen.getByDisplayValue('EA').props.secureTextEntry).toBe(true);
    });

    it('locks the Square access token when it is hidden again while focused', async () => {
        const SettingsStore = await renderView();
        const toggle = screen.getByTestId('show-hide-toggle');

        await fireEvent.press(toggle);
        await fireEvent(screen.getByDisplayValue(SQUARE_ACCESS_TOKEN), 'focus');
        await fireEvent.press(toggle);
        await fireEvent.changeText(
            screen.getByDisplayValue(SQUARE_ACCESS_TOKEN),
            'X'
        );

        const input = screen.getByDisplayValue(SQUARE_ACCESS_TOKEN);
        expect(
            SettingsStore.updateSettingsGroupDebounced
        ).not.toHaveBeenCalled();
        expect(input.props.editable).toBe(false);
        expect(input.props.secureTextEntry).toBe(true);
    });

    it('leaves the keyboard open when a Square access token that is not focused is hidden', async () => {
        const dismiss = jest.spyOn(Keyboard, 'dismiss');
        await renderView();
        const toggle = screen.getByTestId('show-hide-toggle');

        await fireEvent.press(toggle);
        await fireEvent.press(toggle);

        const input = screen.getByDisplayValue(SQUARE_ACCESS_TOKEN);
        expect(dismiss).not.toHaveBeenCalled();
        expect(input.props.editable).toBe(false);
        expect(input.props.secureTextEntry).toBe(true);

        dismiss.mockRestore();
    });

    it('leaves the keyboard open when the Square access token lost focus before it is hidden', async () => {
        const dismiss = jest.spyOn(Keyboard, 'dismiss');
        await renderView();
        const toggle = screen.getByTestId('show-hide-toggle');

        await fireEvent.press(toggle);
        await fireEvent(screen.getByDisplayValue(SQUARE_ACCESS_TOKEN), 'focus');
        await fireEvent(screen.getByDisplayValue(SQUARE_ACCESS_TOKEN), 'blur');
        await fireEvent.press(toggle);

        expect(dismiss).not.toHaveBeenCalled();
        expect(
            screen.getByDisplayValue(SQUARE_ACCESS_TOKEN).props.editable
        ).toBe(false);

        dismiss.mockRestore();
    });

    it('dismisses the keyboard when a focused Square access token is hidden, not when it is shown', async () => {
        const dismiss = jest.spyOn(Keyboard, 'dismiss');
        await renderView();
        const toggle = screen.getByTestId('show-hide-toggle');

        await fireEvent.press(toggle);
        await fireEvent(screen.getByDisplayValue(SQUARE_ACCESS_TOKEN), 'focus');
        expect(dismiss).not.toHaveBeenCalled();

        await fireEvent.press(toggle);

        const input = screen.getByDisplayValue(SQUARE_ACCESS_TOKEN);
        expect(dismiss).toHaveBeenCalledTimes(1);
        expect(input.props.editable).toBe(false);
        expect(input.props.secureTextEntry).toBe(true);

        dismiss.mockRestore();
    });

    it('saves Square access token edits again after it is hidden and shown again', async () => {
        const SettingsStore = await renderView();
        const toggle = screen.getByTestId('show-hide-toggle');

        await fireEvent.press(toggle);
        await fireEvent(screen.getByDisplayValue(SQUARE_ACCESS_TOKEN), 'focus');
        await fireEvent.press(toggle);
        await fireEvent.press(toggle);
        await fireEvent.changeText(
            screen.getByDisplayValue(SQUARE_ACCESS_TOKEN),
            'EAAAl-second-token'
        );

        const input = screen.getByDisplayValue('EAAAl-second-token');
        expect(SettingsStore.updateSettingsGroupDebounced).toHaveBeenCalledWith(
            'pos',
            { squareAccessToken: 'EAAAl-second-token' }
        );
        expect(input.props.editable).toBe(true);
        expect(input.props.secureTextEntry).toBe(false);
    });

    it('locks a first Square access token once it is shown and hidden again', async () => {
        const SettingsStore = await renderView('');
        const toggle = screen.getByTestId('show-hide-toggle');
        const input = screen
            .getAllByDisplayValue('')
            .find((element) => element.props.secureTextEntry)!;

        await fireEvent(input, 'focus');
        await fireEvent.changeText(input, 'EA');
        await fireEvent.press(toggle);
        await fireEvent.press(toggle);
        await fireEvent.changeText(screen.getByDisplayValue('EA'), 'EAX');

        const stored = screen.getByDisplayValue('EA');
        expect(
            SettingsStore.updateSettingsGroupDebounced
        ).toHaveBeenLastCalledWith('pos', { squareAccessToken: 'EA' });
        expect(stored.props.editable).toBe(false);
        expect(stored.props.secureTextEntry).toBe(true);
    });

    it('still saves an edited Square access token once it is shown', async () => {
        const SettingsStore = await renderView();

        await fireEvent.press(screen.getByTestId('show-hide-toggle'));
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
