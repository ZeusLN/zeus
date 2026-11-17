jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('react-native-blob-util', () => ({ fetch: jest.fn() }));
jest.mock('../../storage', () => ({
    __esModule: true,
    default: { getItem: jest.fn(async () => null), setItem: jest.fn() }
}));
jest.mock('../../stores/SettingsStore', () => ({
    PosEnabled: {
        Disabled: 'disabled',
        Square: 'square',
        Standalone: 'standalone'
    }
}));
jest.mock('../../stores/Stores', () => ({
    __esModule: true,
    fiatStore: { formatAmountForDisplay: (v: string) => `$${v}` }
}));
jest.mock('../../utils/BackendUtils', () => ({
    __esModule: true,
    default: { supportsCashuWallet: () => false }
}));
jest.mock('../../utils/LocaleUtils');
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
jest.mock('../../components/Button', () => 'Button');
jest.mock('../../components/KeypadAmountDisplay', () => 'KeypadAmountDisplay');
jest.mock('../../components/PinPad', () => 'PinPad');
jest.mock('../../components/UnitToggle', () => 'UnitToggle');
jest.mock('../../components/WalletHeader', () => 'WalletHeader');
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/TextInput', () => {
    const { TextInput } = require('react-native');
    return ({ suffix, ...props }: any) => (
        <TextInput testID={suffix === '%' ? 'tipPercent' : 'tip'} {...props} />
    );
});
jest.mock('../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../../components/Amount', () => {
    const { Text } = require('react-native');
    return ({ sats, fixedUnits }: any) => (
        <Text>{`${sats} ${fixedUnits}`}</Text>
    );
});
jest.mock('../../components/KeyValue', () => {
    const { Text, View } = require('react-native');
    return ({ keyValue, value }: any) => (
        <View testID={`kv:${keyValue}`}>
            {typeof value === 'string' ? <Text>{value}</Text> : value}
        </View>
    );
});
jest.mock('../../utils/AmountUtils', () => ({
    getFormattedAmount: (amount: string, units: string) => `${amount} ${units}`
}));
jest.mock('@rneui/themed', () => {
    const { View } = require('react-native');
    return {
        ButtonGroup: ({ onPress }: any) => (
            <View testID="tipButtons" onPress={onPress} />
        )
    };
});
jest.mock('react-native-print', () => ({}));

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import PosKeypadPane from './StandalonePosKeypadPane';
import OrderView from '../Order';
import PosStore from '../../stores/PosStore';

describe('StandalonePosKeypadPane with tax and an empty rate list', () => {
    const makePane = () => {
        const settingsStore: any = {
            settings: { fiat: 'USD', pos: { taxPercentage: '8' } }
        };
        const fiatStore: any = { fiatRates: [], getRate: () => '$N/A' };
        const unitsStore: any = { units: 'fiat' };
        const posStore = new PosStore(settingsStore, fiatStore, unitsStore);
        const navigate = jest.fn();
        const pane = new PosKeypadPane({
            navigation: { navigate } as any,
            FiatStore: fiatStore,
            PosStore: posStore,
            SettingsStore: settingsStore,
            UnitsStore: unitsStore
        });
        pane.state = { amount: '10' };
        return { pane, posStore, navigate };
    };

    it.each([
        ['quick pay', 'addItemAndQuickPay'],
        ['request', 'addItemAndCheckout']
    ])(
        '%s shows an order with one line item per tap and no invoice',
        async (_, action) => {
            const { pane, posStore, navigate } = makePane();

            await (pane as any)[action]();
            await (pane as any)[action]();

            expect(navigate).toHaveBeenCalledTimes(2);
            navigate.mock.calls.forEach(([route, params]) => {
                expect(route).toBe('Order');
                expect(params.order.line_items).toHaveLength(1);
                expect(params.order.total_money.amount).toBe(1000);
            });
            expect(posStore.openOrders).toHaveLength(2);
        }
    );
});

describe('Order screen for a keyed order with 10% tax', () => {
    // Keys an amount on the keypad, taps REQUEST and renders the Order
    // screen it opens (or renders a given Square order). Returns the text
    // shown for each summary line.
    const showOrder = async ({
        fiatRates,
        disableTips = true,
        units = 'fiat',
        amount = '5',
        payment,
        squareOrder,
        onScreen
    }: {
        fiatRates: any[];
        disableTips?: boolean;
        units?: string;
        amount?: string;
        payment?: any;
        squareOrder?: any;
        onScreen?: () => Promise<void>;
    }) => {
        const settingsStore: any = {
            settings: {
                fiat: 'USD',
                fiatEnabled: true,
                pos: {
                    posEnabled: squareOrder ? 'square' : 'standalone',
                    taxPercentage: '10',
                    disableTips
                }
            }
        };
        const fiatStore: any = {
            fiatRates,
            getRate: () => 'rate',
            getSymbol: () => ({ symbol: '$', rtl: false }),
            formatAmountForDisplay: (v: string) => `$${v}`
        };
        const unitsStore: any = { units, changeUnits: jest.fn() };
        const posStore = new PosStore(settingsStore, fiatStore, unitsStore);
        const navigate = jest.fn();
        const pane = new PosKeypadPane({
            navigation: { navigate } as any,
            FiatStore: fiatStore,
            PosStore: posStore,
            SettingsStore: settingsStore,
            UnitsStore: unitsStore
        });
        pane.state = { amount };
        let order = squareOrder;
        if (!order) {
            await pane.addItemAndCheckout();
            const [route, params] = navigate.mock.calls[0];
            expect(route).toBe('Order');
            order = params.order;
        }
        if (payment) order.payment = payment;

        await render(
            <OrderView
                navigation={{ navigate: jest.fn() } as any}
                route={{ params: { order } } as any}
                FiatStore={fiatStore}
                SettingsStore={settingsStore}
                UnitsStore={unitsStore}
                PosStore={posStore}
            />
        );
        if (onScreen) await onScreen();

        const textOf = (node: any): string =>
            typeof node === 'string'
                ? node
                : (node.children || []).map(textOf).join(' ');
        const line = (key: string) => {
            const node = screen.queryByTestId(`kv:${key}`);
            return node ? textOf(node) : undefined;
        };
        // The only button on an unpaid order without a printer is PROCEED
        const findButton = (node: any): any => {
            if (!node || typeof node === 'string') return undefined;
            if (Array.isArray(node)) return node.map(findButton).find(Boolean);
            if (node.type === 'Button') return node;
            return findButton(node.children);
        };
        return {
            subTotalFiat: line('pos.views.Order.subtotalFiat'),
            subTotalBitcoin: line('pos.views.Order.subtotalBitcoin'),
            tipFiat: line('pos.views.Order.tipFiat'),
            tipBitcoin: line('pos.views.Order.tipBitcoin'),
            taxFiat: line('pos.views.Order.taxFiat'),
            taxBitcoin: line('pos.views.Order.tax (10%)'),
            totalFiat: line('pos.views.Order.totalFiat'),
            totalBitcoin: line('pos.views.Order.totalBitcoin'),
            proceedDisabled: findButton(screen.toJSON())?.props.disabled
        };
    };

    it('shows the fiat amounts without a rate, and N/A for sats', async () => {
        const shown = await showOrder({ fiatRates: [] });

        expect(shown).toEqual({
            subTotalFiat: '$5.00',
            subTotalBitcoin: 'general.notAvailable',
            tipFiat: undefined,
            tipBitcoin: undefined,
            taxFiat: '$0.50',
            taxBitcoin: 'general.notAvailable',
            totalFiat: '$5.50',
            totalBitcoin: 'general.notAvailable',
            proceedDisabled: true
        });
        expect(JSON.stringify(screen.toJSON())).not.toMatch(/NaN|Infinity/);
    });

    it('adds the default 20% tip to the fiat total without a rate', async () => {
        const shown = await showOrder({ fiatRates: [], disableTips: false });

        expect(shown).toEqual({
            subTotalFiat: '$5.00',
            subTotalBitcoin: 'general.notAvailable',
            tipFiat: '$1.00',
            tipBitcoin: 'general.notAvailable',
            taxFiat: '$0.50',
            taxBitcoin: 'general.notAvailable',
            totalFiat: '$6.50',
            totalBitcoin: 'general.notAvailable',
            proceedDisabled: true
        });
        expect(JSON.stringify(screen.toJSON())).not.toMatch(/NaN|Infinity/);
    });

    it('adds a custom fiat tip to the fiat total without a rate', async () => {
        const shown = await showOrder({
            fiatRates: [],
            disableTips: false,
            onScreen: async () => {
                await fireEvent(screen.getByTestId('tipButtons'), 'press', 3);
                await fireEvent(screen.getByTestId('tip'), 'pressIn');
                await fireEvent.changeText(screen.getByTestId('tip'), '2');
            }
        });

        expect(shown.tipFiat).toBe('$2.00');
        expect(shown.totalFiat).toBe('$7.50');
        expect(shown.tipBitcoin).toBe('general.notAvailable');
        expect(JSON.stringify(screen.toJSON())).not.toMatch(/NaN|Infinity/);
    });

    it('takes the tax out of a Square total without a rate', async () => {
        const shown = await showOrder({
            fiatRates: [],
            squareOrder: {
                id: 'square-1',
                line_items: [
                    {
                        name: 'Coffee',
                        quantity: 1,
                        base_price_money: { amount: 1100 }
                    }
                ],
                total_money: { amount: 1100, currency: 'USD' },
                total_tax_money: { amount: 100, currency: 'USD' }
            }
        });

        expect(shown.subTotalFiat).toBe('$10.00');
        expect(shown.taxFiat).toBe('$1.00');
        expect(shown.totalFiat).toBe('$11.00');
        expect(shown.proceedDisabled).toBe(true);
    });

    it('shows the same amounts as before with a valid rate', async () => {
        const shown = await showOrder({
            fiatRates: [{ code: 'USD', rate: 100000 }],
            disableTips: false
        });

        expect(shown).toEqual({
            subTotalFiat: '$5.00',
            subTotalBitcoin: '5000 sats',
            tipFiat: '$1.00',
            tipBitcoin: '1000 sats',
            taxFiat: '$0.50',
            taxBitcoin: '500 sats',
            totalFiat: '$6.50',
            totalBitcoin: '6500 sats',
            proceedDisabled: false
        });
    });

    it('converts a sats order to fiat with a valid rate', async () => {
        const shown = await showOrder({
            fiatRates: [{ code: 'USD', rate: 50000 }],
            units: 'sats',
            amount: '8000'
        });

        expect(shown).toEqual({
            subTotalFiat: '$4.00',
            subTotalBitcoin: '8000 sats',
            tipFiat: undefined,
            tipBitcoin: undefined,
            taxFiat: '$0.40',
            taxBitcoin: '800 sats',
            totalFiat: '$4.40',
            totalBitcoin: '8800 sats',
            proceedDisabled: false
        });
    });

    it('shows N/A for fiat on a sats order paid without a rate', async () => {
        const shown = await showOrder({
            fiatRates: [],
            units: 'sats',
            amount: '8000',
            payment: {
                orderTotal: '8800',
                orderTip: '0',
                exchangeRate: 'N/A',
                rate: 0,
                type: 'ln',
                tx: 'lnbcrt1'
            }
        });

        expect(shown).toEqual({
            subTotalFiat: 'general.notAvailable',
            subTotalBitcoin: '8000 sats',
            tipFiat: 'general.notAvailable',
            tipBitcoin: '0 sats',
            taxFiat: 'general.notAvailable',
            taxBitcoin: '800 sats',
            totalFiat: 'general.notAvailable',
            totalBitcoin: '8800 sats',
            proceedDisabled: undefined
        });
    });
});
