jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
const mockSupportsCashuWallet = jest.fn();
jest.mock('../../utils/BackendUtils', () => ({
    supportsCashuWallet: () => mockSupportsCashuWallet(),
    supportsOnchainReceiving: () => true,
    supportsOnchainSends: () => true
}));
jest.mock('../../utils/LocaleUtils');
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: () => '#ffffff',
    blendHexColors: () => '#ffffff'
}));
jest.mock('../../stores/Stores', () => ({
    cashuStore: { mintUrls: [], totalBalanceSats: 300 },
    utxosStore: {},
    nodeInfoStore: { supportsOffers: true },
    settingsStore: { settings: { ecash: { enableCashu: true } } }
}));
jest.mock('./LightningSwipeableRow', () => 'LightningSwipeableRow');
jest.mock('./OnchainSwipeableRow', () => 'OnchainSwipeableRow');
jest.mock('./EcashSwipeableRow', () => 'EcashSwipeableRow');
jest.mock('react-native-gesture-handler', () => ({ RectButton: 'RectButton' }));
jest.mock('../Amount', () => 'Amount');
jest.mock('../Button', () => 'Button');
jest.mock('../Pill', () => 'Pill');
jest.mock('../MintAvatar', () => 'MintAvatar');
jest.mock('../LinearGradient', () => 'LinearGradient');
jest.mock('../../components/SVG/EcashSvg', () => 'EcashSvg');
jest.mock('../../components/SVG/OnChainSvg', () => 'OnChainSvg');
jest.mock('../../components/SVG/LightningSvg', () => 'LightningSvg');
jest.mock('../../components/SVG/MatiSvg', () => 'MatiSvg');

import * as React from 'react';
import { render, screen } from '@testing-library/react-native';
import LayerBalances from './index';
import PaymentMethodList from './PaymentMethodList';

// LocaleUtils is mocked to return keys, so each row's label is either
// a locale key or the raw layer name
const LAYER_LABEL =
    /^(Ecash|general\.lightning|general\.onchain|components\.LayerBalances\.lightningViaEcash)$/;

const listLayers = () =>
    screen
        .getAllByText(LAYER_LABEL)
        .map((node) => node.props.children)
        .map((label: string) =>
            label === 'general.lightning'
                ? 'Lightning'
                : label === 'general.onchain'
                ? 'On-chain'
                : label === 'components.LayerBalances.lightningViaEcash'
                ? 'Lightning via ecash'
                : label
        );

describe('LayerBalances row order', () => {
    const renderBalances = (enableCashu: boolean) =>
        render(
            <LayerBalances
                {...({
                    navigation: { navigate: jest.fn() },
                    BalanceStore: {
                        totalBlockchainBalance: 1000,
                        settledBlockchainBalance: 1000,
                        lightningBalance: 2000
                    },
                    CashuStore: {
                        totalBalanceSats: 300,
                        mintUrls: ['https://mint.example.com'],
                        mintInfos: {}
                    },
                    SettingsStore: { settings: { ecash: { enableCashu } } },
                    UTXOsStore: { accounts: [] }
                } as any)}
            />
        );

    beforeEach(() => mockSupportsCashuWallet.mockReturnValue(true));

    it('lists Ecash above Lightning and On-chain', async () => {
        await renderBalances(true);
        expect(listLayers()).toEqual(['Ecash', 'Lightning', 'On-chain']);
    });

    it('starts with Lightning when ecash is disabled', async () => {
        await renderBalances(false);
        expect(listLayers()).toEqual(['Lightning', 'On-chain']);
    });

    it('starts with Lightning when the backend has no cashu wallet', async () => {
        mockSupportsCashuWallet.mockReturnValue(false);
        await renderBalances(true);
        expect(listLayers()).toEqual(['Lightning', 'On-chain']);
    });
});

describe('PaymentMethodList row order', () => {
    beforeEach(() => mockSupportsCashuWallet.mockReturnValue(true));

    it('lists Lightning via ecash above Lightning', async () => {
        await render(
            <PaymentMethodList
                navigation={{ navigate: jest.fn() } as any}
                lightning="lnbc1invoice"
                value="bc1qaddress"
                lightningBalance={2000}
                onchainBalance={1000}
                ecashBalance={300}
            />
        );
        expect(listLayers()).toEqual([
            'Lightning via ecash',
            'Lightning',
            'On-chain'
        ]);
    });

    it('omits Lightning via ecash when the backend has no cashu wallet', async () => {
        mockSupportsCashuWallet.mockReturnValue(false);
        await render(
            <PaymentMethodList
                navigation={{ navigate: jest.fn() } as any}
                lightning="lnbc1invoice"
                lightningBalance={2000}
            />
        );
        expect(listLayers()).toEqual(['Lightning']);
    });
});
