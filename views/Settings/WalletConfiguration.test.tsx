jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('@react-native-clipboard/clipboard', () => ({
    getString: jest.fn(() => Promise.resolve('')),
    setString: jest.fn()
}));
jest.mock('../../backends/LNC/credentialStore', () => ({
    hash: jest.fn(),
    LNC_STORAGE_KEY: 'lnc'
}));
jest.mock('../../stores/Stores');
jest.mock('../../stores/SettingsStore', () => ({
    INTERFACE_KEYS: [],
    LNC_MAILBOX_KEYS: [],
    EMBEDDED_NODE_NETWORK_KEYS: [],
    BLOCK_EXPLORER_KEYS: [],
    DEFAULT_MEMPOOL_INSTANCE: 'https://mempool.space',
    MEMPOOL_INSTANCE_KEYS: [],
    getLspConfigForNetwork: jest.fn()
}));
jest.mock('../../utils/BackendUtils', () => ({}));
jest.mock('../../utils/LocaleUtils');
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
jest.mock('../../utils/ActionUtils', () => ({
    confirmAction: jest.fn()
}));
jest.mock('../../utils/NavigationUtils', () => ({
    reAuthNavigation: jest.fn()
}));
jest.mock('../../utils/PhotoUtils', () => ({ getPhoto: jest.fn() }));
jest.mock('../../utils/DataClearUtils', () => ({}));
jest.mock('../../utils/LndMobileUtils', () => ({}));
jest.mock('../../utils/LdkNodeUtils', () => ({
    getDefaultEsploraServer: jest.fn(() => ''),
    getDefaultRgsServer: jest.fn(() => ''),
    DEFAULT_VSS_SERVER: '',
    DEFAULT_SCORER_URL: ''
}));
jest.mock('../../storage', () => ({
    getItem: jest.fn(() => Promise.resolve(null))
}));
jest.mock('../../components/Button', () => {
    const { Pressable, Text } = require('react-native');
    return ({ title, onPress, disabled }: any) => (
        <Pressable role="button" onPress={onPress} disabled={disabled}>
            <Text>{title}</Text>
        </Pressable>
    );
});
jest.mock('../../components/CollapsedQR', () => 'CollapsedQR');
jest.mock('../../components/DropdownSetting', () => 'DropdownSetting');
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/KeyValue', () => 'KeyValue');
jest.mock('../../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../../components/Pill', () => 'Pill');
jest.mock('../../components/Screen', () => 'Screen');
jest.mock('../../components/SuccessErrorMessage', () => ({
    ErrorMessage: 'ErrorMessage',
    WarningMessage: 'WarningMessage'
}));
jest.mock('../../components/Switch', () => 'Switch');
jest.mock('../../components/TextInput', () => {
    const { TextInput } = require('react-native');
    return (props: any) => <TextInput {...props} />;
});
jest.mock('../../components/Accordion', () => 'Accordion');
jest.mock('../../components/VssServerPicker', () => ({
    __esModule: true,
    default: 'VssServerPicker',
    isVssServerValid: () => true
}));
jest.mock('../../components/layout/Row', () => ({ Row: 'Row' }));
jest.mock('../../components/ShowHideToggle', () => 'ShowHideToggle');
jest.mock('../../assets/images/SVG/Scan.svg', () => 'Scan');
jest.mock('../../assets/images/SVG/Add.svg', () => 'AddIcon');

import * as React from 'react';
import Clipboard from '@react-native-clipboard/clipboard';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import WalletConfiguration from './WalletConfiguration';
import { confirmAction } from '../../utils/ActionUtils';
import Storage from '../../storage';

const LNDHUB_IMPORT = 'lndhub://alice:secret@https://lndhub.example.com';

// Opens the screen on an existing node at index 1, so a save neither
// reconnects (the active node is 0) nor creates a new entry
const renderView = async (
    node: any,
    { clipboard = false }: { clipboard?: boolean } = {}
) => {
    const updateSettings = jest.fn(() => Promise.resolve());
    const SettingsStore = {
        settings: { privacy: { clipboard }, selectedNode: 0 },
        updateSettings,
        setConnectingStatus: jest.fn()
    };
    const navigation = {
        goBack: jest.fn(),
        navigate: jest.fn(),
        reset: jest.fn()
    };
    await render(
        <WalletConfiguration
            {...({
                navigation,
                route: { params: { node, index: 1, saved: false } },
                SettingsStore
            } as any)}
        />
    );
    return { updateSettings, navigation };
};

// The node the last save writes into slot 1 of the saved nodes
const savedNode = (updateSettings: jest.Mock) => {
    const calls = updateSettings.mock.calls as any[];
    const update = calls[calls.length - 1][0];
    return update({ nodes: [{}, {}] }).nodes[1];
};

const pressButton = (name: string) =>
    fireEvent.press(screen.getByRole('button', { name }));

const save = () => pressButton('views.Settings.WalletConfiguration.saveWallet');

const interfaceDropdown = () =>
    screen.container.queryAll(
        (n) =>
            n.type === 'DropdownSetting' &&
            n.props.title ===
                'views.Settings.WalletConfiguration.walletInterface'
    )[0];

const LND_NODE = {
    implementation: 'lnd',
    host: 'https://node.example.com',
    port: '8080',
    macaroonHex: 'deadbeef',
    rune: 'rune',
    certVerification: true
};

describe('WalletConfiguration', () => {
    beforeEach(() => {
        (confirmAction as jest.Mock).mockClear();
        (Clipboard.getString as jest.Mock).mockClear().mockResolvedValue('');
    });

    describe('lndhub clipboard import', () => {
        it('offers a copied lndhub address and clears REST fields left over from a previous config', async () => {
            (Clipboard.getString as jest.Mock).mockResolvedValue(LNDHUB_IMPORT);
            const { updateSettings } = await renderView(
                { ...LND_NODE, host: 'http://192.168.1.50' },
                { clipboard: true }
            );
            expect(
                screen.getByText('lndhub://********@https://lndhub.example.com')
            ).toBeOnTheScreen();

            await pressButton('views.Settings.AddEditNode.import');
            expect(
                screen.queryByText(
                    'lndhub://********@https://lndhub.example.com'
                )
            ).not.toBeOnTheScreen();
            expect(interfaceDropdown().props.selectedValue).toBe('lndhub');
            expect(screen.getByPlaceholderText('https://')).toHaveDisplayValue(
                'https://lndhub.example.com'
            );

            await save();

            expect(savedNode(updateSettings)).toMatchObject({
                implementation: 'lndhub',
                lndhubUrl: 'https://lndhub.example.com',
                username: 'alice',
                password: 'secret',
                host: '',
                port: '',
                macaroonHex: '',
                rune: ''
            });
        });

        it('does not read the clipboard when clipboard reading is off', async () => {
            await renderView(LND_NODE);

            expect(Clipboard.getString).not.toHaveBeenCalled();
            expect(
                screen.queryByRole('button', {
                    name: 'views.Settings.AddEditNode.import'
                })
            ).not.toBeOnTheScreen();
        });
    });

    describe('clipboard import banner', () => {
        it('does not show the lndhub login and password', async () => {
            (Clipboard.getString as jest.Mock).mockResolvedValue(LNDHUB_IMPORT);
            await renderView(LND_NODE, { clipboard: true });

            expect(
                screen.getByText('lndhub://********@https://lndhub.example.com')
            ).toBeOnTheScreen();
            expect(screen.queryByText(/secret/)).not.toBeOnTheScreen();
        });

        it('does not show the clnrest rune', async () => {
            (Clipboard.getString as jest.Mock).mockResolvedValue(
                'clnrest://cln.local:3010?rune=8hJ6ZKFvRune'
            );
            await renderView(LND_NODE, { clipboard: true });

            expect(
                screen.getByText('clnrest://cln.local:3010?rune=********')
            ).toBeOnTheScreen();
            expect(screen.queryByText(/8hJ6ZKFvRune/)).not.toBeOnTheScreen();
        });

        it('imports the unredacted lndhub password', async () => {
            (Clipboard.getString as jest.Mock).mockResolvedValue(LNDHUB_IMPORT);
            await renderView(LND_NODE, { clipboard: true });

            await pressButton('views.Settings.AddEditNode.import');

            const [username, password] = screen.getAllByPlaceholderText('...');
            expect(username).toHaveDisplayValue('alice');
            expect(password).toHaveDisplayValue('secret');
        });
    });

    describe('LNC keys', () => {
        const PAIRING_PHRASE =
            'cherry truth mask employ box silver mass bunker fiscal vote';
        const LOCAL_KEY = 'd1'.repeat(32);
        const REMOTE_KEY = '02' + 'd2'.repeat(32);

        beforeEach(() => {
            (Storage.getItem as jest.Mock).mockResolvedValue(
                JSON.stringify({ localKey: LOCAL_KEY, remoteKey: REMOTE_KEY })
            );
        });

        afterEach(() => {
            (Storage.getItem as jest.Mock).mockResolvedValue(null);
        });

        it('masks the local and remote keys like the pairing phrase', async () => {
            await renderView({
                implementation: 'lightning-node-connect',
                pairingPhrase: PAIRING_PHRASE
            });

            expect(
                screen.getByDisplayValue(PAIRING_PHRASE).props.secureTextEntry
            ).toBe(true);
            expect(
                screen.getByDisplayValue(LOCAL_KEY).props.secureTextEntry
            ).toBe(true);
            expect(
                screen.getByDisplayValue(REMOTE_KEY).props.secureTextEntry
            ).toBe(true);
        });

        it('shows the keys after the show/hide toggle is pressed', async () => {
            await renderView({
                implementation: 'lightning-node-connect',
                pairingPhrase: PAIRING_PHRASE
            });

            const [toggle] = screen.container.queryAll(
                (n) => n.type === 'ShowHideToggle'
            );
            await act(async () => toggle.props.onPress());

            expect(
                screen.getByDisplayValue(LOCAL_KEY).props.secureTextEntry
            ).toBe(false);
            expect(
                screen.getByDisplayValue(REMOTE_KEY).props.secureTextEntry
            ).toBe(false);
        });
    });

    describe('implementation dropdown', () => {
        it('clears the previous server address and credentials', async () => {
            // existingAccount shows the username and password fields
            // certVerification starts false so the switch to lndhub has
            // to set it
            const { updateSettings } = await renderView({
                ...LND_NODE,
                certVerification: false,
                lndhubUrl: 'https://old-lndhub.example.com',
                existingAccount: true
            });

            await fireEvent(interfaceDropdown(), 'valueChange', 'lndhub');

            expect(interfaceDropdown().props.selectedValue).toBe('lndhub');
            expect(screen.getByPlaceholderText('https://')).toHaveDisplayValue(
                ''
            );

            await fireEvent.changeText(
                screen.getByPlaceholderText('https://'),
                'https://lndhub.example.com'
            );
            const [username, password] = screen.getAllByPlaceholderText('...');
            await fireEvent.changeText(username, 'alice');
            await fireEvent.changeText(password, 'secret');
            await save();

            expect(savedNode(updateSettings)).toMatchObject({
                implementation: 'lndhub',
                certVerification: true,
                lndhubUrl: 'https://lndhub.example.com',
                host: '',
                port: '',
                macaroonHex: '',
                rune: ''
            });
        });
    });

    describe('cleartext HTTP gate', () => {
        // LndHub requests go to lndhubUrl only, so a stale host on an
        // lndhub config decides nothing
        const LNDHUB_NODE = {
            implementation: 'lndhub',
            username: 'alice',
            password: 'secret',
            existingAccount: true,
            certVerification: true
        };

        it('warns on lndhub with an http:// lndhubUrl behind a stale https:// host', async () => {
            const { updateSettings } = await renderView({
                ...LNDHUB_NODE,
                host: 'https://node.example.com',
                lndhubUrl: 'http://lndhub.example.com'
            });
            await save();

            expect(confirmAction).toHaveBeenCalledTimes(1);
            expect(updateSettings).not.toHaveBeenCalled();
        });

        it('saves after the warning is accepted', async () => {
            const { updateSettings } = await renderView({
                ...LNDHUB_NODE,
                lndhubUrl: 'http://lndhub.example.com'
            });
            await save();

            const [, , proceed] = (confirmAction as jest.Mock).mock.calls[0];
            await act(async () => proceed.onPress());
            expect(savedNode(updateSettings).lndhubUrl).toBe(
                'http://lndhub.example.com'
            );
        });

        it('ignores a stale http:// host on an lndhub config', async () => {
            const { updateSettings } = await renderView({
                ...LNDHUB_NODE,
                host: 'http://192.168.1.50',
                lndhubUrl: 'https://lndhub.example.com'
            });
            await save();

            expect(confirmAction).not.toHaveBeenCalled();
            expect(updateSettings).toHaveBeenCalled();
        });

        it('warns on lndhub with an http:// lndhubUrl and no host', async () => {
            const { updateSettings } = await renderView({
                ...LNDHUB_NODE,
                host: '',
                lndhubUrl: 'http://lndhub.example.com'
            });
            await save();

            expect(confirmAction).toHaveBeenCalledTimes(1);
            expect(updateSettings).not.toHaveBeenCalled();
        });

        it('does not warn on lndhub with an https:// lndhubUrl', async () => {
            const { updateSettings } = await renderView({
                ...LNDHUB_NODE,
                host: '',
                lndhubUrl: 'https://lndhub.example.com'
            });
            await save();

            expect(confirmAction).not.toHaveBeenCalled();
            expect(updateSettings).toHaveBeenCalled();
        });

        it('does not warn on lndhub over an http:// onion host', async () => {
            const { updateSettings } = await renderView({
                ...LNDHUB_NODE,
                host: '',
                lndhubUrl: 'http://abcdefghijklmnop.onion'
            });
            await save();

            expect(confirmAction).not.toHaveBeenCalled();
            expect(updateSettings).toHaveBeenCalled();
        });

        it('ignores a stale http:// lndhubUrl on an lnd config', async () => {
            const { updateSettings } = await renderView({
                ...LND_NODE,
                lndhubUrl: 'http://lndhub.example.com'
            });
            await save();

            expect(confirmAction).not.toHaveBeenCalled();
            expect(updateSettings).toHaveBeenCalled();
        });

        it('warns on lnd with an http:// host', async () => {
            const { updateSettings } = await renderView({
                ...LND_NODE,
                host: 'http://192.168.1.50'
            });
            await save();

            expect(confirmAction).toHaveBeenCalledTimes(1);
            expect(updateSettings).not.toHaveBeenCalled();
        });
    });
});
