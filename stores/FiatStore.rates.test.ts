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

const fetchRates = async () => {
    const store = new FiatStore({
        settings,
        getSettings: jest.fn(async () => settings)
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

    it('leaves the rates unset on a non-200 response', async () => {
        respondWith(500, { error: 'rate limited' });
        const store = await fetchRates();

        expect(store.fiatRates).toBeUndefined();
    });
});
