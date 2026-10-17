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
    settingsStore: { settings: {} },
    fiatStore: {}
}));

const USD = {
    name: 'US Dollar',
    cryptoCode: 'BTC',
    currencyPair: 'BTC_USD',
    code: 'USD',
    rate: 100000.5
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
});
