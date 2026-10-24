import ReactNativeBlobUtil from 'react-native-blob-util';

import FiatStore from './FiatStore';

jest.mock('react-native-blob-util', () => ({
    __esModule: true,
    default: { fetch: jest.fn() }
}));

jest.mock('./SettingsStore', () => ({
    __esModule: true,
    default: class SettingsStore {}
}));

// UnitsUtils, imported for number formatting, loads the store graph
jest.mock('./Stores', () => ({
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

const USD = {
    name: 'US Dollar',
    cryptoCode: 'BTC',
    currencyPair: 'BTC_USD',
    code: 'USD',
    rate: 100000.5
};

const usdEntry = {
    code: 'USD',
    rate: 50000,
    cryptoCode: 'BTC',
    currencyPair: 'USD/BTC'
};

const newStore = (fiatRatesSource: string, fiatEnabled: boolean) =>
    new FiatStore({
        getSettings: async () => ({
            fiatEnabled,
            fiat: 'USD',
            fiatRatesSource
        })
    } as any);

const settle = async (store: FiatStore) => {
    await Promise.resolve();
    while (store.loading) await Promise.resolve();
};

describe('FiatStore', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe.each(['Zeus', 'Yadio'])('rates source %s', (source) => {
        beforeEach(() => {
            (ReactNativeBlobUtil.fetch as jest.Mock).mockResolvedValue({
                info: () => ({ status: 200 }),
                json: () => (source === 'Zeus' ? [USD] : { rate: USD.rate })
            });
        });

        it('does not fetch rates when constructed with fiat off', async () => {
            const store = newStore(source, false);
            await settle(store);
            expect(ReactNativeBlobUtil.fetch).not.toHaveBeenCalled();
            expect(store.fiatRates).toBeUndefined();
        });

        // fiat off covers the currency converter, which fetches on mount
        // regardless of fiatEnabled
        it.each([
            ['on', true],
            ['off', false]
        ])(
            'fetches rates when getFiatRates is called with fiat %s',
            async (_label, fiatEnabled) => {
                const store = newStore(source, fiatEnabled);
                await settle(store);
                await store.getFiatRates();
                expect(ReactNativeBlobUtil.fetch).toHaveBeenCalledTimes(1);
                expect(store.fiatRates).toHaveLength(1);
                expect(store.fiatRates![0].code).toBe('USD');
            }
        );
    });

    describe('getRate', () => {
        let store: FiatStore;
        let settingsStore: any;

        beforeEach(() => {
            settingsStore = { settings: { fiat: 'USD' } };
            store = new FiatStore(settingsStore);
            store.fiatRates = [usdEntry];
        });

        it('formats the rate of the selected currency', () => {
            expect(store.getRate()).toBe('$50,000 BTC/USD');
        });

        it('formats the same rate in sats', () => {
            // 1 BTC is 50,000 USD, so one USD buys 2,000 sats
            expect(store.getRate(true)).toBe('2,000 sats = 1 USD');
        });

        // #4717: the currency is in the app list but not in the rates
        // response. The rate used to fall back to 0, which printed
        // 'N/A 0 BTC/IDR' and, in the sats form, a division by zero.
        it('reports no rate when the selected currency is missing', () => {
            settingsStore.settings.fiat = 'IDR';
            expect(store.getRate()).toBe('$N/A');
            expect(store.getRate(true)).toBe('$N/A');
        });

        it('reports no rate when the entry carries a zero rate', () => {
            store.fiatRates = [{ ...usdEntry, rate: 0 }];
            expect(store.getRate()).toBe('$N/A');
            expect(store.getRate(true)).toBe('$N/A');
        });

        it('reports no rate when no rates are loaded', () => {
            store.fiatRates = undefined;
            expect(store.getRate()).toBe('$N/A');
            expect(store.getRate(true)).toBe('$N/A');
        });

        it('reports no rate when no currency is selected', () => {
            settingsStore.settings.fiat = undefined;
            expect(store.getRate()).toBe('$N/A');
            expect(store.getRate(true)).toBe('$N/A');
        });
    });
});
