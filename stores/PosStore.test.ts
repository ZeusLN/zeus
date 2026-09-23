// PosStore pulls in native-backed modules through its imports; stub them so the
// arithmetic can be exercised in isolation.
jest.mock('react-native-blob-util', () => ({ fetch: jest.fn() }));
jest.mock('../storage', () => ({
    __esModule: true,
    default: { getItem: jest.fn(async () => null), setItem: jest.fn() }
}));
jest.mock('./SettingsStore', () => ({
    PosEnabled: {
        Disabled: 'disabled',
        Square: 'square',
        Standalone: 'standalone'
    }
}));
jest.mock('./Stores', () => ({
    __esModule: true,
    fiatStore: { formatAmountForDisplay: (v: string) => `$${v}` }
}));
jest.mock('../utils/BackendUtils', () => ({
    __esModule: true,
    default: { supportsCashuWallet: () => false }
}));
jest.mock('../utils/LocaleUtils', () => ({ localeString: (k: string) => k }));

import PosStore from './PosStore';
import Order, { LineItem } from '../models/Order';

// $100,000/BTC keeps every expectation below an exact integer
const RATE = 100000;

const fiatStoreStub: any = {
    fiatRates: [{ code: 'USD', rate: RATE }],
    getRate: () => '$100,000.00'
};

const makeStore = (taxPercentage: string, units = 'fiat') =>
    new PosStore(
        { settings: { fiat: 'USD', pos: { taxPercentage } } } as any,
        fiatStoreStub,
        { units } as any
    );

const makeOrder = (line_items: LineItem[]) =>
    new Order({
        id: 'test-order',
        created_at: new Date(0).toISOString(),
        updated_at: new Date(0).toISOString(),
        line_items,
        total_tax_money: { amount: 0, currency: 'USD' },
        total_money: { amount: 0, currency: 'USD' }
    });

const fiatItem = (amount: number, taxPercentage = '', quantity = 1) => ({
    name: 'fiat-priced',
    quantity,
    taxPercentage,
    base_price_money: { amount, sats: 0 }
});

const satsItem = (sats: number, taxPercentage = '', quantity = 1) => ({
    name: 'sats-priced',
    quantity,
    taxPercentage,
    base_price_money: { amount: 0, sats }
});

const recalculate = (taxPercentage: string, line_items: LineItem[]) => {
    const store = makeStore(taxPercentage);
    store.currentOrder = makeOrder(line_items);
    store.recalculateCurrentOrder();
    return store.currentOrder;
};

describe('PosStore.recalculateCurrentOrder', () => {
    it('totals fiat-priced items in cents', () => {
        const order = recalculate('0', [fiatItem(10)]);
        expect(order.total_money.amount).toBe(1000);
        expect(order.total_money.sats).toBe(10000);
    });

    it('applies the global tax rate in cents', () => {
        const order = recalculate('8', [fiatItem(10)]);
        expect(order.total_tax_money.amount).toBe(80);
        expect(order.getTaxMoney).toBe('0.80');
    });

    it('applies a per-item tax rate in cents', () => {
        const order = recalculate('0', [fiatItem(10, '8')]);
        expect(order.total_tax_money.amount).toBe(80);
        expect(order.getTaxMoney).toBe('0.80');
    });

    it('taxes sats-priced items in cents', () => {
        const order = recalculate('0', [satsItem(10000, '8')]);
        expect(order.total_tax_money.amount).toBe(80);
    });

    it('normalises sats-priced and fiat-priced items alike', () => {
        const order = recalculate('0', [
            fiatItem(10, '8'),
            satsItem(10000, '8')
        ]);
        expect(order.total_money.amount).toBe(2000);
        expect(order.total_tax_money.amount).toBe(160);
    });

    it('scales with quantity', () => {
        const order = recalculate('0', [fiatItem(10, '8', 4)]);
        expect(order.total_tax_money.amount).toBe(320);
    });

    it('falls back to the global rate for items without their own', () => {
        const order = recalculate('10', [fiatItem(10, '8'), fiatItem(5)]);
        expect(order.total_tax_money.amount).toBe(80 + 50);
    });

    it('leaves untaxed items untaxed when there is no global rate', () => {
        const order = recalculate('0', [fiatItem(10, '8'), fiatItem(5)]);
        expect(order.total_tax_money.amount).toBe(80);
    });

    it('sums differing per-item rates', () => {
        const order = recalculate('0', [fiatItem(10, '8'), fiatItem(10, '20')]);
        expect(order.total_tax_money.amount).toBe(80 + 200);
    });

    it('resets the tax when the global rate is cleared', () => {
        const settingsStore: any = {
            settings: { fiat: 'USD', pos: { taxPercentage: '8' } }
        };
        const store = new PosStore(settingsStore, fiatStoreStub, {
            units: 'fiat'
        } as any);
        const order = makeOrder([fiatItem(10)]);
        store.currentOrder = order;

        store.recalculateCurrentOrder();
        expect(order.total_tax_money.amount).toBe(80);

        settingsStore.settings.pos.taxPercentage = '';
        store.recalculateCurrentOrder();
        expect(order.total_tax_money.amount).toBe(0);
    });
});

describe('PosStore.processCheckout', () => {
    const quickPay = async (taxPercentage: string, units: string) => {
        const store = makeStore(taxPercentage, units);
        store.currentOrder = makeOrder([fiatItem(10, '8')]);
        store.recalculateCurrentOrder();

        const navigate = jest.fn();
        await store.processCheckout({ navigate } as any, true);
        expect(navigate).toHaveBeenCalledTimes(1);
        return navigate.mock.calls[0][1];
    };

    it('invoices the subtotal plus tax in sats', async () => {
        const params = await quickPay('0', 'sats');
        expect(params.orderTotal).toBe('10800');
        expect(params.amount).toBe('10800');
    });

    it('invoices the same amount in fiat', async () => {
        const params = await quickPay('0', 'fiat');
        expect(params.orderTotal).toBe('10800');
        expect(params.amount).toBe('10.80');
    });

    it('clears the current order once checked out', async () => {
        const store = makeStore('0');
        store.currentOrder = makeOrder([fiatItem(10, '8')]);
        store.recalculateCurrentOrder();
        await store.processCheckout({ navigate: jest.fn() } as any, true);
        expect(store.currentOrder).toBeNull();
    });
});
