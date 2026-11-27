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
jest.mock('react-native-print', () => ({ print: jest.fn() }));

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import RNPrint from 'react-native-print';
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
        items,
        openWithRates,
        onScreen,
        print = false,
        pressProceed = false
    }: {
        fiatRates: any[];
        disableTips?: boolean;
        units?: string;
        amount?: string;
        payment?: any;
        squareOrder?: any;
        // products added to the cart instead of a keyed amount
        items?: any[];
        // rates that load after the order is saved, before it's opened
        openWithRates?: any[];
        onScreen?: () => Promise<void>;
        print?: boolean;
        // taps PROCEED and returns the route and params it opens
        pressProceed?: boolean;
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
            if (items) {
                // what the products pane does for each product, then REQUEST
                posStore.createCurrentOrder('USD');
                posStore.currentOrder!.line_items.push(...items);
                posStore.recalculateCurrentOrder();
                await posStore.processCheckout({ navigate } as any, false);
            } else {
                await pane.addItemAndCheckout();
            }
            const [route, params] = navigate.mock.calls[0];
            expect(route).toBe('Order');
            order = params.order;
        }
        if (payment) order.payment = payment;
        if (openWithRates) fiatStore.fiatRates = openWithRates;

        const orderView = React.createRef<any>();
        const orderNavigate = jest.fn();
        await render(
            <OrderView
                ref={orderView}
                navigation={{ navigate: orderNavigate } as any}
                route={{ params: { order } } as any}
                FiatStore={fiatStore}
                SettingsStore={settingsStore}
                UnitsStore={unitsStore}
                PosStore={posStore}
            />
        );
        if (onScreen) await onScreen();

        // Prints the receipt for the order as shown and reads its rows
        let receipt: { [key: string]: string | undefined } | undefined;
        let receiptHtml: string | undefined;
        if (print) {
            const printMock = (RNPrint as any).print as jest.Mock;
            printMock.mockClear();
            orderView.current.printReceipt();
            expect(printMock).toHaveBeenCalledTimes(1);
            receiptHtml = printMock.mock.calls[0][0].html as string;
            const rows: { [key: string]: string } = {};
            const rowPattern =
                /<tr>\s*<td[^>]*>([^<]*)<\/td>\s*<td[^>]*>([^<]*)<\/td>\s*<\/tr>/g;
            for (const [, key, value] of receiptHtml.matchAll(rowPattern)) {
                rows[key] = value;
            }
            receipt = {
                subTotalFiat: rows['pos.views.Order.subtotalFiat'],
                subTotalBitcoin: rows['pos.views.Order.subtotalBitcoin'],
                tipFiat: rows['pos.views.Order.tipFiat'],
                tipBitcoin: rows['pos.views.Order.tipBitcoin'],
                taxFiat: rows['pos.views.Order.tax (10%)'],
                totalFiat: rows['pos.views.Order.totalFiat'],
                totalBitcoin: rows['pos.views.Order.totalBitcoin']
            };
        }

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
        const button = findButton(screen.toJSON());
        if (pressProceed && !button?.props.disabled) button.props.onPress();
        const proceededTo = orderNavigate.mock.calls[0];
        return {
            subTotalFiat: line('pos.views.Order.subtotalFiat'),
            subTotalBitcoin: line('pos.views.Order.subtotalBitcoin'),
            tipFiat: line('pos.views.Order.tipFiat'),
            tipBitcoin: line('pos.views.Order.tipBitcoin'),
            taxFiat: line('pos.views.Order.taxFiat'),
            taxBitcoin: line('pos.views.Order.tax (10%)'),
            totalFiat: line('pos.views.Order.totalFiat'),
            totalBitcoin: line('pos.views.Order.totalBitcoin'),
            proceedDisabled: button?.props.disabled,
            proceededTo,
            receipt,
            receiptHtml
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

    describe('receipt', () => {
        const pressTip = (index: number) => async () => {
            await fireEvent(screen.getByTestId('tipButtons'), 'press', index);
        };
        const typeTip =
            (index: number, input: string, text: string) => async () => {
                await pressTip(index)();
                await fireEvent(screen.getByTestId(input), 'pressIn');
                await fireEvent.changeText(screen.getByTestId(input), text);
            };
        // the screen lines that the receipt also prints
        const printedLines = ({
            subTotalFiat,
            subTotalBitcoin,
            tipFiat,
            tipBitcoin,
            taxFiat,
            totalFiat,
            totalBitcoin
        }: any) => ({
            subTotalFiat,
            subTotalBitcoin,
            tipFiat,
            tipBitcoin,
            taxFiat,
            totalFiat,
            totalBitcoin
        });
        const NA = 'general.notAvailable';

        it.each([
            ['the default 20% tip', undefined, '$1.00', '$6.50'],
            ['a 25% tip', pressTip(1), '$1.25', '$6.75'],
            ['a 30% tip', pressTip(2), '$1.50', '$7.00'],
            ['the default custom 21% tip', pressTip(3), '$1.05', '$6.55'],
            [
                'a custom 15% tip',
                typeTip(3, 'tipPercent', '15'),
                '$0.75',
                '$6.25'
            ],
            ['a custom fiat tip', typeTip(3, 'tip', '2'), '$2.00', '$7.50']
        ])(
            'prints the screen amounts with %s and no rate',
            async (_, onScreen, tipFiat, totalFiat) => {
                const shown = await showOrder({
                    fiatRates: [],
                    disableTips: false,
                    onScreen,
                    print: true
                });

                expect(shown.receipt).toEqual({
                    subTotalFiat: '$5.00',
                    subTotalBitcoin: NA,
                    tipFiat,
                    tipBitcoin: NA,
                    taxFiat: '$0.50',
                    totalFiat,
                    totalBitcoin: NA
                });
                expect(shown.receipt).toEqual(printedLines(shown));
                expect(shown.receiptHtml).not.toMatch(/NaN|Infinity/);
            }
        );

        it('prints the screen amounts for a sats order with a sats tip and no rate', async () => {
            const shown = await showOrder({
                fiatRates: [],
                disableTips: false,
                units: 'sats',
                amount: '8000',
                onScreen: typeTip(3, 'tip', '100'),
                print: true
            });

            expect(shown.receipt).toEqual({
                subTotalFiat: NA,
                subTotalBitcoin: '8000 sats',
                tipFiat: NA,
                tipBitcoin: '100 sats',
                taxFiat: NA,
                totalFiat: NA,
                totalBitcoin: '8900 sats'
            });
            expect(shown.receipt).toEqual(printedLines(shown));
            expect(shown.receiptHtml).not.toMatch(/NaN|Infinity/);
        });

        it('prints a Square order with the tax taken out and no rate', async () => {
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
                },
                print: true
            });

            expect(shown.receipt).toEqual({
                subTotalFiat: '$10.00',
                subTotalBitcoin: NA,
                tipFiat: undefined,
                tipBitcoin: undefined,
                taxFiat: '$1.00',
                totalFiat: '$11.00',
                totalBitcoin: NA
            });
            expect(shown.receipt).toEqual(printedLines(shown));
            expect(shown.receiptHtml).not.toMatch(/NaN|Infinity/);
        });

        it('prints N/A for fiat on a sats order paid without a rate', async () => {
            const shown = await showOrder({
                fiatRates: [],
                disableTips: false,
                units: 'sats',
                amount: '8000',
                payment: {
                    orderTotal: '8800',
                    orderTip: '0',
                    exchangeRate: 'N/A',
                    rate: 0,
                    type: 'ln',
                    tx: 'lnbcrt1'
                },
                print: true
            });

            expect(shown.receipt).toEqual({
                subTotalFiat: NA,
                subTotalBitcoin: '8000 sats',
                tipFiat: NA,
                tipBitcoin: '0 sats',
                taxFiat: NA,
                totalFiat: NA,
                totalBitcoin: '8800 sats'
            });
            expect(shown.receipt).toEqual(printedLines(shown));
            expect(shown.receiptHtml).not.toMatch(/NaN|Infinity/);
        });

        it('prints the same amounts as before with a valid rate', async () => {
            const shown = await showOrder({
                fiatRates: [{ code: 'USD', rate: 100000 }],
                disableTips: false,
                print: true
            });

            expect(shown.receipt).toEqual({
                subTotalFiat: '$5.00',
                subTotalBitcoin: '5000 sats',
                tipFiat: '$1.00',
                tipBitcoin: '1000 sats',
                taxFiat: '$0.50',
                totalFiat: '$6.50',
                totalBitcoin: '6500 sats'
            });
        });

        it('prints the same amounts as before for a sats order with a valid rate', async () => {
            const shown = await showOrder({
                fiatRates: [{ code: 'USD', rate: 50000 }],
                disableTips: false,
                units: 'sats',
                amount: '8000',
                onScreen: typeTip(3, 'tip', '100'),
                print: true
            });

            expect(shown.receipt).toEqual({
                subTotalFiat: '$4.00',
                subTotalBitcoin: '8000 sats',
                tipFiat: '$0.05',
                tipBitcoin: '100 sats',
                taxFiat: '$0.40',
                totalFiat: '$4.45',
                totalBitcoin: '8900 sats'
            });
        });
    });

    describe('for a cart with a sats product and a USD product', () => {
        const items = [
            {
                name: 'Sticker',
                quantity: 1,
                taxPercentage: '',
                base_price_money: { amount: 0, sats: 1000 }
            },
            {
                name: 'Coffee',
                quantity: 1,
                taxPercentage: '',
                base_price_money: { amount: 5, sats: 0 }
            }
        ];
        const RATES = [{ code: 'USD', rate: 100000 }];

        it.each(['fiat', 'sats', 'BTC'])(
            "doesn't invoice the sats product alone without a rate (%s)",
            async (units) => {
                const shown = await showOrder({
                    fiatRates: [],
                    units,
                    items,
                    pressProceed: true
                });

                expect(shown.subTotalBitcoin).toBe('general.notAvailable');
                expect(shown.totalBitcoin).toBe('general.notAvailable');
                expect(shown.proceedDisabled).toBe(true);
                expect(shown.proceededTo).toBeUndefined();
            }
        );

        it.each([
            ['fiat', '6.60'],
            ['sats', '6600'],
            ['BTC', '0.00006600']
        ])(
            'invoices both products once rates load after the order was saved (%s)',
            async (units, amount) => {
                const shown = await showOrder({
                    fiatRates: [],
                    openWithRates: RATES,
                    units,
                    items,
                    pressProceed: true
                });

                expect(shown.subTotalBitcoin).toBe('6000 sats');
                expect(shown.taxBitcoin).toBe('600 sats');
                expect(shown.totalBitcoin).toBe('6600 sats');
                expect(shown.totalFiat).toBe('$6.60');
                expect(shown.proceedDisabled).toBe(false);
                expect(shown.proceededTo).toEqual([
                    'Receive',
                    expect.objectContaining({ amount, orderTotal: '6600' })
                ]);
            }
        );

        it('prints both products once rates load after the order was saved', async () => {
            const shown = await showOrder({
                fiatRates: [],
                openWithRates: RATES,
                items,
                print: true
            });

            expect(shown.receipt).toEqual({
                subTotalFiat: '$6.00',
                subTotalBitcoin: '6000 sats',
                tipFiat: undefined,
                tipBitcoin: undefined,
                taxFiat: '$0.60',
                totalFiat: '$6.60',
                totalBitcoin: '6600 sats'
            });
        });
    });
});
