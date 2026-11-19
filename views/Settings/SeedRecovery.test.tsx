jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('@react-native-clipboard/clipboard', () => ({
    getString: jest.fn(() => Promise.resolve(''))
}));
jest.mock('react-native-fs', () => ({}));
jest.mock('@react-native-documents/picker', () => ({
    pick: jest.fn(),
    types: {},
    isErrorWithCode: jest.fn(),
    errorCodes: {}
}));
jest.mock('react-native-restart', () => ({ Restart: jest.fn() }));
jest.mock('../../stores/SettingsStore', () => ({
    DEFAULT_SWAP_HOST_MAINNET: '',
    DEFAULT_SWAP_HOST_TESTNET: '',
    SWAP_HOST_KEYS_MAINNET: [],
    SWAP_HOST_KEYS_TESTNET: [],
    EMBEDDED_NODE_NETWORK_KEYS: [],
    getLspConfigForNetwork: jest.fn(() => ({}))
}));
jest.mock('../../stores/ModalStore', () => ({}));
jest.mock('../../stores/NodeInfoStore', () => ({}));
jest.mock('../../stores/SwapStore', () => ({}));
jest.mock('../../storage', () => ({}));
jest.mock('../../utils/LocaleUtils');
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
jest.mock('../../utils/RestartUtils', () => ({ restartNeeded: jest.fn() }));
jest.mock('../../utils/ChannelMigrationUtils', () => ({}));
jest.mock('../../utils/LndMobileUtils', () => ({}));
jest.mock('../../utils/LdkNodeUtils', () => ({}));
jest.mock('../../utils/SwapUtils', () => ({}));
jest.mock('../../utils/AezeedUtils', () => ({}));
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
jest.mock('../../components/ModalBox', () => {
    const { View } = require('react-native');
    return ({ isOpen, children }: any) =>
        isOpen ? <View>{children}</View> : null;
});
jest.mock('../../components/PreventRemove', () => 'PreventRemove');
jest.mock('../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../../components/SuccessErrorMessage', () => ({
    ErrorMessage: 'ErrorMessage',
    SuccessMessage: 'SuccessMessage'
}));
jest.mock('../../components/Text', () => {
    const { Text } = require('react-native');
    return Text;
});
jest.mock('../../components/TextInput', () => {
    const { TextInput } = require('react-native');
    return ({ onChangeText }: any) => (
        <TextInput testID="seed-input" onChangeText={onChangeText} />
    );
});
jest.mock('../../assets/images/SVG/eye_closed.svg', () => 'EyeClosed');
jest.mock('../../assets/images/SVG/eye_opened.svg', () => 'EyeOpened');

import * as React from 'react';
import Clipboard from '@react-native-clipboard/clipboard';
import { fireEvent, render, screen } from '@testing-library/react-native';
import SeedRecovery from './SeedRecovery';

const SEED_24 =
    'abandon ability able about above absent absorb abstract absurd abuse access accident ' +
    'account accuse achieve acid acoustic acquire across act action actor actress actual';

const renderView = async (clipboard: string) => {
    (Clipboard.getString as jest.Mock).mockResolvedValue(clipboard);
    await render(
        <SeedRecovery
            {...({
                navigation: { navigate: jest.fn(), goBack: jest.fn() },
                route: { params: { network: 'mainnet' } },
                SettingsStore: {
                    settings: { privacy: { clipboard: true }, swaps: {} }
                },
                NodeInfoStore: { nodeInfo: {} },
                SwapStore: {},
                ModalStore: {}
            } as any)}
        />
    );
};

const MASK = '********';
const WORDS = SEED_24.split(' ');

describe('SeedRecovery clipboard prompt', () => {
    it('warns that other apps can write to the clipboard', async () => {
        await renderView(SEED_24);

        expect(
            screen.getByText(
                'views.Settings.SeedRecovery.clipboardSeedWordsWarning'
            )
        ).toBeOnTheScreen();
    });

    it('does not prompt for clipboard text of another length', async () => {
        await renderView('abandon ability able');

        expect(
            screen.queryByText('views.Settings.SeedRecovery.clipboardSeedWords')
        ).not.toBeOnTheScreen();
    });

    it('shows the copied words in the grid after accepting them', async () => {
        await renderView(SEED_24);

        await fireEvent.press(screen.getByText('general.yes'));

        expect(
            screen.queryByText('views.Settings.SeedRecovery.clipboardSeedWords')
        ).not.toBeOnTheScreen();
        WORDS.forEach((word) => {
            expect(screen.getByText(word)).toBeOnTheScreen();
        });
        expect(screen.queryAllByText(MASK)).toHaveLength(0);
        expect(screen.getByText('general.hide')).toBeOnTheScreen();
    });

    it('masks and reveals the accepted words with the toggle', async () => {
        await renderView(SEED_24);
        await fireEvent.press(screen.getByText('general.yes'));

        await fireEvent.press(screen.getByText('general.hide'));

        expect(screen.getAllByText(MASK)).toHaveLength(24);
        WORDS.forEach((word) => {
            expect(screen.queryByText(word)).not.toBeOnTheScreen();
        });

        await fireEvent.press(screen.getByText('general.show'));

        expect(screen.queryAllByText(MASK)).toHaveLength(0);
        expect(screen.getByText(WORDS[23])).toBeOnTheScreen();
    });

    it('leaves the grid empty when the prompt is cancelled', async () => {
        await renderView(SEED_24);

        await fireEvent.press(screen.getByText('general.cancel'));
        await fireEvent.press(screen.getByText('general.show'));

        expect(screen.queryAllByText(MASK)).toHaveLength(0);
        WORDS.forEach((word) => {
            expect(screen.queryByText(word)).not.toBeOnTheScreen();
        });
    });
});

describe('SeedRecovery typed words', () => {
    it('masks a typed word until the toggle reveals it', async () => {
        await renderView('');

        await fireEvent.press(screen.getByText('1'));
        await fireEvent.changeText(screen.getByTestId('seed-input'), 'abandon');
        // pick the suggestion, which fills field 1 and moves to field 2
        await fireEvent.press(screen.getByText('abandon'));

        expect(screen.getAllByText(MASK)).toHaveLength(1);
        expect(screen.queryByText('abandon')).not.toBeOnTheScreen();

        await fireEvent.press(screen.getByText('general.show'));

        expect(screen.queryAllByText(MASK)).toHaveLength(0);
        expect(screen.getByText('abandon')).toBeOnTheScreen();
    });
});
