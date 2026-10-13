jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('@rneui/themed', () => ({
    Chip: 'Chip',
    Icon: 'Icon',
    ButtonGroup: 'ButtonGroup'
}));
jest.mock('@react-native-clipboard/clipboard', () => ({
    getString: jest.fn()
}));
jest.mock('../../utils/AddressUtils', () => ({
    isValidLightningPubKey: (pubkey: string) => /^02a{64}$/.test(pubkey)
}));
jest.mock('../../utils/LocaleUtils');
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: (key: string) => `theme:${key}`
}));
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../../components/Text', () => {
    const { Text } = require('react-native');
    return ({ children }: any) => <Text>{children}</Text>;
});
jest.mock('../../components/TextInput', () => {
    const { TextInput } = require('react-native');
    return (props: any) => <TextInput {...props} />;
});
jest.mock('../../components/Button', () => {
    const { Pressable, Text } = require('react-native');
    return ({ title, onPress }: any) => (
        <Pressable role="button" onPress={onPress}>
            <Text>{title}</Text>
        </Pressable>
    );
});
jest.mock('../../components/SuccessErrorMessage', () => {
    const { Text } = require('react-native');
    return {
        ErrorMessage: ({ message }: any) => <Text>{message}</Text>
    };
});
jest.mock('../../components/DropdownSetting', () => 'DropdownSetting');
jest.mock('../../assets/images/SVG/Scan.svg', () => 'Scan');
jest.mock('../../assets/images/SVG/PeersContact.svg', () => 'ContactIcon');
jest.mock('./SendEcash', () => ({}));

import * as React from 'react';
import Clipboard from '@react-native-clipboard/clipboard';
import { fireEvent, render, screen } from '@testing-library/react-native';
import CashuLockSettings from './CashuLockSettings';

const PUBKEY =
    '02aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

const renderView = (clipboard: boolean) =>
    render(
        <CashuLockSettings
            navigation={
                {
                    navigate: jest.fn(),
                    addListener: jest.fn(),
                    removeListener: jest.fn(),
                    replaceParams: jest.fn()
                } as any
            }
            route={{ params: {} } as any}
            ContactStore={{} as any}
            SettingsStore={{ settings: { privacy: { clipboard } } } as any}
        />
    );

const pubkeyInput = () => screen.getByPlaceholderText('02abc...');
const pasteButton = () => screen.getByRole('button', { name: 'general.paste' });
const queryPasteButton = () =>
    screen.queryByRole('button', { name: 'general.paste' });

// the field turns red when the pubkey is invalid
const expectPubkeyMarked = (valid: boolean) =>
    expect(pubkeyInput()).toHaveProp(
        'textColor',
        valid ? 'theme:text' : 'theme:delete'
    );

const focusPubkey = () => fireEvent(pubkeyInput(), 'focus');

describe('CashuLockSettings clipboard', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (Clipboard.getString as jest.Mock).mockResolvedValue(PUBKEY);
    });

    describe('with clipboard reading off', () => {
        it('shows the paste button on focus without reading the clipboard', async () => {
            await renderView(false);
            expect(queryPasteButton()).not.toBeOnTheScreen();

            await focusPubkey();

            expect(Clipboard.getString).not.toHaveBeenCalled();
            expect(pasteButton()).toBeOnTheScreen();
        });

        it('shows the paste button when the field is cleared without reading the clipboard', async () => {
            await renderView(false);

            await fireEvent.changeText(pubkeyInput(), 'x');
            await fireEvent.changeText(pubkeyInput(), '');

            expect(Clipboard.getString).not.toHaveBeenCalled();
            expect(pasteButton()).toBeOnTheScreen();
        });

        it('reads the clipboard when the paste button is pressed', async () => {
            await renderView(false);
            await focusPubkey();

            await fireEvent.press(pasteButton());

            expect(Clipboard.getString).toHaveBeenCalledTimes(1);
            expect(pubkeyInput()).toHaveDisplayValue(PUBKEY);
            expectPubkeyMarked(true);
            expect(queryPasteButton()).not.toBeOnTheScreen();
        });

        it('says the clipboard is empty when paste is pressed with nothing copied', async () => {
            (Clipboard.getString as jest.Mock).mockResolvedValue('');
            await renderView(false);
            await focusPubkey();

            await fireEvent.press(pasteButton());

            expect(
                screen.getByText('general.clipboardEmpty')
            ).toBeOnTheScreen();
            expect(pubkeyInput()).toHaveDisplayValue('');
            // the field was not touched, so it is not marked invalid
            expectPubkeyMarked(true);
        });

        it('treats whitespace-only clipboard text as empty', async () => {
            (Clipboard.getString as jest.Mock).mockResolvedValue('  \n ');
            await renderView(false);
            await focusPubkey();

            await fireEvent.press(pasteButton());

            expect(
                screen.getByText('general.clipboardEmpty')
            ).toBeOnTheScreen();
            expect(pubkeyInput()).toHaveDisplayValue('');
        });

        it('shows the pubkey error when the clipboard holds something else', async () => {
            (Clipboard.getString as jest.Mock).mockResolvedValue('not a key');
            await renderView(false);
            await focusPubkey();

            await fireEvent.press(pasteButton());

            expect(
                screen.getByText('cashu.invalidCashuPubkey')
            ).toBeOnTheScreen();
            expect(pubkeyInput()).toHaveDisplayValue('');
            expectPubkeyMarked(false);
        });

        it('reports a clipboard read failure', async () => {
            (Clipboard.getString as jest.Mock).mockRejectedValue(
                new Error('denied')
            );
            await renderView(false);
            await focusPubkey();

            await fireEvent.press(pasteButton());

            expect(
                screen.getByText('general.clipboardError')
            ).toBeOnTheScreen();
            expect(queryPasteButton()).not.toBeOnTheScreen();
        });
    });

    describe('with clipboard reading on', () => {
        it('shows the paste button when the clipboard has text', async () => {
            await renderView(true);

            await focusPubkey();

            expect(Clipboard.getString).toHaveBeenCalledTimes(1);
            expect(pasteButton()).toBeOnTheScreen();
        });

        it('hides the paste button when the clipboard is empty', async () => {
            (Clipboard.getString as jest.Mock).mockResolvedValue('');
            await renderView(true);

            await focusPubkey();

            expect(queryPasteButton()).not.toBeOnTheScreen();
        });

        it('hides the paste button when the clipboard read fails', async () => {
            (Clipboard.getString as jest.Mock).mockRejectedValue(
                new Error('denied')
            );
            await renderView(true);

            await focusPubkey();

            expect(queryPasteButton()).not.toBeOnTheScreen();
        });
    });
});
