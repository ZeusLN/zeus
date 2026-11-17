jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
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
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import Mints from './Mints';

const LISTED = 'https://listed.mint';
const SWEEP = 'https://sweep.mint';
const EXPLAINER = 'views.Cashu.Mints.unlistedMintsExplainer';

const renderMints = async ({
    mintUrls = [LISTED],
    unlisted = [{ mintUrl: SWEEP, balance: 100 }],
    params = {}
}: {
    mintUrls?: string[];
    unlisted?: { mintUrl: string; balance: number }[];
    params?: Record<string, boolean>;
} = {}) => {
    let focus: () => Promise<void> = async () => {};
    const navigation = {
        addListener: jest.fn((_event: string, handler: any) => {
            focus = handler;
            return jest.fn();
        }),
        navigate: jest.fn(),
        goBack: jest.fn()
    };
    const CashuStore = {
        mintUrls,
        cashuWallets: {},
        mintInfos: {},
        mintBalances: { [LISTED]: 473 },
        unlistedMintBalances: unlisted,
        multiMintSelectedUrls: [],
        fetchMintInfo: jest.fn().mockResolvedValue({ name: 'Sweep mint' }),
        clearInvoice: jest.fn()
    };
    await render(
        <Mints
            {...({
                navigation,
                route: { params },
                CashuStore,
                SettingsStore: { settings: { ecash: {} } }
            } as any)}
        />
    );
    await act(async () => {
        await focus();
    });
    return { navigation, CashuStore };
};

describe('Mints: balances at mints that are not in the list', () => {
    it('shows each mint with its balance below the mint list', async () => {
        await renderMints();

        expect(screen.getByText(EXPLAINER)).toBeTruthy();
        expect(screen.getByText(SWEEP)).toBeTruthy();
        expect(screen.getByText('100 sats')).toBeTruthy();
    });

    it('shows them when the mint list is empty', async () => {
        await renderMints({ mintUrls: [] });

        expect(screen.getByText(SWEEP)).toBeTruthy();
        expect(screen.getByText('100 sats')).toBeTruthy();
    });

    it('opens the mint for adding', async () => {
        const { navigation, CashuStore } = await renderMints();

        await act(async () => {
            fireEvent.press(screen.getByLabelText(SWEEP));
        });

        expect(CashuStore.fetchMintInfo).toHaveBeenCalledWith(SWEEP);
        expect(navigation.navigate).toHaveBeenCalledWith('Mint', {
            mint: { name: 'Sweep mint', mintUrl: SWEEP },
            lookup: true
        });
    });

    it('opens the mint for adding when its info cannot be fetched', async () => {
        const { navigation, CashuStore } = await renderMints();
        CashuStore.fetchMintInfo.mockResolvedValue(null);

        await act(async () => {
            fireEvent.press(screen.getByLabelText(SWEEP));
        });

        expect(navigation.navigate).toHaveBeenCalledWith('Mint', {
            mint: { mintUrl: SWEEP },
            lookup: true
        });
    });

    it('shows nothing when no such mint holds a balance', async () => {
        await renderMints({ unlisted: [] });

        expect(screen.queryByText(EXPLAINER)).toBeNull();
    });

    it.each([['forceSingleMint'], ['isMultiMintView']])(
        'leaves them out of the %s mint picker',
        async (param) => {
            await renderMints({ params: { [param]: true } });

            expect(screen.queryByText(EXPLAINER)).toBeNull();
            expect(screen.queryByText(SWEEP)).toBeNull();
        }
    );
});
