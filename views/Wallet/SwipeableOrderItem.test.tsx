import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import FiatStore from '../../stores/FiatStore';

jest.mock('react-native-blob-util', () => ({
    __esModule: true,
    default: { fetch: jest.fn() }
}));
jest.mock('../../stores/SettingsStore', () => ({
    __esModule: true,
    default: class SettingsStore {},
    PosEnabled: {
        Disabled: 'disabled',
        Square: 'square',
        Standalone: 'standalone'
    }
}));
// UnitsUtils, imported by FiatStore for number formatting, loads the store
// graph
jest.mock('../../stores/Stores', () => ({
    settingsStore: { settings: { display: {} } },
    fiatStore: {
        symbolLookup: () => ({
            symbol: '$',
            space: false,
            rtl: false,
            separatorSwap: false
        })
    }
}));
// The swipe actions are not opened here; reanimated's ESM entry does not
// load in jest
jest.mock('react-native-reanimated', () => {
    const { View } = require('react-native');
    return {
        __esModule: true,
        default: { View },
        Extrapolation: { CLAMP: 'clamp' },
        interpolate: () => 0,
        useAnimatedStyle: () => ({})
    };
});
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
    const { View } = require('react-native');
    return {
        __esModule: true,
        default: ({ children }: any) => <View>{children}</View>
    };
});
jest.mock('../../components/Button', () => () => null);
jest.mock('./OrderItem', () => {
    const { Text } = require('react-native');
    return ({ title }: any) => <Text>{title}</Text>;
});
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: (key: string) => `theme:${key}`
}));

import SwipeableOrderItem from './SwipeableOrderItem';

const usdEntry = {
    code: 'USD',
    rate: 50000,
    cryptoCode: 'BTC',
    currencyPair: 'USD/BTC'
};

const satsLine = {
    name: 'Custom item',
    quantity: 1,
    base_price_money: { amount: 0, sats: 1000 }
};
// A standalone line priced in fiat: amount in currency units, no sats
const fiatLine = {
    name: 'Coffee',
    quantity: 1,
    // $0.50, below 1 on purpose: the check is `amount > 0`
    base_price_money: { amount: 0.5, sats: 0 }
};

const order: any = {
    line_items: [satsLine],
    getItemsList: 'Custom item',
    getTotalMoneyDisplay: '$5.00',
    getDisplayTime: '11:58'
};
const fiatOrder: any = { ...order, line_items: [fiatLine] };
const mixedOrder: any = { ...order, line_items: [satsLine, fiatLine] };
// Order reads a paid order's rate and total from its payment
const payment = {
    orderTotal: 1000,
    orderTip: 0,
    rate: 50000,
    exchangeRate: '$50,000.00'
};
const paidFiatOrder: any = { ...fiatOrder, payment };
const paidOrder: any = { ...order, payment };
const noLinesOrder: any = { ...order };
delete noLinesOrder.line_items;

// Taps an open order and returns navigation.navigate
const tapOrder = async (
    fiatRates: any,
    {
        fiat = 'USD',
        fiatEnabled = true,
        posEnabled = 'standalone',
        item = order
    }: {
        fiat?: string;
        fiatEnabled?: boolean;
        posEnabled?: string;
        item?: any;
    } = {}
) => {
    const fiatStore = new FiatStore({
        settings: { fiat, fiatEnabled, pos: { posEnabled } }
    } as any);
    fiatStore.fiatRates = fiatRates;
    const navigation: any = { navigate: jest.fn() };

    await render(
        <SwipeableOrderItem
            item={item}
            navigation={navigation}
            fiatStore={fiatStore}
            onClickPaid={jest.fn()}
            onClickHide={jest.fn()}
            onSwipeableOpen={jest.fn()}
        />
    );
    await fireEvent.press(screen.getByText('Custom item'));

    return navigation.navigate;
};

describe('SwipeableOrderItem', () => {
    it('opens the order when the currency has a rate', async () => {
        expect(await tapOrder([usdEntry])).toHaveBeenCalledWith('Order', {
            order
        });
    });

    // #5813: the rates loaded, but none of them is usable for this currency
    it.each([
        ['the rates list is empty', [], 'USD'],
        ['the currency has no row', [usdEntry], 'IDR'],
        ['the rate is 0', [{ ...usdEntry, rate: 0 }], 'USD']
    ])('opens the order when %s', async (_, fiatRates, fiat) => {
        expect(await tapOrder(fiatRates, { fiat })).toHaveBeenCalledWith(
            'Order',
            { order }
        );
    });

    it('does not open the order before any rates load', async () => {
        expect(await tapOrder(undefined)).not.toHaveBeenCalled();
    });

    // #5852
    it('opens an order priced in sats with fiat off, where nothing loads rates', async () => {
        expect(
            await tapOrder(undefined, { fiatEnabled: false })
        ).toHaveBeenCalledWith('Order', { order });
    });

    // An order priced in fiat needs a rate for its sats in Order
    it('does not open a Square order with fiat off before any rates load', async () => {
        expect(
            await tapOrder(undefined, {
                fiatEnabled: false,
                posEnabled: 'square'
            })
        ).not.toHaveBeenCalled();
    });

    it('opens a Square order with fiat off once rates have loaded', async () => {
        expect(
            await tapOrder([usdEntry], {
                fiatEnabled: false,
                posEnabled: 'square'
            })
        ).toHaveBeenCalledWith('Order', { order });
    });

    it.each([
        ['only a fiat-priced line', fiatOrder],
        ['a sats line and a fiat-priced line', mixedOrder]
    ])(
        'does not open an order with %s with fiat off before any rates load',
        async (_, item) => {
            expect(
                await tapOrder(undefined, { fiatEnabled: false, item })
            ).not.toHaveBeenCalled();
        }
    );

    it('opens an order without line items with fiat off, where nothing loads rates', async () => {
        expect(
            await tapOrder(undefined, {
                fiatEnabled: false,
                item: noLinesOrder
            })
        ).toHaveBeenCalledWith('Order', { order: noLinesOrder });
    });

    it.each([
        ['a paid order with a fiat-priced line', 'standalone', paidFiatOrder],
        ['a paid Square order', 'square', paidOrder]
    ])(
        'opens %s with fiat off before any rates load',
        async (_, posEnabled, item) => {
            expect(
                await tapOrder(undefined, {
                    fiatEnabled: false,
                    posEnabled,
                    item
                })
            ).toHaveBeenCalledWith('Order', { order: item });
        }
    );

    it('opens a paid order with fiat on before any rates load', async () => {
        expect(
            await tapOrder(undefined, { item: paidOrder })
        ).toHaveBeenCalledWith('Order', { order: paidOrder });
    });

    it('opens an order with a fiat-priced line with fiat off once rates have loaded', async () => {
        expect(
            await tapOrder([usdEntry], { fiatEnabled: false, item: fiatOrder })
        ).toHaveBeenCalledWith('Order', { order: fiatOrder });
    });
});
