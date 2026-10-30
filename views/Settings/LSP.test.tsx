jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('@rneui/themed', () => {
    const { Text, View } = require('react-native');
    const ListItem: any = ({ children }: any) => <View>{children}</View>;
    ListItem.Title = ({ children }: any) => <Text>{children}</Text>;
    ListItem.Content = ListItem;
    return { Icon: 'Icon', ListItem };
});
jest.mock('../../stores/Stores');
jest.mock('../../stores/SettingsStore', () => ({
    DEFAULT_LSP_MAINNET: 'https://flow.zeuslsp.com',
    DEFAULT_LSP_TESTNET: 'https://flow.testnet.zeuslsp.com',
    DEFAULT_LSP_MUTINYNET: 'https://flow.mutinynet.zeuslsp.com',
    getLspConfigForNetwork: (settings: any, nodeInfo: any) => ({
        flowHost: nodeInfo?.isTestNet
            ? settings.lspTestnet
            : settings.lspMainnet,
        defaultFlowHost: 'https://flow.zeuslsp.com'
    })
}));
jest.mock('../../utils/BackendUtils', () => ({
    supportsSimpleTaprootChannels: () => false
}));
jest.mock('../../utils/LocaleUtils');
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
jest.mock('../../utils/UrlUtils', () => ({ goToUrl: jest.fn() }));
jest.mock('../../components/Button', () => 'Button');
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../../components/Switch', () => 'Switch');
jest.mock('../../components/TextInput', () => 'TextInput');

import * as React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import LSP from './LSP';

const mount = async (settings: any, nodeInfo: any = {}) => {
    const SettingsStore = {
        settings: { enableLSP: true, nodes: [], selectedNode: 0, ...settings },
        updateSettings: jest.fn().mockResolvedValue({})
    };
    const NodeInfoStore = {
        nodeInfo,
        flowLspNotConfigured: () => ({ flowLspNotConfigured: false })
    };
    await render(
        <LSP
            navigation={{} as any}
            SettingsStore={SettingsStore as any}
            NodeInfoStore={NodeInfoStore as any}
        />
    );
    return { SettingsStore };
};

// the LSP host field, then the discount code field
const fields = () =>
    screen.container.queryAll((n: any) => n.type === 'TextInput');
const typeHost = (text: string) =>
    act(async () => fields()[0].props.onChangeText(text));
const typeAccessKey = (text: string) =>
    act(async () => fields()[1].props.onChangeText(text));

describe('LSP settings discount code', () => {
    it('clears the discount code when the host is edited', async () => {
        const { SettingsStore } = await mount({
            lspMainnet: 'https://lsp-a.example',
            lspAccessKey: 'key-for-lsp-a'
        });

        await typeHost('https://lsp-b.example');

        expect(SettingsStore.updateSettings).toHaveBeenCalledWith({
            lspMainnet: 'https://lsp-b.example',
            lspAccessKey: ''
        });
        expect(fields()[1].props.value).toBe('');
    });

    it('restores the discount code when the host is edited back', async () => {
        const { SettingsStore } = await mount({
            lspMainnet: 'https://lsp-a.example',
            lspAccessKey: 'k'
        });

        await typeHost('https://lsp-a.exampleX');
        await typeHost('https://lsp-a.example');

        expect(SettingsStore.updateSettings).toHaveBeenLastCalledWith({
            lspMainnet: 'https://lsp-a.example',
            lspAccessKey: 'k'
        });
        expect(fields()[1].props.value).toBe('k');
    });

    it('keeps the discount code when the same host is pasted', async () => {
        const { SettingsStore } = await mount({
            lspMainnet: 'https://lsp-a.example',
            lspAccessKey: 'k'
        });

        await typeHost(' https://lsp-a.example ');

        expect(SettingsStore.updateSettings).toHaveBeenLastCalledWith({
            lspMainnet: ' https://lsp-a.example '
        });
        expect(fields()[1].props.value).toBe('k');
    });

    it('clears it when the testnet host is edited', async () => {
        const { SettingsStore } = await mount(
            {
                lspTestnet: 'https://lsp-a.example',
                lspAccessKey: 'key-for-lsp-a'
            },
            { isTestNet: true }
        );

        await typeHost('https://lsp-b.example');

        expect(SettingsStore.updateSettings).toHaveBeenCalledWith({
            lspTestnet: 'https://lsp-b.example',
            lspAccessKey: ''
        });
    });

    it('writes only the host when no discount code is set', async () => {
        const { SettingsStore } = await mount({
            lspMainnet: 'https://lsp-a.example',
            lspAccessKey: ''
        });

        await typeHost('https://lsp-b.example');

        expect(SettingsStore.updateSettings).toHaveBeenCalledWith({
            lspMainnet: 'https://lsp-b.example'
        });
    });

    it('keeps a code entered after the host was changed', async () => {
        const { SettingsStore } = await mount({
            lspMainnet: 'https://lsp-a.example',
            lspAccessKey: ''
        });

        await typeHost('https://lsp-b.example');
        await typeAccessKey('key-for-lsp-b');

        expect(SettingsStore.updateSettings).toHaveBeenLastCalledWith({
            lspAccessKey: 'key-for-lsp-b'
        });
    });
});
