jest.mock('../../stores/Stores', () => ({
    nodeInfoStore: { supportsOffers: true },
    settingsStore: { settings: {} }
}));
jest.mock('../../utils/BackendUtils', () => ({
    __esModule: true,
    default: {
        supportsCashuWallet: jest.fn(),
        supportsOnchainReceiving: jest.fn(),
        supportsOnchainSends: jest.fn()
    }
}));
jest.mock('../../utils/ClinkUtils', () => ({
    ...jest.requireActual('../../utils/ClinkUtils'),
    decodeNoffer: jest.fn()
}));
jest.mock('../../utils/LocaleUtils');
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: (key: string) => `theme:${key}`
}));
// Each row wrapper is a host carrying the props it was given
jest.mock('./LightningSwipeableRow', () => 'LightningSwipeableRow');
jest.mock('./OnchainSwipeableRow', () => 'OnchainSwipeableRow');
jest.mock('./EcashSwipeableRow', () => 'EcashSwipeableRow');
jest.mock('react-native-gesture-handler', () => {
    const { View } = require('react-native');
    return { RectButton: View };
});
jest.mock('../LinearGradient', () => 'LinearGradient');
jest.mock('../Amount', () => 'Amount');
jest.mock('../../components/SVG/OnChainSvg', () => 'OnChainSvg');
jest.mock('../../components/SVG/LightningSvg', () => 'LightningSvg');
jest.mock('../../components/SVG/EcashSvg', () => 'EcashSvg');

import * as React from 'react';
import { render, screen, within } from '@testing-library/react-native';

import PaymentMethodList from './PaymentMethodList';
import BackendUtils from '../../utils/BackendUtils';
import { decodeNoffer, NofferPriceType } from '../../utils/ClinkUtils';
import * as Stores from '../../stores/Stores';

const { nodeInfoStore, settingsStore } = Stores as any;

const WRAPPERS = [
    'LightningSwipeableRow',
    'OnchainSwipeableRow',
    'EcashSwipeableRow'
];

beforeEach(() => {
    nodeInfoStore.supportsOffers = true;
    settingsStore.settings = {};
    (BackendUtils.supportsCashuWallet as jest.Mock).mockReturnValue(false);
    (BackendUtils.supportsOnchainReceiving as jest.Mock).mockReturnValue(true);
    (BackendUtils.supportsOnchainSends as jest.Mock).mockReturnValue(true);
    (decodeNoffer as jest.Mock).mockReset();
});

const renderList = (props: Record<string, any> = {}) =>
    render(
        <PaymentMethodList
            {...({ navigation: { navigate: jest.fn() }, ...props } as any)}
        />
    );

// Each listed method: its wrapper and props, the label and subtitle shown,
// and the balance with its color
const rows = () =>
    screen.container
        .queryAll((n) => WRAPPERS.includes(n.type as string))
        .map((wrapper) => {
            const texts = within(wrapper)
                .queryAllByText(/.*/)
                .map((n) => n.props.children);
            const amount = wrapper.queryAll((n) => n.type === 'Amount')[0];
            return {
                wrapper: wrapper.type,
                props: wrapper.props,
                label: texts[0],
                subtitle: texts[1],
                balance: amount?.props.sats,
                insufficient: amount?.props.colorOverride === 'theme:error'
            };
        });

const row = (label: string) => rows().find((r) => r.label === label)!;

describe('PaymentMethodList rows', () => {
    it('lists nothing to pay without a destination', async () => {
        await renderList({ lightningBalance: 1000 });

        expect(rows()).toEqual([]);
    });

    it('offers Lightning for an invoice', async () => {
        await renderList({
            lightning: 'lnbc1invoice',
            lightningBalance: 50_000,
            lightningBalanceLabel: 'spendable'
        });

        expect(rows()).toEqual([
            expect.objectContaining({
                wrapper: 'LightningSwipeableRow',
                label: 'general.lightning',
                subtitle: 'lnbc1invoice',
                balance: 50_000,
                insufficient: false
            })
        ]);
        expect(screen.getByText('spendable')).toBeOnTheScreen();
        expect(rows()[0].props).toMatchObject({
            lightning: 'lnbc1invoice',
            locked: true,
            disabled: false
        });
    });

    it('adds Lightning via ecash when Cashu is enabled', async () => {
        (BackendUtils.supportsCashuWallet as jest.Mock).mockReturnValue(true);
        settingsStore.settings = { ecash: { enableCashu: true } };
        await renderList({
            lightning: 'lnbc1invoice',
            lightningBalance: 50_000,
            ecashBalance: 2_000
        });

        expect(rows().map((r) => [r.wrapper, r.label, r.balance])).toEqual([
            ['LightningSwipeableRow', 'general.lightning', 50_000],
            [
                'EcashSwipeableRow',
                'components.LayerBalances.lightningViaEcash',
                2_000
            ]
        ]);
    });

    it('leaves ecash out when Cashu is turned off', async () => {
        (BackendUtils.supportsCashuWallet as jest.Mock).mockReturnValue(true);
        await renderList({ lightning: 'lnbc1invoice', ecashBalance: 2_000 });

        expect(rows().map((r) => r.wrapper)).toEqual(['LightningSwipeableRow']);
    });

    it('offers a Lightning address', async () => {
        await renderList({
            lightningAddress: 'alice@example.com',
            lightningBalance: 50_000
        });

        expect(row('general.lightningAddress')).toMatchObject({
            subtitle: 'alice@example.com',
            props: { lightningAddress: 'alice@example.com' }
        });
    });

    it('disables an offer when the node cannot pay offers', async () => {
        nodeInfoStore.supportsOffers = false;
        await renderList({ offer: 'lno1offer', lightningBalance: 50_000 });

        expect(row('views.Settings.Bolt12Offer').props.disabled).toBe(true);
    });

    it('offers on-chain and the visible spending accounts', async () => {
        await renderList({
            value: 'bc1qdest',
            onchainBalance: 80_000,
            feeRate: '5',
            accounts: [
                { name: 'savings', balance: 30_000 },
                { name: 'hidden', balance: 1, hidden: true },
                { name: 'watch', balance: 1, watch_only: true }
            ]
        });

        expect(rows().map((r) => [r.label, r.balance])).toEqual([
            ['general.onchain', 80_000],
            ['savings', 30_000]
        ]);
        expect(row('general.onchain').props).toMatchObject({
            value: 'bc1qdest',
            feeRate: '5',
            account: 'default'
        });
        expect(row('savings').props.account).toBe('savings');
    });

    it('leaves on-chain out when the backend cannot receive on-chain', async () => {
        (BackendUtils.supportsOnchainReceiving as jest.Mock).mockReturnValue(
            false
        );
        await renderList({ value: 'bc1qdest', onchainBalance: 80_000 });

        expect(rows()).toEqual([]);
    });

    it('disables on-chain when the backend cannot send on-chain', async () => {
        (BackendUtils.supportsOnchainSends as jest.Mock).mockReturnValue(false);
        await renderList({ value: 'bc1qdest', onchainBalance: 80_000 });

        expect(row('general.onchain').props.disabled).toBe(true);
    });

    it('lists every method in a unified QR in order', async () => {
        await renderList({
            lightning: 'lnbc1invoice',
            lightningAddress: 'alice@example.com',
            offer: 'lno1offer',
            value: 'bc1qdest',
            clinkNoffer: 'noffer1',
            lightningBalance: 50_000,
            onchainBalance: 80_000
        });

        expect(rows().map((r) => r.label)).toEqual([
            'general.lightning',
            'general.lightningAddress',
            'views.Settings.Bolt12Offer',
            'general.onchain',
            'views.Settings.Noffer'
        ]);
    });
});

describe('PaymentMethodList balance checks', () => {
    it.each([
        ['empty', 0, undefined, true],
        ['short of the amount', 999, 1000, true],
        ['exactly the amount', 1000, 1000, false],
        ['without an amount', 1, undefined, false]
    ])(
        'disables a method whose balance is %s',
        async (_label, lightningBalance, satAmount, disabled) => {
            await renderList({
                lightning: 'lnbc1invoice',
                lightningBalance,
                satAmount
            });

            expect(row('general.lightning').props.disabled).toBe(disabled);
            expect(row('general.lightning').insufficient).toBe(disabled);
        }
    );

    it('reads a numeric string amount', async () => {
        await renderList({
            value: 'bc1qdest',
            onchainBalance: 500,
            satAmount: '1000'
        });

        expect(row('general.onchain').props).toMatchObject({
            disabled: true,
            satAmount: 1000
        });
    });

    it('ignores an amount that is not a number', async () => {
        await renderList({
            value: 'bc1qdest',
            onchainBalance: 500,
            satAmount: 'abc'
        });

        expect(row('general.onchain').props).toMatchObject({
            disabled: false,
            satAmount: undefined
        });
    });

    it('judges Lightning by the eligibility balance when given', async () => {
        // capacity in an offline channel is shown but cannot be spent
        await renderList({
            lightning: 'lnbc1invoice',
            lightningBalance: 50_000,
            lightningEligibilityBalance: 0
        });

        expect(row('general.lightning')).toMatchObject({
            balance: 50_000,
            insufficient: true,
            props: { disabled: true }
        });
    });

    it('never disables an LNURL withdraw, which adds funds', async () => {
        await renderList({
            lnurlParams: {
                tag: 'withdrawRequest',
                domain: 'faucet.example',
                callback: 'https://faucet.example/withdraw',
                defaultDescription: ''
            },
            lightningBalance: 0,
            satAmount: 1000
        });

        expect(row('general.lightning')).toMatchObject({
            subtitle: 'faucet.example',
            insufficient: false,
            props: { disabled: false }
        });
    });

    it('describes a withdraw by its description first', async () => {
        await renderList({
            lnurlParams: {
                tag: 'withdrawRequest',
                domain: 'faucet.example',
                defaultDescription: 'Free sats'
            }
        });

        expect(row('general.lightning').subtitle).toBe('Free sats');
    });

    it('names a withdraw by the host its callback is sent to', async () => {
        await renderList({
            lnurlParams: {
                tag: 'withdrawRequest',
                // what js-lnurl's getDomain makes of this callback
                domain: 'faucet.example',
                callback: 'https://other.example\\@faucet.example/withdraw',
                defaultDescription: ''
            }
        });

        expect(row('general.lightning').subtitle).toBe('other.example');
    });

    it('checks each account against its own balance', async () => {
        await renderList({
            value: 'bc1qdest',
            onchainBalance: 500,
            satAmount: 1000,
            accounts: [{ name: 'savings', balance: 5000 }]
        });

        expect(row('general.onchain').props.disabled).toBe(true);
        expect(row('savings').props.disabled).toBe(false);
    });
});

describe('PaymentMethodList CLINK offers', () => {
    const decodesTo = (priceType: NofferPriceType, price?: number) =>
        (decodeNoffer as jest.Mock).mockReturnValue({ priceType, price });

    it('checks a fixed-price offer against the larger of Lightning and ecash', async () => {
        (BackendUtils.supportsCashuWallet as jest.Mock).mockReturnValue(true);
        settingsStore.settings = { ecash: { enableCashu: true } };
        decodesTo(NofferPriceType.Fixed, 3000);
        await renderList({
            clinkNoffer: 'noffer1',
            lightningBalance: 1000,
            ecashBalance: 5000,
            satAmount: 99_999
        });

        expect(row('views.Settings.Noffer')).toMatchObject({
            balance: 5000,
            insufficient: false,
            props: { clinkNoffer: 'noffer1', disabled: false }
        });
    });

    it('disables a fixed-price offer neither balance covers', async () => {
        decodesTo(NofferPriceType.Fixed, 3000);
        await renderList({
            clinkNoffer: 'noffer1',
            lightningBalance: 1000,
            ecashBalance: 5000
        });

        // ecash does not count while Cashu is off
        expect(row('views.Settings.Noffer')).toMatchObject({
            balance: 1000,
            insufficient: true,
            props: { disabled: true }
        });
    });

    it.each([
        ['variable', NofferPriceType.Variable],
        ['spontaneous', NofferPriceType.Spontaneous]
    ])(
        'shows no balance for a %s offer and allows it with funds',
        async (_label, priceType) => {
            decodesTo(priceType);
            await renderList({ clinkNoffer: 'noffer1', lightningBalance: 1 });

            expect(row('views.Settings.Noffer')).toMatchObject({
                balance: undefined,
                props: { disabled: false }
            });
        }
    );

    it('ignores a price on an offer that is not fixed-price', async () => {
        decodesTo(NofferPriceType.Variable, 3000);
        await renderList({ clinkNoffer: 'noffer1', lightningBalance: 1000 });

        expect(row('views.Settings.Noffer')).toMatchObject({
            balance: undefined,
            props: { disabled: false }
        });
    });

    it('disables any offer when there are no funds at all', async () => {
        decodesTo(NofferPriceType.Variable);
        await renderList({ clinkNoffer: 'noffer1', lightningBalance: 0 });

        expect(row('views.Settings.Noffer').props.disabled).toBe(true);
    });

    it('still lists an offer that cannot be decoded', async () => {
        (decodeNoffer as jest.Mock).mockImplementation(() => {
            throw new Error('bad bech32');
        });
        await renderList({ clinkNoffer: 'noffer1', lightningBalance: 1 });

        expect(row('views.Settings.Noffer')).toMatchObject({
            balance: undefined,
            props: { disabled: false }
        });
    });
});
