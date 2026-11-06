const mockGetActiveLsps2NodeId = jest.fn();
const mockRestartNeeded = jest.fn();

jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../../utils/RestartUtils', () => ({
    restartNeeded: () => mockRestartNeeded()
}));
jest.mock('../../stores/SettingsStore', () => ({
    getLspConfigForNetwork: (settings: any) => ({
        lsps2Pubkey: settings.lsps2PubkeyMutinynet || '',
        lsps2Host: settings.lsps2HostMutinynet || ''
    })
}));
jest.mock('../../utils/LdkNodeUtils', () => ({
    getActiveLsps2NodeId: () => mockGetActiveLsps2NodeId()
}));
jest.mock('../../utils/LocaleUtils');
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
jest.mock('../../components/Header', () => () => null);
jest.mock('../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
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

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import LSPS2Settings from './Settings';

const pubkey =
    '02a8a7efb269645f1ca1e39637e72f74d45e8ec766c80cc184531d5453149695e6';

const renderView = async (settings: any = {}) => {
    const updateSettings = jest.fn(async () => {});
    await render(
        <LSPS2Settings
            navigation={{} as any}
            NodeInfoStore={{ nodeInfo: { isMutinynet: true } } as any}
            SettingsStore={{ settings, updateSettings } as any}
        />
    );
    return updateSettings;
};

const pubkeyInput = () => screen.getByPlaceholderText('02...');
const hostInput = () =>
    screen.getByPlaceholderText('views.OpenChannel.hostPort');

beforeEach(() => {
    jest.clearAllMocks();
    mockGetActiveLsps2NodeId.mockReturnValue(undefined);
});

describe('LSPS2Settings', () => {
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

    it('asks for a restart on leaving after a change', async () => {
        await renderView({
            lsps2PubkeyMutinynet: pubkey,
            lsps2HostMutinynet: '127.0.0.1:9735'
        });

        await fireEvent.changeText(hostInput(), '127.0.0.1:9736');
        expect(mockRestartNeeded).not.toHaveBeenCalled();

        await screen.unmount();
        expect(mockRestartNeeded).toHaveBeenCalledTimes(1);
    });

    it('does not ask for a restart when nothing changed', async () => {
        await renderView({ lsps2PubkeyMutinynet: pubkey });
        await screen.unmount();
        expect(mockRestartNeeded).not.toHaveBeenCalled();
    });

    it('clears the network fields and the token', async () => {
        const updateSettings = await renderView({
            lsps2PubkeyMutinynet: pubkey,
            lsps2HostMutinynet: '127.0.0.1:9735',
            lsps2Token: 'jit'
        });

        await fireEvent.press(screen.getByText('general.clear'));

        expect(updateSettings).toHaveBeenCalledTimes(1);
        expect(updateSettings).toHaveBeenCalledWith({
            lsps2PubkeyMutinynet: '',
            lsps2HostMutinynet: '',
            lsps2Token: ''
        });
        await screen.unmount();
        expect(mockRestartNeeded).toHaveBeenCalledTimes(1);
    });

    it('shows whether the running node uses an LSPS2 LSP', async () => {
        await renderView();
        expect(screen.getByText('views.LSPS2.inactive')).toBeTruthy();

        mockGetActiveLsps2NodeId.mockReturnValue(pubkey);
        await renderView();
        expect(
            screen.getByText('views.LSPS2.active: 02a8a7ef…149695e6')
        ).toBeTruthy();
    });
});
