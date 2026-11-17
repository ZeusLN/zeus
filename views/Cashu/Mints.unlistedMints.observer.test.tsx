// mobx-react is not mocked here, so the test sees what render() tracks. Its
// entry point requires react-dom, which is not installed
jest.mock(
    'react-dom',
    () => ({
        unstable_batchedUpdates: (fn: any) => fn(),
        findDOMNode: () => null
    }),
    { virtual: true }
);
jest.mock('@rneui/themed', () => {
    const { Text, View } = require('react-native');
    const ListItem: any = ({ children }: any) => <View>{children}</View>;
    ListItem.Content = View;
    ListItem.Title = Text;
    ListItem.Subtitle = Text;
    return { Button: 'Button', Icon: 'Icon', ListItem };
});
jest.mock('../../stores/CashuStore', () => ({}));
jest.mock('../../stores/SettingsStore', () => ({}));
jest.mock('../../utils/LocaleUtils');
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
jest.mock('../../components/Amount', () => {
    const { Text } = require('react-native');
    return ({ sats }: any) => <Text>{`${sats} sats`}</Text>;
});
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/MintAvatar', () => 'MintAvatar');
jest.mock('../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../../components/Switch', () => 'Switch');
jest.mock('../../components/layout/Row', () => ({ Row: 'Row' }));
jest.mock('../../assets/images/SVG/Add.svg', () => 'Add');

import * as React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import { observable, runInAction } from 'mobx';
import Mints from './Mints';

const LISTED = 'https://listed.mint';
const SWEEP = 'https://sweep.mint';

describe('Mints: balances at mints that are not in the list', () => {
    it.each([
        ['below the mint list', [LISTED]],
        ['with an empty mint list', []]
    ])('follows the store %s', async (_name, mintUrls) => {
        let focus: () => Promise<void> = async () => {};
        const CashuStore = observable({
            mintUrls,
            cashuWallets: {},
            mintInfos: {},
            mintBalances: {},
            unlistedMintBalances: [{ mintUrl: SWEEP, balance: 100 }],
            multiMintSelectedUrls: [],
            fetchMintInfo: jest.fn(),
            clearInvoice: jest.fn()
        });
        await render(
            <Mints
                {...({
                    navigation: {
                        addListener: (_event: string, handler: any) => {
                            focus = handler;
                            return jest.fn();
                        }
                    },
                    route: { params: {} },
                    CashuStore,
                    SettingsStore: { settings: { ecash: {} } }
                } as any)}
            />
        );
        await act(async () => {
            await focus();
        });
        expect(screen.getByText('100 sats')).toBeTruthy();

        // A second token swept from the mint
        await act(async () => {
            runInAction(() => {
                CashuStore.unlistedMintBalances = [
                    { mintUrl: SWEEP, balance: 250 }
                ];
            });
        });
        expect(screen.getByText('250 sats')).toBeTruthy();

        // The user added the mint
        await act(async () => {
            runInAction(() => {
                CashuStore.unlistedMintBalances = [];
            });
        });
        expect(screen.queryByText(SWEEP)).toBeNull();
    });
});
