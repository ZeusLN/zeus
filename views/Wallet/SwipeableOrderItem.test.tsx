import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import FiatStore from '../../stores/FiatStore';

jest.mock('react-native-blob-util', () => ({
    __esModule: true,
    default: { fetch: jest.fn() }
}));
jest.mock('../../stores/SettingsStore', () => ({
    __esModule: true,
    default: class SettingsStore {}
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

const order: any = {
    getItemsList: 'Custom item',
    getTotalMoneyDisplay: '$5.00',
    getDisplayTime: '11:58'
};

// Taps an open order and returns navigation.navigate
const tapOrder = async (fiatRates: any, fiat: string = 'USD') => {
    const fiatStore = new FiatStore({ settings: { fiat } } as any);
    fiatStore.fiatRates = fiatRates;
    const navigation: any = { navigate: jest.fn() };

    await render(
        <SwipeableOrderItem
            item={order}
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
        expect(await tapOrder(fiatRates, fiat)).toHaveBeenCalledWith('Order', {
            order
        });
    });

    it('does not open the order before any rates load', async () => {
        expect(await tapOrder(undefined)).not.toHaveBeenCalled();
    });
});
