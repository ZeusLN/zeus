jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('@rneui/themed', () => ({
    ListItem: Object.assign(() => null, {
        Content: () => null,
        Title: () => null
    })
}));
jest.mock('../../../../stores/SettingsStore', () => ({
    DEFAULT_NEUTRINO_PEERS_MAINNET: ['a.mainnet'],
    DEFAULT_NEUTRINO_PEERS_TESTNET: ['a.testnet']
}));
jest.mock('../../../../utils/LndMobileUtils', () => ({
    optimizeNeutrinoPeers: jest.fn().mockResolvedValue(undefined),
    pingPeer: jest.fn(),
    NEUTRINO_PING_THRESHOLD_MS: 200
}));
jest.mock('../../../../utils/LocaleUtils');
jest.mock('../../../../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
jest.mock('../../../../utils/RestartUtils', () => ({
    restartNeeded: jest.fn()
}));
jest.mock('../../../../assets/images/SVG/Stopwatch.svg', () => 'Stopwatch');
jest.mock('../../../../components/Button', () => 'Button');
jest.mock('../../../../components/Header', () => 'Header');
jest.mock('../../../../components/Screen', () => 'Screen');
jest.mock('../../../../components/Switch', () => 'Switch');
jest.mock('../../../../components/Text', () => 'Text');
jest.mock('../../../../components/TextInput', () => 'TextInput');
jest.mock('../../../../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../../../../components/layout/Row', () => ({ Row: 'Row' }));
jest.mock('../../../../components/SuccessErrorMessage', () => ({
    SuccessMessage: 'SuccessMessage',
    WarningMessage: 'WarningMessage',
    ErrorMessage: 'ErrorMessage'
}));

import * as React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import NeutrinoPeers from './NeutrinoPeers';
import { optimizeNeutrinoPeers } from '../../../../utils/LndMobileUtils';

describe('NeutrinoPeers', () => {
    it('lets the Optimize button replace peers the user entered', async () => {
        const settings = {
            neutrinoPeersMainnet: ['bitcoind.home.example'],
            neutrinoPeersTestnet: ['a.testnet'],
            dontAllowOtherPeers: true
        };
        const SettingsStore = {
            settings,
            embeddedLndNetwork: 'Mainnet',
            updateSettings: jest.fn(),
            getSettings: jest.fn().mockResolvedValue(settings)
        };
        await render(
            <NeutrinoPeers
                navigation={{} as any}
                SettingsStore={SettingsStore as any}
            />
        );

        const [optimize] = screen.container.queryAll(
            (node) =>
                node.type === 'Button' &&
                node.props.title ===
                    'views.Settings.EmbeddedNode.NeutrinoPeers.optimize'
        );
        await act(async () => {
            await optimize.props.onPress();
        });

        expect(optimizeNeutrinoPeers).toHaveBeenCalledWith(
            false,
            undefined,
            true
        );
    });
});
