jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
// UnitsUtils imports the store graph; numberWithCommas reads no store
jest.mock('../stores/Stores');
jest.mock('../utils/LocaleUtils');
jest.mock('../utils/ThemeUtils', () => ({
    themeColor: (key: string) => `theme:${key}`
}));
jest.mock('../stores/SettingsStore', () => ({
    CURRENCY_CODES_KEY: 'zeus-currency-codes',
    CURRENCY_KEYS: [
        { value: 'USD', flag: '🇺🇸' },
        { value: 'EUR', flag: '🇪🇺' },
        { value: 'XAU', flag: '🥇' }
    ]
}));
// An in-memory store with the real Storage contract: values are written as
// JSON and a missing key reads back as false
const mockStored = new Map<string, string>();
jest.mock('../storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn(async (key: string) => mockStored.get(key) ?? false),
        setItem: jest.fn(async (key: string, value: any) => {
            mockStored.set(
                key,
                typeof value === 'string' ? value : JSON.stringify(value)
            );
        })
    }
}));
const mockDragStart = jest.fn();
const mockDragEnd = jest.fn();
// Every data array DragList renders with, in order. DragList resets its drag
// state whenever data changes identity
const mockListData: string[][] = [];
jest.mock('react-native-draglist', () => {
    const React = require('react');
    const { View } = require('react-native');
    return {
        __esModule: true,
        default: ({ data, keyExtractor, renderItem, onReordered }: any) => {
            mockListData.push(data);
            return (
                <View testID="currency-list" onReordered={onReordered}>
                    {data.map((item: string, index: number) => (
                        <React.Fragment key={keyExtractor(item, index)}>
                            {renderItem({
                                item,
                                index,
                                onDragStart: mockDragStart,
                                onDragEnd: mockDragEnd,
                                isActive: false
                            })}
                        </React.Fragment>
                    ))}
                </View>
            );
        }
    };
});
jest.mock('react-native-svg', () => {
    const { Text, View } = require('react-native');
    return {
        __esModule: true,
        default: ({ children }: any) => <View>{children}</View>,
        Text: ({ children }: any) => <Text>{children}</Text>
    };
});
// Each field is wrapped with its trailing currency label, so a test can find
// the field by currency
jest.mock('./TextInput', () => {
    const { TextInput, View } = require('react-native');
    return ({ trailing, ...props }: any) => (
        <View testID="currency-field">
            <TextInput {...props} />
            {trailing}
        </View>
    );
});
jest.mock('@rneui/themed', () => ({ Icon: 'Icon' }));
jest.mock('./LoadingIndicator', () => 'LoadingIndicator');
jest.mock('./SuccessErrorMessage', () => ({ ErrorMessage: 'ErrorMessage' }));
jest.mock('../assets/images/SVG/Add.svg', () => 'AddIcon');
jest.mock('../assets/images/SVG/Checkmark.svg', () => 'CheckmarkIcon');
jest.mock('../assets/images/SVG/Pen.svg', () => 'EditIcon');
jest.mock('../assets/images/SVG/DragDots.svg', () => 'DragDots');
jest.mock('../assets/images/SVG/bitcoin-icon.svg', () => 'BitcoinIcon');

import * as React from 'react';
import {
    act,
    fireEvent,
    render,
    screen,
    within
} from '@testing-library/react-native';

import CurrencyConverterContent from './CurrencyConverterContent';
import Storage from '../storage';

const KEY = 'zeus-currency-codes';
const RATES = [
    { code: 'USD', currencyPair: 'BTC_USD', rate: 50_000 },
    { code: 'EUR', currencyPair: 'BTC_EUR', rate: 40_000 }
];

const stored = () => JSON.parse(mockStored.get(KEY)!);

beforeEach(() => {
    mockStored.clear();
    mockDragStart.mockClear();
    mockDragEnd.mockClear();
    mockListData.length = 0;
    (Storage.setItem as jest.Mock).mockClear();
});

const renderConverter = async ({
    saved,
    fiatRates = RATES,
    ...props
}: {
    saved?: Record<string, string>;
    fiatRates?: any[];
    [prop: string]: any;
} = {}) => {
    if (saved) mockStored.set(KEY, JSON.stringify(saved));
    const FiatStore: any = {
        fiatRates,
        loading: false,
        getFiatRates: jest.fn()
    };
    const removeBlurListener = jest.fn();
    const navigation: any = {
        navigate: jest.fn(),
        addListener: jest.fn(() => removeBlurListener)
    };
    const ref = React.createRef<any>();
    const element = (extra: Record<string, any> = {}) => (
        <CurrencyConverterContent
            {...({ ref, navigation, FiatStore, ...props, ...extra } as any)}
        />
    );
    const view = await render(element());
    return {
        FiatStore,
        navigation,
        removeBlurListener,
        ref,
        unmount: view.unmount,
        rerender: (extra: Record<string, any>) => view.rerender(element(extra))
    };
};

// The currencies in the order they are listed
const listed = () =>
    screen
        .getAllByTestId('currency-field')
        .map((field) => within(field).getAllByText(/^[A-Za-z]+$/)[0])
        .map((label) => label.props.children);

const field = (currency: string) =>
    within(
        screen
            .getAllByTestId('currency-field')
            .find((f) => within(f).queryByText(currency))!
    ).getByPlaceholderText('views.Settings.CurrencyConverter.enterAmount');

const values = () =>
    Object.fromEntries(
        listed().map((currency) => [currency, field(currency).props.value])
    );

const type = (currency: string, text: string) =>
    fireEvent.changeText(field(currency), text);

describe('CurrencyConverterContent currencies', () => {
    it('always lists BTC and sats', async () => {
        await renderConverter();

        expect(listed()).toEqual(['BTC', 'sats']);
        expect(stored()).toEqual({ BTC: '', sats: '' });
    });

    it('lists saved currencies in their saved order after BTC and sats are added', async () => {
        await renderConverter({ saved: { EUR: '', USD: '' } });

        expect(listed()).toEqual(['EUR', 'USD', 'BTC', 'sats']);
    });

    it('shows a flag for a fiat currency and a symbol for a metal', async () => {
        await renderConverter({ saved: { USD: '', XAU: '' } });

        expect(screen.getByText('🇺🇸')).toBeOnTheScreen();
        expect(screen.getByText('Au')).toBeOnTheScreen();
    });

    it('fills in the other currencies from a saved amount', async () => {
        await renderConverter({ saved: { BTC: '', sats: '1000', USD: '' } });

        expect(values()).toEqual({
            BTC: '0.00001000',
            sats: '1,000',
            USD: '0.50'
        });
    });

    // Older versions saved 0 for a currency without a rate; taking sats as
    // the source used to wipe the typed EUR
    it('fills in from a saved amount rather than a saved zero', async () => {
        await renderConverter({
            saved: { BTC: '', sats: '0', USD: '0', EUR: '400' }
        });

        expect(values()).toEqual({
            BTC: '0.01000000',
            sats: '1,000,000',
            USD: '500.00',
            EUR: '400'
        });
    });
});

describe('CurrencyConverterContent conversion', () => {
    const allCurrencies = { BTC: '', sats: '', USD: '', EUR: '' };

    it('converts sats', async () => {
        await renderConverter({ saved: allCurrencies });

        await type('sats', '250000');

        expect(values()).toEqual({
            BTC: '0.00250000',
            sats: '250,000',
            USD: '125.00',
            EUR: '100.00'
        });
    });

    it('converts BTC', async () => {
        await renderConverter({ saved: allCurrencies });

        await type('BTC', '0.5');

        expect(values()).toEqual({
            BTC: '0.5',
            sats: '50,000,000',
            USD: '25,000.00',
            EUR: '20,000.00'
        });
    });

    it('converts between fiat currencies through BTC', async () => {
        await renderConverter({ saved: allCurrencies });

        await type('EUR', '400');

        expect(values()).toEqual({
            BTC: '0.01000000',
            sats: '1,000,000',
            USD: '500.00',
            EUR: '400'
        });
    });

    it('drops commas and anything that is not a digit or a point', async () => {
        await renderConverter({ saved: allCurrencies });

        await type('USD', '$1,000a');

        expect(values()).toMatchObject({ USD: '1,000', sats: '2,000,000' });
    });

    // #5070: it used to show 0
    it('leaves a currency without a rate empty', async () => {
        await renderConverter({
            saved: allCurrencies,
            fiatRates: [RATES[0]]
        });

        await type('BTC', '0.5');

        expect(values()).toMatchObject({ USD: '25,000.00', EUR: '' });
    });

    // #5070: sats and fiat used to show 0
    it('leaves every other currency empty when the typed one has no rate', async () => {
        await renderConverter({
            saved: allCurrencies,
            fiatRates: [RATES[0]]
        });

        await type('EUR', '400');

        expect(values()).toMatchObject({ BTC: '', sats: '', USD: '' });
    });

    it('clears every currency when one is cleared', async () => {
        await renderConverter({ saved: allCurrencies });
        await type('sats', '250000');

        await type('sats', '');

        expect(values()).toEqual(allCurrencies);
    });

    it('saves the amounts after each change', async () => {
        await renderConverter({ saved: allCurrencies });

        await type('sats', '1000');

        expect(stored()).toEqual({
            BTC: '0.00001000',
            sats: '1,000',
            USD: '0.50',
            EUR: '0.40'
        });
    });

    // #5069: the decimals used to be grouped too (2.00,000,000)
    it('groups only the whole part of a converted amount', async () => {
        await renderConverter({ saved: allCurrencies });

        await type('USD', '100000');

        expect(values()).toMatchObject({
            BTC: '2.00000000',
            sats: '200,000,000'
        });
    });

    it.each([
        ['BTC', '1234.12345678', '1,234.12345678'],
        ['USD', '1234.5678', '1,234.5678'],
        ['USD', '1234.', '1,234.'],
        ['USD', '.5', '.5']
    ])('keeps %s typed as %p readable as %p', async (currency, text, shown) => {
        await renderConverter({ saved: allCurrencies });

        await type(currency, text);

        expect(values()[currency]).toBe(shown);
    });

    // A lone point parses as NaN, which used to show and save as "NaN"
    it.each(['BTC', 'sats', 'USD'])(
        'leaves the others empty while %s is a lone point',
        async (currency) => {
            await renderConverter({ saved: allCurrencies });

            await type(currency, '.');

            expect(values()).toEqual({ ...allCurrencies, [currency]: '.' });
            expect(stored()).toEqual({ ...allCurrencies, [currency]: '.' });
        }
    );

    it('leaves the others empty when the amount is too long to parse', async () => {
        await renderConverter({ saved: allCurrencies });

        // parses as Infinity
        await type('sats', '9'.repeat(400));

        expect(values()).toMatchObject({ BTC: '', USD: '', EUR: '' });
    });

    it('leaves a conversion empty when toFixed would show an exponent', async () => {
        await renderConverter({ saved: allCurrencies });

        // 1e13 BTC is 1e21 sats, which toFixed shows as "1e+21"
        await type('BTC', '10000000000000');

        expect(values()).toMatchObject({
            sats: '',
            USD: '500,000,000,000,000,000.00'
        });
    });
});

describe('CurrencyConverterContent rates', () => {
    it('fetches rates on mount when there are none', async () => {
        const { FiatStore } = await renderConverter({ fiatRates: [] });

        expect(FiatStore.getFiatRates).toHaveBeenCalledTimes(1);
    });

    it('does not refetch rates it already has', async () => {
        const { FiatStore } = await renderConverter();

        expect(FiatStore.getFiatRates).not.toHaveBeenCalled();
    });

    it('shows a spinner while the first rates load', async () => {
        const FiatStore = {
            fiatRates: [],
            loading: true,
            getFiatRates: jest.fn()
        };
        await renderConverter({ FiatStore });

        expect(
            screen.container.queryAll((n) => n.type === 'LoadingIndicator')
        ).toHaveLength(1);
    });

    it('offers a retry when the rates could not be fetched', async () => {
        const { FiatStore } = await renderConverter({ fiatRates: [] });
        FiatStore.getFiatRates.mockClear();
        const error = screen.container.queryAll(
            (n) => n.type === 'ErrorMessage'
        )[0];
        expect(error.props.message).toBe(
            'views.Settings.CurrencyConverter.error'
        );

        await fireEvent.press(error);

        expect(FiatStore.getFiatRates).toHaveBeenCalledTimes(1);
    });

    it('fills in fiat once rates arrive in a new store', async () => {
        const { rerender } = await renderConverter({
            saved: { BTC: '', sats: '', USD: '' },
            fiatRates: []
        });
        await type('BTC', '0.5');
        expect(values().USD).toBe('');

        await rerender({
            FiatStore: {
                fiatRates: RATES,
                loading: false,
                getFiatRates: jest.fn()
            }
        });

        expect(values().USD).toBe('25,000.00');
    });

    // #5071: the check compared the store with itself and never fired
    it('fills in fiat when the same store receives rates', async () => {
        const { FiatStore, rerender } = await renderConverter({
            saved: { BTC: '', sats: '', USD: '' },
            fiatRates: []
        });
        await type('BTC', '0.5');

        // the app's FiatStore is one instance; rates land on it in place
        FiatStore.fiatRates = RATES;
        await rerender({});

        expect(values().USD).toBe('25,000.00');
    });
});

describe('CurrencyConverterContent editing', () => {
    const saved = { BTC: '', sats: '', USD: '1', EUR: '' };
    const editButton = () =>
        screen.container.queryAll(
            (n) => n.type === 'EditIcon' || n.type === 'CheckmarkIcon'
        )[0];
    const deleteButtons = () =>
        screen.container.queryAll((n) => n.type === 'Icon');
    const dragHandles = () => screen.queryAllByLabelText('general.reorder');

    // the controls slide in over 350ms
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    const toggleEditing = async () => {
        await fireEvent.press(editButton());
        await act(() => jest.advanceTimersByTime(400));
    };

    it('offers editing only once a fiat currency is listed', async () => {
        await renderConverter();
        expect(editButton()).toBeUndefined();

        await renderConverter({ saved: { USD: '' } });
        expect(editButton()).toBeDefined();
    });

    it('shows delete and reorder controls for fiat rows only', async () => {
        await renderConverter({ saved });
        expect(deleteButtons()).toHaveLength(0);

        await toggleEditing();

        expect(deleteButtons()).toHaveLength(2);
        expect(dragHandles()).toHaveLength(2);
        expect(editButton().type).toBe('CheckmarkIcon');
    });

    it('deletes a currency from the list and from storage', async () => {
        await renderConverter({
            saved: { BTC: '', sats: '', USD: '', EUR: '' }
        });
        await toggleEditing();

        await fireEvent.press(deleteButtons()[0]);

        expect(listed()).toEqual(['BTC', 'sats', 'EUR']);
        expect(stored()).toEqual({ BTC: '', sats: '', EUR: '' });
    });

    it('saves a new order', async () => {
        await renderConverter({ saved });

        await act(() =>
            screen.getByTestId('currency-list').props.onReordered(3, 0)
        );

        expect(listed()).toEqual(['EUR', 'BTC', 'sats', 'USD']);
        expect(Object.keys(stored())).toEqual(['EUR', 'BTC', 'sats', 'USD']);
    });

    it('stops the page scrolling while a row is dragged', async () => {
        await renderConverter({ saved });
        await toggleEditing();
        const scrollEnabled = () =>
            screen.container.queryAll(
                (n) => n.props.keyboardDismissMode === 'on-drag'
            )[0].props.scrollEnabled;

        await fireEvent(dragHandles()[0], 'pressIn');
        expect(scrollEnabled()).toBe(false);
        expect(mockDragStart).toHaveBeenCalledTimes(1);

        await fireEvent(dragHandles()[0], 'pressOut');
        expect(scrollEnabled()).toBe(true);
        expect(mockDragEnd).toHaveBeenCalledTimes(1);
    });
});

describe('CurrencyConverterContent adding', () => {
    const addButton = () => screen.getByLabelText('general.add');

    it('opens the currency picker', async () => {
        const { navigation } = await renderConverter();

        await fireEvent.press(addButton());

        expect(navigation.navigate).toHaveBeenCalledWith('SelectCurrency', {
            currencyConverter: true,
            fromModal: false
        });
    });

    it('lets a modal host close before opening the picker', async () => {
        const onNavigateAway = jest.fn();
        const { navigation } = await renderConverter({
            fromModal: true,
            onNavigateAway
        });

        await fireEvent.press(addButton());

        expect(navigation.navigate).not.toHaveBeenCalled();
        onNavigateAway.mock.calls[0][0]();
        expect(navigation.navigate).toHaveBeenCalledWith('SelectCurrency', {
            currencyConverter: true,
            fromModal: true
        });
    });

    it('hides the toolbar when asked to', async () => {
        await renderConverter({ showToolbar: false });

        expect(screen.queryByLabelText('general.add')).not.toBeOnTheScreen();
    });

    it('adds a picked currency, converted from the current amount', async () => {
        const { ref } = await renderConverter();
        await type('BTC', '0.5');

        await act(() => ref.current.addCurrency('USD'));

        expect(values()).toEqual({
            BTC: '0.5',
            sats: '50,000,000',
            USD: '25,000.00'
        });
        expect(stored()).toMatchObject({ USD: '25,000.00' });
    });

    it('ignores a currency that is already listed', async () => {
        const { ref } = await renderConverter({ saved: { USD: '' } });
        (Storage.setItem as jest.Mock).mockClear();

        await act(() => ref.current.addCurrency('USD'));

        expect(listed()).toEqual(['USD', 'BTC', 'sats']);
        expect(Storage.setItem).not.toHaveBeenCalled();
    });
});

describe('CurrencyConverterContent lifecycle', () => {
    it('reports how many currencies are listed', async () => {
        const onInputValuesChanged = jest.fn();
        const { ref } = await renderConverter({ onInputValuesChanged });
        expect(onInputValuesChanged).toHaveBeenLastCalledWith(2);

        await act(() => ref.current.addCurrency('USD'));

        expect(onInputValuesChanged).toHaveBeenLastCalledWith(3);
        expect(ref.current.inputValuesCount).toBe(3);
    });

    it('saves when the screen loses focus', async () => {
        const { navigation } = await renderConverter();
        const [event, onBlur] = navigation.addListener.mock.calls[0];
        expect(event).toBe('blur');
        (Storage.setItem as jest.Mock).mockClear();

        await act(() => onBlur());

        expect(Storage.setItem).toHaveBeenCalledWith(KEY, {
            BTC: '',
            sats: ''
        });
    });

    it('stops listening and saves on unmount', async () => {
        const { removeBlurListener, unmount } = await renderConverter();
        (Storage.setItem as jest.Mock).mockClear();

        await unmount();

        expect(removeBlurListener).toHaveBeenCalledTimes(1);
        expect(Storage.setItem).toHaveBeenCalledTimes(1);
    });

    it('reloads the saved currencies on refresh', async () => {
        const { ref } = await renderConverter();
        // the currency picker saves its choice straight to storage
        mockStored.set(KEY, JSON.stringify({ BTC: '', sats: '1000', EUR: '' }));

        await act(() => ref.current.refresh());

        expect(values()).toEqual({
            BTC: '0.00001000',
            sats: '1,000',
            EUR: '0.40'
        });
    });
});

describe('CurrencyConverterContent list data', () => {
    const lastData = () => mockListData[mockListData.length - 1];

    it('keeps the same list data while typing', async () => {
        await renderConverter({ saved: { BTC: '', sats: '', USD: '' } });
        const before = lastData();
        const renders = mockListData.length;

        await type('sats', '1000');

        expect(mockListData.length).toBeGreaterThan(renders);
        expect(lastData()).toBe(before);
    });

    it('replaces the list data when a currency is added', async () => {
        const { ref } = await renderConverter();
        const before = lastData();

        await act(() => ref.current.addCurrency('USD'));

        expect(lastData()).not.toBe(before);
        expect(lastData()).toEqual(['BTC', 'sats', 'USD']);
    });

    describe('with the edit controls shown', () => {
        // the controls slide in over 350ms
        beforeEach(() => jest.useFakeTimers());
        afterEach(() => jest.useRealTimers());

        it('replaces the list data when a currency is deleted', async () => {
            await renderConverter({ saved: { BTC: '', sats: '', USD: '' } });
            await fireEvent.press(
                screen.container.queryAll((n) => n.type === 'EditIcon')[0]
            );
            await act(() => jest.advanceTimersByTime(400));
            const before = lastData();

            await fireEvent.press(
                screen.container.queryAll((n) => n.type === 'Icon')[0]
            );

            expect(lastData()).not.toBe(before);
            expect(lastData()).toEqual(['BTC', 'sats']);
        });
    });

    it('replaces the list data when currencies are reordered', async () => {
        await renderConverter({ saved: { BTC: '', sats: '', USD: '' } });
        const before = lastData();

        await act(() =>
            screen.getByTestId('currency-list').props.onReordered(2, 0)
        );

        expect(lastData()).not.toBe(before);
        expect(lastData()).toEqual(['USD', 'BTC', 'sats']);
    });
});
