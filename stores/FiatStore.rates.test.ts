jest.mock('react-native-blob-util', () => ({ fetch: jest.fn() }));
jest.mock('./SettingsStore', () => ({
    __esModule: true,
    default: class {}
}));
jest.mock('./Stores', () => ({
    __esModule: true,
    settingsStore: { settings: {} },
    fiatStore: {}
}));

import ReactNativeBlobUtil from 'react-native-blob-util';
import FiatStore from './FiatStore';

const mockFetch = jest.mocked(ReactNativeBlobUtil.fetch);

const settings = {
    fiatEnabled: true,
    fiat: 'USD',
    fiatRatesSource: 'Zeus'
};

const respondWith = (status: number, body: any) =>
    mockFetch.mockResolvedValue({
        info: () => ({ status }),
        json: () => body
    } as any);

const fetchRates = async (fiatRatesSource = 'Zeus') => {
    const store = new FiatStore({
        settings: { ...settings, fiatRatesSource },
        getSettings: jest.fn(async () => ({ ...settings, fiatRatesSource }))
    } as any);
    // let any fetch started on construction settle first
    while (store.loading) await new Promise((r) => setImmediate(r));
    await store.getFiatRates();
    return store;
};

const USD = {
    name: 'US Dollar',
    cryptoCode: 'BTC',
    currencyPair: 'BTC_USD',
    code: 'USD',
    rate: 100000
};

describe('FiatStore.getFiatRates from the ZEUS rates host', () => {
    beforeEach(() => jest.clearAllMocks());

    it('stores an array of rates', async () => {
        respondWith(200, [USD]);
        const store = await fetchRates();

        expect(store.fiatRates).toEqual([USD]);
        expect(store.getRate()).toBe('$100,000 BTC/USD');
    });

    it.each([
        ['a JSON object', { error: 'rate limited' }],
        ['a string', 'rate limited'],
        ['a number', 1],
        ['true', true]
    ])('ignores a 200 body that is %s', async (_, body) => {
        respondWith(200, body);
        const store = await fetchRates();

        expect(store.fiatRates).toBeUndefined();
        expect(store.getRate()).toBe('$N/A');
    });

    it('drops rows that are not objects with a code and a numeric rate', async () => {
        respondWith(200, [
            null,
            'USD',
            { code: 'EUR' },
            { code: 'GBP', rate: '1' },
            { code: 'CHF', rate: NaN },
            { rate: 1 },
            USD
        ]);
        const store = await fetchRates();

        expect(store.fiatRates).toEqual([USD]);
    });

    it('drops rows with a zero, negative or infinite rate', async () => {
        respondWith(200, [
            { code: 'EUR', rate: 0 },
            { code: 'GBP', rate: -1 },
            { code: 'CHF', rate: Infinity },
            USD
        ]);
        const store = await fetchRates();

        expect(store.fiatRates).toEqual([USD]);
    });

    it('leaves the rates unset on a non-200 response', async () => {
        respondWith(500, { error: 'rate limited' });
        const store = await fetchRates();

        expect(store.fiatRates).toBeUndefined();
    });
});

describe('FiatStore.getFiatRates from Yadio', () => {
    beforeEach(() => jest.clearAllMocks());

    it('stores a positive numeric rate', async () => {
        respondWith(200, { rate: 100000 });
        const store = await fetchRates('Yadio');

        expect(store.fiatRates).toEqual([
            {
                cryptoCode: 'BTC',
                code: 'USD',
                rate: 100000,
                currencyPair: 'BTC_USD'
            }
        ]);
    });

    it.each([
        ['a zero rate', { rate: 0 }],
        ['a negative rate', { rate: -1 }],
        ['a string rate', { rate: 'x' }],
        ['a numeric string rate', { rate: '100000' }],
        ['a null rate', { rate: null }],
        ['no rate', {}],
        ['a null body', null]
    ])('ignores a response with %s', async (_, body) => {
        respondWith(200, body);
        const store = await fetchRates('Yadio');

        expect(store.fiatRates).toBeUndefined();
        expect(store.getRate()).toBe('$N/A');
    });
});
