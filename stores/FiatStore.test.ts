import FiatStore from './FiatStore';

jest.mock('react-native-blob-util', () => ({
    __esModule: true,
    default: { fetch: jest.fn() }
}));

jest.mock('./SettingsStore', () => ({
    __esModule: true,
    default: class SettingsStore {}
}));

// UnitsUtils, which FiatStore imports for its number formatting, reaches into
// the store singletons and drags the whole backend graph in with them
jest.mock('../stores/Stores', () => ({
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

const usdEntry = {
    code: 'USD',
    rate: 50000,
    cryptoCode: 'BTC',
    currencyPair: 'USD/BTC'
};

describe('FiatStore', () => {
    let store: FiatStore;
    let settingsStore: any;

    beforeEach(async () => {
        settingsStore = {
            settings: { fiat: 'USD' },
            // the constructor kicks off a fetch; this source with no currency
            // set leaves both branches of getFiatRates alone, so nothing in
            // the test is racing against it
            getSettings: jest
                .fn()
                .mockResolvedValue({ fiatRatesSource: 'Yadio' })
        };
        store = new FiatStore(settingsStore);
        await new Promise(process.nextTick);
        store.fiatRates = [usdEntry];
    });

    describe('getRate', () => {
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
