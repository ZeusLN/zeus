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

import PosKeypadPane from './StandalonePosKeypadPane';
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
