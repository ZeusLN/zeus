jest.mock('@rneui/themed', () => {
    const { Text, View } = require('react-native');
    const ListItem = ({ children }: any) => <View>{children}</View>;
    ListItem.Title = ({ children }: any) => <Text>{children}</Text>;
    return { ListItem };
});
jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../../../../stores/SettingsStore', () => ({
    DEFAULT_NEUTRINO_PEERS_MAINNET: [],
    DEFAULT_NEUTRINO_PEERS_TESTNET: []
}));
jest.mock('../../../../utils/LndMobileUtils', () => ({
    optimizeNeutrinoPeers: jest.fn(),
    pingPeer: jest.fn(),
    NEUTRINO_PING_THRESHOLD_MS: 200
}));
jest.mock('../../../../utils/RestartUtils', () => ({
    restartNeeded: jest.fn()
}));
jest.mock('../../../../utils/LocaleUtils');
jest.mock('../../../../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
jest.mock('../../../../assets/images/SVG/Stopwatch.svg', () => 'Stopwatch');
jest.mock('../../../../components/Button', () => 'Button');
jest.mock('../../../../components/Header', () => 'Header');
jest.mock('../../../../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../../../../components/Switch', () => 'Switch');
jest.mock('../../../../components/Text', () => {
    const { Text } = require('react-native');
    return ({ children }: any) => <Text>{children}</Text>;
});
jest.mock('../../../../components/TextInput', () => 'TextInput');
jest.mock('../../../../components/SuccessErrorMessage', () => ({
    SuccessMessage: 'SuccessMessage',
    WarningMessage: 'WarningMessage',
    ErrorMessage: 'ErrorMessage'
}));
jest.mock('../../../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});

import * as React from 'react';
import { act, render } from '@testing-library/react-native';
import NeutrinoPeers from './NeutrinoPeers';
import { restartNeeded } from '../../../../utils/RestartUtils';

const setup = async (dontAllowOtherPeers?: boolean) => {
    const SettingsStore = {
        settings: { dontAllowOtherPeers, neutrinoPeersMainnet: [] },
        embeddedLndNetwork: 'Mainnet',
        updateSettings: jest.fn(async () => true)
    };
    const view = await render(
        <NeutrinoPeers
            navigation={{} as any}
            SettingsStore={SettingsStore as any}
        />
    );
    const toggle = () =>
        view.container.queryAll((n) => n.type === 'Switch')[0].props;
    return { SettingsStore, toggle, view };
};

describe('NeutrinoPeers allow other peers toggle', () => {
    beforeEach(() => jest.clearAllMocks());

    it('labels the toggle as allowing other peers', async () => {
        const { view } = await setup(false);
        expect(
            view.getByText(
                'views.Settings.EmbeddedNode.NeutrinoPeers.allowOtherPeers'
            )
        ).toBeOnTheScreen();
    });

    it.each([
        ['unset', undefined, true],
        ['allowing other peers', false, true],
        ['restricted to the listed peers', true, false]
    ])('is %s', async (_label, stored, shown) => {
        const { toggle } = await setup(stored);
        expect(toggle().value).toBe(shown);
    });

    it('turning it off stores dontAllowOtherPeers: true', async () => {
        const { SettingsStore, toggle } = await setup(false);

        await act(async () => {
            await toggle().onValueChange();
        });

        expect(SettingsStore.updateSettings).toHaveBeenCalledWith({
            dontAllowOtherPeers: true
        });
        expect(restartNeeded).toHaveBeenCalled();
        expect(toggle().value).toBe(false);
    });

    it('turning it on stores dontAllowOtherPeers: false', async () => {
        const { SettingsStore, toggle } = await setup(true);

        await act(async () => {
            await toggle().onValueChange();
        });

        expect(SettingsStore.updateSettings).toHaveBeenCalledWith({
            dontAllowOtherPeers: false
        });
        expect(toggle().value).toBe(true);
    });
});
