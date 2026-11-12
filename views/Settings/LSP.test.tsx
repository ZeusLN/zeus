const mockGetActiveLsps2NodeId = jest.fn();
const mockGetActiveLsps2Config = jest.fn();
const mockRestartNeeded = jest.fn();
const mockSupportsLSPS2 = jest.fn();
const mockLsps2Default = { pubkey: '', host: '' };

jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
// Mutinynet only; the real resolution is covered in SettingsStore.test.ts
jest.mock('../../stores/SettingsStore', () => ({
    DEFAULT_LSP_MAINNET: 'https://flow.mainnet',
    DEFAULT_LSP_TESTNET: 'https://flow.testnet',
    DEFAULT_LSP_MUTINYNET: 'https://flow.mutinynet',
    getJitChannelProvider: (settings: any) =>
        settings.jitChannelProvider ?? 'lsps2',
    getLspConfigForNetwork: (settings: any) => ({
        flowHost: settings.lspMutinynet || 'https://flow.mutinynet',
        defaultFlowHost: 'https://flow.mutinynet',
        lsps2Pubkey: settings.lsps2PubkeyMutinynet || mockLsps2Default.pubkey,
        lsps2Host: settings.lsps2HostMutinynet || mockLsps2Default.host,
        defaultLsps2Pubkey: mockLsps2Default.pubkey,
        defaultLsps2Host: mockLsps2Default.host
    }),
    getLdkNodeLspConfig: (settings: any) => ({
        lsps2Config:
            (settings.jitChannelProvider ?? 'lsps2') === 'lsps2' &&
            settings.lsps2PubkeyMutinynet &&
            settings.lsps2HostMutinynet
                ? {
                      nodeId: settings.lsps2PubkeyMutinynet,
                      address: settings.lsps2HostMutinynet,
                      token: settings.lsps2Token || null
                  }
                : undefined
    })
}));
jest.mock('../../utils/BackendUtils', () => ({
    supportsLSPS2: () => mockSupportsLSPS2(),
    supportsSimpleTaprootChannels: () => false
}));
jest.mock('../../utils/LdkNodeUtils', () => ({
    getActiveLsps2Config: () => mockGetActiveLsps2Config(),
    getActiveLsps2NodeId: () => mockGetActiveLsps2NodeId()
}));
jest.mock('../../utils/RestartUtils', () => ({
    restartNeeded: () => mockRestartNeeded()
}));
jest.mock('../../utils/UrlUtils', () => ({ goToUrl: jest.fn() }));
jest.mock('../../utils/LocaleUtils');
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
jest.mock('@rneui/themed', () => {
    const { Text, View } = require('react-native');
    const ListItem: any = ({ children }: any) => <View>{children}</View>;
    ListItem.Title = ({ children }: any) => <Text>{children}</Text>;
    ListItem.Content = ({ children }: any) => <View>{children}</View>;
    return { ListItem, Icon: () => null };
});
jest.mock('../../components/Header', () => () => null);
jest.mock('../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../../components/Switch', () => () => null);
jest.mock('../../components/TextInput', () => {
    const { TextInput } = require('react-native');
    return (props: any) => <TextInput {...props} />;
});
jest.mock('../../components/Button', () => {
    const { Pressable, Text } = require('react-native');
    return ({ title, onPress }: any) => (
        <Pressable onPress={onPress}>
            <Text>{title}</Text>
        </Pressable>
    );
});
jest.mock('../../components/ToggleButton', () => {
    const { Pressable, Text, View } = require('react-native');
    return ({ options, onToggle }: any) => (
        <View>
            {options.map((option: any) => (
                <Pressable
                    key={option.key}
                    onPress={() => onToggle(option.key)}
                >
                    <Text>{option.label}</Text>
                </Pressable>
            ))}
        </View>
    );
});

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import LSP from './LSP';

const pubkey =
    '02a8a7efb269645f1ca1e39637e72f74d45e8ec766c80cc184531d5453149695e6';
const withLsps2 = {
    lsps2PubkeyMutinynet: pubkey,
    lsps2HostMutinynet: '127.0.0.1:9735'
};
const runningLsps2 = { nodeId: pubkey, address: '127.0.0.1:9735', token: null };
const nodeRunsLsps2 = () => {
    mockGetActiveLsps2NodeId.mockReturnValue(pubkey);
    mockGetActiveLsps2Config.mockReturnValue(runningLsps2);
};

const renderView = async (settings: any = {}) => {
    const updateSettings = jest.fn(async () => {});
    await render(
        <LSP
            navigation={{ navigate: jest.fn() } as any}
            NodeInfoStore={
                {
                    nodeInfo: { isMutinynet: true },
                    flowLspNotConfigured: () => ({
                        flowLspNotConfigured: false
                    })
                } as any
            }
            SettingsStore={
                {
                    settings: { enableLSP: true, ...settings },
                    updateSettings
                } as any
            }
        />
    );
    return updateSettings;
};

const pubkeyInput = () => screen.getByPlaceholderText('02...');
const hostInput = () =>
    screen.getByPlaceholderText('views.OpenChannel.hostPort');

beforeEach(() => {
    jest.clearAllMocks();
    mockSupportsLSPS2.mockReturnValue(true);
    mockGetActiveLsps2NodeId.mockReturnValue(undefined);
    mockGetActiveLsps2Config.mockReturnValue(undefined);
    mockLsps2Default.pubkey = '';
    mockLsps2Default.host = '';
});

describe('LSP (just-in-time channels)', () => {
    it('shows only Flow on backends without LSPS2', async () => {
        mockSupportsLSPS2.mockReturnValue(false);
        await renderView();

        expect(screen.queryByText('LSPS2')).toBeNull();
        expect(screen.getByText('general.lsp')).toBeTruthy();
        expect(
            screen.getByText('views.Settings.LSP.createWrappedInvoice')
        ).toBeTruthy();
    });

    it('starts on LSPS2 with its fields and without the Flow links', async () => {
        await renderView();

        expect(screen.getByText('views.Settings.LSP.lsps2Info')).toBeTruthy();
        expect(pubkeyInput()).toBeTruthy();
        expect(screen.queryByText('general.lsp')).toBeNull();
        expect(
            screen.queryByText('views.Settings.LSP.createWrappedInvoice')
        ).toBeNull();
    });

    it('saves Flow as the provider and shows its settings', async () => {
        const updateSettings = await renderView();

        await fireEvent.press(screen.getByText('Flow 2.0'));

        expect(updateSettings).toHaveBeenCalledWith({
            jitChannelProvider: 'flow'
        });
        expect(screen.getByText('views.Settings.LSP.flowInfo')).toBeTruthy();
        expect(screen.getByText('general.lsp')).toBeTruthy();
        expect(
            screen.getByText('views.Settings.LSP.createWrappedInvoice')
        ).toBeTruthy();
        expect(screen.queryByPlaceholderText('02...')).toBeNull();
    });

    describe('LSPS2 fields', () => {
        it('saves the pubkey and host for the wallet network', async () => {
            const updateSettings = await renderView();

            await fireEvent.changeText(pubkeyInput(), pubkey);
            await fireEvent.changeText(hostInput(), '127.0.0.1:9735');

            expect(updateSettings).toHaveBeenCalledWith({
                lsps2PubkeyMutinynet: pubkey
            });
            expect(updateSettings).toHaveBeenCalledWith({
                lsps2HostMutinynet: '127.0.0.1:9735'
            });
        });

        it('resets the fields to the default LSPS2 LSP', async () => {
            mockLsps2Default.pubkey = pubkey;
            mockLsps2Default.host = '127.0.0.1:9735';
            const updateSettings = await renderView();
            expect(screen.queryByText('general.reset')).toBeNull();

            await fireEvent.changeText(hostInput(), '10.0.0.1:9735');
            await fireEvent.press(screen.getByText('general.reset'));

            expect(updateSettings).toHaveBeenLastCalledWith({
                lsps2PubkeyMutinynet: '',
                lsps2HostMutinynet: '',
                lsps2Token: ''
            });
            expect(hostInput().props.value).toEqual('127.0.0.1:9735');
            expect(screen.queryByText('general.reset')).toBeNull();
        });

        it('links the LSPS2 spec instead of the Flow links', async () => {
            await renderView();

            await fireEvent.press(
                screen.getByText('views.Settings.LSP.lsps2Spec')
            );

            expect(
                jest.requireMock('../../utils/UrlUtils').goToUrl
            ).toBeCalledWith(
                'https://github.com/lightning/blips/blob/master/blip-0052.md'
            );
            expect(
                screen.queryByText('views.LspExplanationOverview.title')
            ).toBeNull();
        });
    });

    describe('what is in use', () => {
        it('says Flow is used when LSPS2 has no LSP for the network', async () => {
            await renderView();

            expect(
                screen.getByText('views.Settings.LSP.inUse: Flow 2.0')
            ).toBeTruthy();
        });

        it('shows the LSPS2 LSP the running node uses', async () => {
            mockGetActiveLsps2NodeId.mockReturnValue(pubkey);
            await renderView(withLsps2);

            expect(
                screen.getByText(
                    'views.Settings.LSP.inUse: LSPS2 · 02a8a7ef…149695e6'
                )
            ).toBeTruthy();
        });

        it('keeps showing the running LSP until a restart', async () => {
            nodeRunsLsps2();
            await renderView(withLsps2);

            await fireEvent.press(screen.getByText('Flow 2.0'));

            expect(
                screen.getByText(
                    'views.Settings.LSP.inUse: LSPS2 · 02a8a7ef…149695e6'
                )
            ).toBeTruthy();
        });

        it('hides the status while the LSP is off', async () => {
            await renderView({ enableLSP: false });

            expect(screen.queryByText(/views.Settings.LSP.inUse/)).toBeNull();
        });
    });

    describe('restart prompt', () => {
        it('asks right away when switching away from the running LSP', async () => {
            nodeRunsLsps2();
            await renderView(withLsps2);

            await fireEvent.press(screen.getByText('Flow 2.0'));

            expect(mockRestartNeeded).toHaveBeenCalledTimes(1);
        });

        it('asks right away when switching to an LSP the node lacks', async () => {
            await renderView({ ...withLsps2, jitChannelProvider: 'flow' });

            await fireEvent.press(screen.getByText('LSPS2'));

            expect(mockRestartNeeded).toHaveBeenCalledTimes(1);
        });

        it('does not ask when switching back to what the node runs', async () => {
            nodeRunsLsps2();
            await renderView(withLsps2);

            await fireEvent.press(screen.getByText('Flow 2.0'));
            await fireEvent.press(screen.getByText('LSPS2'));

            expect(mockRestartNeeded).toHaveBeenCalledTimes(1);
        });

        it('asks once per change, not on every tap', async () => {
            nodeRunsLsps2();
            await renderView(withLsps2);

            await fireEvent.press(screen.getByText('Flow 2.0'));
            await fireEvent.press(screen.getByText('Flow 2.0'));

            expect(mockRestartNeeded).toHaveBeenCalledTimes(1);
        });

        it('asks when a changed field loses focus, not while typing', async () => {
            nodeRunsLsps2();
            await renderView(withLsps2);

            await fireEvent.changeText(hostInput(), '127.0.0.1:9736');
            expect(mockRestartNeeded).not.toHaveBeenCalled();

            await fireEvent(hostInput(), 'blur');
            expect(mockRestartNeeded).toHaveBeenCalledTimes(1);
        });

        it('asks after Reset when the defaults differ from the node', async () => {
            mockLsps2Default.pubkey = pubkey;
            mockLsps2Default.host = '127.0.0.1:9735';
            await renderView({ lsps2HostMutinynet: '10.0.0.1:9735' });

            await fireEvent.press(screen.getByText('general.reset'));

            expect(mockRestartNeeded).toHaveBeenCalledTimes(1);
        });

        it('does not ask when the node would register the same LSP', async () => {
            // no LSPS2 LSP either way, so switching changes nothing
            await renderView();
            await fireEvent.press(screen.getByText('Flow 2.0'));

            expect(mockRestartNeeded).not.toHaveBeenCalled();
        });

        it('does not ask after Flow field changes', async () => {
            await renderView({ jitChannelProvider: 'flow' });

            const flowInput = screen.getByDisplayValue(
                'https://flow.mutinynet'
            );
            await fireEvent.changeText(flowInput, 'https://flow.example');
            await fireEvent(flowInput, 'blur');

            expect(mockRestartNeeded).not.toHaveBeenCalled();
        });

        it('does not ask on backends without LSPS2', async () => {
            mockSupportsLSPS2.mockReturnValue(false);
            await renderView(withLsps2);

            await fireEvent.changeText(
                screen.getByDisplayValue('https://flow.mutinynet'),
                'https://flow.example'
            );

            expect(mockRestartNeeded).not.toHaveBeenCalled();
        });

        it('does not ask on leaving the screen', async () => {
            await renderView({ ...withLsps2, jitChannelProvider: 'flow' });
            await screen.unmount();

            expect(mockRestartNeeded).not.toHaveBeenCalled();
        });
    });
});
