import * as React from 'react';
import { Animated } from 'react-native';
import { render, screen } from '@testing-library/react-native';

import FiatStore from '../../stores/FiatStore';

jest.mock('react-native-blob-util', () => ({
    __esModule: true,
    default: { fetch: jest.fn() }
}));
jest.mock('../../stores/SettingsStore', () => ({
    __esModule: true,
    default: class SettingsStore {}
}));
jest.mock('../../stores/NodeInfoStore', () => ({
    __esModule: true,
    default: class NodeInfoStore {}
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
// mobx-react's main entry needs react-dom; the stores arrive as props here
jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('@rneui/themed', () => ({ ButtonGroup: () => null }));
jest.mock('../../components/Button', () => () => null);
jest.mock('../../components/LoadingIndicator', () => () => null);
jest.mock('../../components/WalletHeader', () => () => null);
jest.mock('../../utils/NavigationUtils', () => ({
    protectedNavigation: jest.fn()
}));
jest.mock('../../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: (key: string) => `theme:${key}`
}));

import Layout from './Layout';

const usdEntry = {
    code: 'USD',
    rate: 50000,
    cryptoCode: 'BTC',
    currencyPair: 'USD/BTC'
};

const FETCHING = 'pos.views.Wallet.PosPane.fetchingRates';
const NOT_AVAILABLE = 'general.fiatRateNotAvailable';
const FETCH_ERROR = 'general.fiatFetchError';

const renderLayout = async (
    fiatRates: any,
    { fiat = 'USD', loading = false }: { fiat?: string; loading?: boolean } = {}
) => {
    const fiatStore = new FiatStore({ settings: { fiat } } as any);
    fiatStore.fiatRates = fiatRates;
    fiatStore.loading = loading;

    await render(
        <Layout
            navigation={{} as any}
            SettingsStore={{ settings: { fiatEnabled: true } } as any}
            NodeInfoStore={{} as any}
            FiatStore={fiatStore}
            title="Point of Sale"
            loading={false}
            selectedIndex={0}
            buttons={[]}
            onIndexChange={jest.fn()}
            fadeAnimation={new Animated.Value(1)}
        >
            {null}
        </Layout>
    );
};

describe('POS Layout rate header', () => {
    it('shows the rate when the currency has one', async () => {
        await renderLayout([usdEntry]);
        expect(screen.getByText('$50,000 BTC/USD')).toBeTruthy();
    });

    // #5813: rates that loaded without a usable one are not still loading
    it.each([
        ['the rates list is empty', [], 'USD'],
        ['the currency has no row', [usdEntry], 'IDR'],
        ['the rate is 0', [{ ...usdEntry, rate: 0 }], 'USD'],
        ['the rate is negative', [{ ...usdEntry, rate: -1 }], 'USD']
    ])('says the rate is not available when %s', async (_, fiatRates, fiat) => {
        await renderLayout(fiatRates, { fiat });
        expect(screen.getByText(NOT_AVAILABLE)).toBeTruthy();
        expect(screen.queryByText(FETCHING)).toBeNull();
    });

    it('says the rates are being fetched while the request runs', async () => {
        await renderLayout(undefined, { loading: true });
        expect(screen.getByText(FETCHING)).toBeTruthy();
    });

    it('says the fetch failed when no rates came back', async () => {
        await renderLayout(undefined);
        expect(screen.getByText(FETCH_ERROR)).toBeTruthy();
    });

    // The colour was half of #4717: a rate of 0 in the normal text colour
    it('shows a rate in the text colour and both failures in the error colour', async () => {
        await renderLayout([usdEntry]);
        expect(screen.getByText('$50,000 BTC/USD')).toHaveStyle({
            color: 'theme:text'
        });
        await renderLayout([]);
        expect(screen.getByText(NOT_AVAILABLE)).toHaveStyle({
            color: 'theme:error'
        });
        await renderLayout(undefined);
        expect(screen.getByText(FETCH_ERROR)).toHaveStyle({
            color: 'theme:error'
        });
    });

    it('says the rates are being fetched while a refresh runs with none usable', async () => {
        await renderLayout([], { loading: true });
        expect(screen.getByText(FETCHING)).toBeTruthy();
        expect(screen.queryByText(NOT_AVAILABLE)).toBeNull();
    });
});
