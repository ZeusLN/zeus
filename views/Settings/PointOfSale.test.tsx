jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../../stores/SettingsStore', () => ({
    DEFAULT_VIEW_KEYS_POS: [],
    POS_CONF_PREF_KEYS: [],
    POS_ENABLED_KEYS: [],
    PosEnabled: {
        Disabled: 'disabled',
        Square: 'square',
        Standalone: 'standalone'
    }
}));
jest.mock('../../utils/BackendUtils', () => ({
    isLNDBased: () => true
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
jest.mock('../../components/SuccessErrorMessage', () => ({
    ErrorMessage: 'ErrorMessage',
    WarningMessage: 'WarningMessage'
}));
jest.mock('../../components/Switch', () => 'Switch');
jest.mock('../../components/Text', () => 'Text');
jest.mock('../../components/TextInput', () => {
    const { TextInput } = require('react-native');
    return (props: any) => <TextInput {...props} editable={!props.locked} />;
});

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import PointOfSale from './PointOfSale';

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

describe('PointOfSale', () => {
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
