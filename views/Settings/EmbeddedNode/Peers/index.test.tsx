jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));

jest.mock('../../../../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));

jest.mock('../../../../components/Header', () => 'Header');
jest.mock('../../../../components/Screen', () => 'Screen');

jest.mock('@rneui/themed', () => {
    const React = require('react');
    const { Text, View } = require('react-native');
    const ListItem = ({ children }: any) =>
        React.createElement(View, null, children);
    ListItem.Content = ({ children }: any) =>
        React.createElement(View, null, children);
    ListItem.Title = ({ children }: any) =>
        React.createElement(Text, null, children);
    ListItem.Subtitle = ({ children }: any) =>
        React.createElement(Text, null, children);
    return { Icon: () => null, ListItem };
});

// Use REAL en.json values so we test actual English output (including periods)
jest.mock('../../../../utils/LocaleUtils', () => {
    const enJson: any = require('../../../../locales/en.json');
    return {
        localeString: (key: string, subs?: any) => {
            let val: any = enJson[key];
            if (val === undefined) val = key;
            if (subs) {
                Object.keys(subs).forEach((k) => {
                    val = val.replace(`{{${k}}}`, String(subs[k]));
                });
            }
            return val;
        }
    };
});

import * as React from 'react';
import { render, screen } from '@testing-library/react-native';
import Peers from './index';

const renderPeers = async (
    settingsOverrides: any = {},
    network: string = 'Mainnet'
) => {
    const SettingsStore = {
        settings: {
            neutrinoPeersMainnet: [],
            neutrinoPeersTestnet: [],
            zeroConfPeers: [],
            dontAllowOtherPeers: false,
            ...settingsOverrides
        },
        embeddedLndNetwork: network
    };
    await render(
        <Peers navigation={{} as any} SettingsStore={SettingsStore as any} />
    );
};

describe('Peers Screen', () => {
    it('renders neutrino peers with allowingOtherPeers', async () => {
        await renderPeers({ neutrinoPeersMainnet: [1, 2, 3] });
        expect(
            screen.getByText(
                'Peers selected: 3. Allowing connections to other peers.'
            )
        ).toBeTruthy();
    });

    it('renders neutrino peers with notAllowingOtherPeers', async () => {
        await renderPeers({
            neutrinoPeersMainnet: [1, 2, 3],
            dontAllowOtherPeers: true
        });
        expect(
            screen.getByText(
                'Peers selected: 3. Not allowing connections to other peers.'
            )
        ).toBeTruthy();
    });

    it('renders zero conf peers', async () => {
        await renderPeers({ zeroConfPeers: [1] });
        expect(screen.getByText('Peers selected: 1.')).toBeTruthy();
    });

    it('renders mixed empty states correctly', async () => {
        await renderPeers({ neutrinoPeersMainnet: [], zeroConfPeers: [1] });

        // Zero-conf has 1 peer → count line
        expect(screen.getByText('Peers selected: 1.')).toBeTruthy();

        // Neutrino empty → literal expected text
        expect(
            screen.getByText(
                'None selected. Using ZEUS defaults. Allowing connections to other peers.'
            )
        ).toBeTruthy();
    });

    it('reads from testnet if embeddedLndNetwork is not Mainnet', async () => {
        await renderPeers(
            { neutrinoPeersMainnet: [1], neutrinoPeersTestnet: [1, 2, 3, 4] },
            'Testnet'
        );
        expect(
            screen.getByText(
                'Peers selected: 4. Allowing connections to other peers.'
            )
        ).toBeTruthy();
    });
});
