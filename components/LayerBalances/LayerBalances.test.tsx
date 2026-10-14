jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../../stores/Stores', () => ({
    cashuStore: {},
    utxosStore: { hideAccount: jest.fn(), unhideAccount: jest.fn() }
}));
jest.mock('../../utils/BackendUtils', () => ({
    __esModule: true,
    default: {
        supportsOnchainReceiving: jest.fn(),
        supportsCashuWallet: jest.fn()
    }
}));
jest.mock('../../utils/LocaleUtils');
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: (key: string) => `theme:${key}`,
    blendHexColors: (a: string, b: string, t: number) => `blend(${a},${b},${t})`
}));
// Each row wrapper is a host carrying the props it was given
jest.mock('./LightningSwipeableRow', () => 'LightningSwipeableRow');
jest.mock('./OnchainSwipeableRow', () => 'OnchainSwipeableRow');
jest.mock('./EcashSwipeableRow', () => 'EcashSwipeableRow');
jest.mock('../LinearGradient', () => 'LinearGradient');
jest.mock('../Amount', () => 'Amount');
jest.mock('../Pill', () => 'Pill');
jest.mock('../MintAvatar', () => 'MintAvatar');
jest.mock('../Button', () => {
    const { Pressable, Text } = require('react-native');
    return ({ title, onPress }: any) => (
        <Pressable role="button" onPress={onPress}>
            <Text>{title}</Text>
        </Pressable>
    );
});
jest.mock('../../assets/images/SVG/eye_closed.svg', () => 'EyeClosed');
jest.mock('../../assets/images/SVG/eye_opened.svg', () => 'EyeOpened');
jest.mock('../../components/SVG/EcashSvg', () => 'EcashSvg');
jest.mock('../../components/SVG/OnChainSvg', () => 'OnChainSvg');
jest.mock('../../components/SVG/LightningSvg', () => 'LightningSvg');
jest.mock('../../components/SVG/MatiSvg', () => 'MatiSvg');

import * as React from 'react';
import {
    fireEvent,
    render,
    screen,
    within
} from '@testing-library/react-native';

import LayerBalances from './index';
import BackendUtils from '../../utils/BackendUtils';
import * as Stores from '../../stores/Stores';

const { cashuStore, utxosStore } = Stores as any;

const WRAPPERS = [
    'LightningSwipeableRow',
    'OnchainSwipeableRow',
    'EcashSwipeableRow'
];
const MORE = 'components.LayerBalances.moreAccounts';

beforeEach(() => {
    (BackendUtils.supportsOnchainReceiving as jest.Mock).mockReturnValue(true);
    (BackendUtils.supportsCashuWallet as jest.Mock).mockReturnValue(false);
    utxosStore.hideAccount.mockClear();
    utxosStore.unhideAccount.mockClear();
    Object.assign(cashuStore, {
        totalBalanceSats: 0,
        mintUrls: ['https://mint.example'],
        mintInfos: {}
    });
    jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

const renderBalances = ({
    balances = {},
    cashu = {},
    accounts = [],
    enableCashu = false,
    ...props
}: {
    balances?: Record<string, number>;
    cashu?: Record<string, any>;
    accounts?: any[];
    enableCashu?: boolean;
    [prop: string]: any;
} = {}) => {
    Object.assign(cashuStore, cashu);
    const navigation = { navigate: jest.fn() };
    const onRefresh = jest.fn();
    return render(
        <LayerBalances
            {...({
                navigation,
                onRefresh,
                BalanceStore: {
                    lightningBalance: 50_000,
                    totalBlockchainBalance: 80_000,
                    settledBlockchainBalance: 75_000,
                    ...balances
                },
                CashuStore: cashuStore,
                UTXOsStore: { accounts },
                SettingsStore: {
                    settings: { ecash: { enableCashu } }
                },
                ...props
            } as any)}
        />
    ).then(() => ({ navigation, onRefresh }));
};

// Each balance row: its wrapper (or none for plain rows), the props it was
// given, the label shown and the balance
const rows = () =>
    screen.container
        .queryAll((n) => n.type === 'LinearGradient')
        .map((gradient) => {
            let wrapper: any = gradient.parent;
            while (wrapper && !WRAPPERS.includes(wrapper.type)) {
                wrapper = wrapper.parent;
            }
            const texts = within(gradient)
                .queryAllByText(/.*/)
                .map((n) => n.props.children);
            return {
                wrapper: wrapper?.type,
                props: wrapper?.props,
                label: texts[0],
                texts,
                gradient: gradient.props.colors,
                balance: gradient.queryAll((n) => n.type === 'Amount')[0]?.props
                    .sats
            };
        });

const row = (label: string) => rows().find((r) => r.label === label)!;

describe('LayerBalances layers', () => {
    it('shows Lightning and on-chain balances', async () => {
        await renderBalances();

        expect(rows().map((r) => [r.wrapper, r.label, r.balance])).toEqual([
            ['LightningSwipeableRow', 'general.lightning', '50000.000'],
            ['OnchainSwipeableRow', 'general.onchain', '75000.000']
        ]);
    });

    it('leaves on-chain out when the backend has none', async () => {
        (BackendUtils.supportsOnchainReceiving as jest.Mock).mockReturnValue(
            false
        );
        await renderBalances();

        expect(rows().map((r) => r.label)).toEqual(['general.lightning']);
    });

    it('passes the payment details to each row', async () => {
        await renderBalances({
            value: 'bc1qdest',
            satAmount: '1000',
            lightning: 'lnbc1invoice',
            offer: 'lno1offer',
            locked: true
        });

        expect(row('general.lightning').props).toMatchObject({
            lightning: 'lnbc1invoice',
            offer: 'lno1offer',
            locked: true
        });
        expect(row('general.onchain').props).toMatchObject({
            value: 'bc1qdest',
            satAmount: 1000,
            locked: true
        });
    });

    it('offers to move funds to Lightning when only on-chain has funds', async () => {
        const { navigation } = await renderBalances({
            balances: { lightningBalance: 0 }
        });

        await fireEvent.press(
            screen.getByRole('button', {
                name: 'components.LayerBalances.moveFundsToLn'
            })
        );

        expect(navigation.navigate).toHaveBeenCalledWith('OpenChannel');
    });

    it.each([
        ['Lightning has funds', { lightningBalance: 1 }],
        [
            'there are no funds',
            { lightningBalance: 0, totalBlockchainBalance: 0 }
        ]
    ])('does not offer to move funds when %s', async (_label, balances) => {
        await renderBalances({ balances });

        expect(
            screen.queryByText('components.LayerBalances.moveFundsToLn')
        ).not.toBeOnTheScreen();
    });

    it('refreshes on pull', async () => {
        const { onRefresh } = await renderBalances();

        screen.container
            .queryAll((n) => n.props.onRefresh)[0]
            .props.onRefresh();

        expect(onRefresh).toHaveBeenCalled();
    });
});

describe('LayerBalances ecash', () => {
    const mints = [
        'https://a.mint',
        'https://b.mint',
        'https://c.mint',
        'https://d.mint'
    ];

    beforeEach(() => {
        (BackendUtils.supportsCashuWallet as jest.Mock).mockReturnValue(true);
    });

    it('shows the ecash balance, marked custodial, with mint icons', async () => {
        await renderBalances({
            enableCashu: true,
            cashu: {
                totalBalanceSats: 2_100,
                mintUrls: mints,
                mintInfos: {
                    'https://a.mint': {
                        name: 'Mint A',
                        icon_url: 'https://a.mint/icon.png'
                    }
                }
            }
        });

        const ecash = row('Ecash');
        expect(ecash.wrapper).toBe('EcashSwipeableRow');
        expect(ecash.balance).toBe('2100.000');
        expect(ecash.props.needsConfig).toBe(false);
        const avatars = screen.container.queryAll(
            (n) => n.type === 'MintAvatar'
        );
        expect(avatars.map((n) => n.props.mintUrl)).toEqual(mints.slice(0, 3));
        expect(avatars[0].props).toMatchObject({
            name: 'Mint A',
            iconUrl: 'https://a.mint/icon.png'
        });
        expect(screen.getByText('+1')).toBeOnTheScreen();
        expect(
            screen.container
                .queryAll((n) => n.type === 'Pill')
                .map((n) => n.props.title)
        ).toEqual(['GENERAL.CUSTODIALWALLET']);
    });

    it('asks for a mint instead of a balance when none is set up', async () => {
        await renderBalances({ enableCashu: true, cashu: { mintUrls: [] } });

        const ecash = row('Ecash');
        expect(ecash.balance).toBeUndefined();
        expect(ecash.props.needsConfig).toBe(true);
        expect(
            screen.container
                .queryAll((n) => n.type === 'Pill')
                .map((n) => n.props.title)
        ).toEqual(['CASHU.TAPTOCONFIGURE']);
    });

    it('is left out while Cashu is turned off', async () => {
        await renderBalances();

        expect(row('Ecash')).toBeUndefined();
    });

    it('warms the ecash row color from exactly 10,000 sats', async () => {
        await renderBalances({
            enableCashu: true,
            cashu: { totalBalanceSats: 10_000 }
        });

        expect(row('Ecash').gradient).toEqual([
            'blend(theme:buttonBackground,theme:warning,0.1)',
            'theme:error'
        ]);
    });

    it('scales the warning blend with the ecash balance', async () => {
        await renderBalances({
            enableCashu: true,
            cashu: { totalBalanceSats: 50_000 }
        });

        expect(row('Ecash').gradient).toEqual([
            'blend(theme:buttonBackground,theme:warning,0.5)',
            'theme:error'
        ]);
    });

    it('keeps the plain row color below 10,000 sats', async () => {
        await renderBalances({
            enableCashu: true,
            cashu: { totalBalanceSats: 9_999 }
        });

        expect(row('Ecash').gradient).toBe('theme:buttonGradient');
    });
});

describe('LayerBalances accounts', () => {
    const ACCOUNTS = [
        { name: 'savings', XFP: 'abcd1234', balance: 30_000 },
        { name: 'cold', balance: 0, watch_only: true },
        { name: 'old', balance: 5, hidden: true }
    ];

    it('lists visible accounts with their fingerprint and watch-only icon', async () => {
        await renderBalances({ accounts: ACCOUNTS });

        expect(rows().map((r) => r.label)).toEqual([
            'general.lightning',
            'general.onchain',
            'savings',
            'cold'
        ]);
        expect(row('savings')).toMatchObject({
            texts: ['savings', 'abcd1234'],
            balance: 30_000,
            props: { account: 'savings', hidden: false }
        });
        expect(
            screen.container.queryAll((n) => n.type === 'MatiSvg')
        ).toHaveLength(1);
    });

    it('lists hidden accounts too in edit mode, and locks every row', async () => {
        await renderBalances({ accounts: ACCOUNTS, editMode: true });

        expect(row('old').props).toMatchObject({ hidden: true, locked: true });
        expect(row('general.lightning').props.locked).toBe(true);
    });

    it('hides and unhides accounts from edit mode', async () => {
        await renderBalances({ accounts: ACCOUNTS, editMode: true });

        await fireEvent.press(
            screen.container.queryAll((n) => n.type === 'EyeOpened')[0]
        );
        await fireEvent.press(
            screen.container.queryAll((n) => n.type === 'EyeClosed')[0]
        );

        expect(utxosStore.hideAccount).toHaveBeenCalledWith('savings');
        expect(utxosStore.unhideAccount).toHaveBeenCalledWith('old');
    });

    it('shows only the first account and a link to the rest when consolidated', async () => {
        const { navigation } = await renderBalances({
            accounts: [
                { name: 'savings', balance: 30_000 },
                { name: 'spending', balance: 1_000 },
                { name: 'gifts', balance: 500 }
            ],
            consolidated: true
        });

        expect(rows().map((r) => r.label)).toEqual([
            'general.lightning',
            'general.onchain',
            'savings',
            MORE
        ]);
        expect(row(MORE).texts).toEqual([MORE, '+2']);

        await fireEvent.press(screen.getByText(MORE));

        expect(navigation.navigate).toHaveBeenCalledWith('Accounts');
    });

    it('shows no link when there is only one account', async () => {
        await renderBalances({
            accounts: [{ name: 'savings', balance: 30_000 }],
            consolidated: true
        });

        expect(row(MORE)).toBeUndefined();
    });
});
