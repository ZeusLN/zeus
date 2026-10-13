jest.mock('../utils/BackendUtils', () => ({
    __esModule: true,
    default: {
        getPayments: jest.fn()
    }
}));
jest.mock('../stores/Stores', () => ({ notesStore: {} }));
jest.mock('../utils/LocaleUtils', () => ({
    localeString: (value: string) => value
}));

import BackendUtils from '../utils/BackendUtils';
import PaymentsStore from './PaymentsStore';

describe('PaymentsStore.fetchPayments', () => {
    it('returns scoped payments without replacing the canonical collection', async () => {
        (BackendUtils.getPayments as jest.Mock).mockResolvedValue({
            payments: [{ creation_date: '1700000000', value_sat: '10' }]
        });
        const store = new PaymentsStore({} as any, { nodes: {} } as any);
        const canonicalPayment = { payment_hash: 'canonical' } as any;
        store.payments = [canonicalPayment];

        const result = await store.fetchPayments({
            creationDateStart: 1_700_000_000
        });

        expect(result).toHaveLength(1);
        expect(store.payments).toEqual([canonicalPayment]);
    });
});
