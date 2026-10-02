jest.mock('../stores/Stores', () => ({}));
jest.mock('react-native-blob-util', () => ({}));
jest.mock('bitcoinjs-lib', () => ({}));
jest.mock('react-native-randombytes', () => ({ randomBytes: jest.fn() }));
jest.mock('./SettingsStore', () => ({}));
jest.mock('./NodeInfoStore', () => ({}));
jest.mock('./ChannelsStore', () => ({}));
jest.mock('./BalanceStore', () => ({}));
jest.mock('./ModalStore', () => ({}));
jest.mock('../utils/BackendUtils', () => ({
    __esModule: true,
    default: {
        fetchInvoiceFromOffer: jest.fn(),
        isLNDBased: jest.fn(() => false)
    }
}));
jest.mock('../utils/GraphSyncUtils', () => ({
    checkGraphSyncBeforePayment: jest.fn(() => true)
}));
jest.mock('../utils/LocaleUtils', () => ({
    localeString: (s: string) => s
}));
jest.mock('../utils/ErrorUtils', () => ({
    errorToUserFriendly: (error: any) =>
        typeof error === 'string' ? error : error?.message
}));
jest.mock('../utils/UrlUtils', () => ({
    __esModule: true,
    default: {}
}));

import TransactionsStore from './TransactionsStore';
import BackendUtils from '../utils/BackendUtils';

const fetchInvoiceFromOffer = BackendUtils.fetchInvoiceFromOffer as jest.Mock;

const offer = 'lno1qgsyxjtl6luzd9t3pr62xr7eemp6awnejusgf6gw45q75vcfqqqqqqq';

const newStore = () =>
    new TransactionsStore(
        { implementation: 'ldk-node' } as any,
        {} as any,
        {} as any,
        {} as any,
        { checkAndTriggerRatingModal: jest.fn() } as any
    );

const deferred = () => {
    let resolve!: (value: any) => void;
    let reject!: (err: Error) => void;
    const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
};

describe('TransactionsStore.sendOfferPayment', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        fetchInvoiceFromOffer.mockReset();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('enters the loading state SendingLightning animates on until the backend settles', async () => {
        const pending = deferred();
        fetchInvoiceFromOffer.mockReturnValue(pending.promise);

        const store = newStore();
        // leftovers from a previous failed payment
        store.error = true;
        store.error_msg = 'old error';
        store.payment_error = 'old payment error';
        store.payment_preimage = 'old preimage';
        store.status = 'FAILED';

        const result = store.sendOfferPayment({
            offer,
            amount: '1000',
            timeout_seconds: '30',
            fee_limit_sat: '50'
        });

        expect(store.loading).toBe(true);
        expect(store.paymentInFlight).toBe(true);
        expect(store.error).toBe(false);
        expect(store.error_msg).toBeNull();
        expect(store.payment_error).toBeNull();
        expect(store.payment_preimage).toBeNull();
        expect(store.status).toBeNull();
        expect(fetchInvoiceFromOffer).toHaveBeenCalledWith(
            offer,
            '1000',
            '30',
            '50'
        );

        pending.resolve({
            payment_hash: 'ab'.repeat(32),
            payment_preimage: 'cd'.repeat(32),
            status: 'SUCCEEDED'
        });
        await result;

        expect(store.loading).toBe(false);
        expect(store.paymentInFlight).toBe(false);
        expect(store.error).toBe(false);
        expect(store.status).toBe('SUCCEEDED');
        expect(store.payment_preimage).toBe('cd'.repeat(32));
        expect(store.paymentDuration).not.toBeNull();
    });

    it('surfaces a failed payment as an error and releases the in-flight guard', async () => {
        fetchInvoiceFromOffer.mockRejectedValue(new Error('RouteNotFound'));

        const store = newStore();
        await store.sendOfferPayment({ offer, amount: '1000' });

        expect(store.loading).toBe(false);
        expect(store.paymentInFlight).toBe(false);
        expect(store.error).toBe(true);
        expect(store.error_msg).toBe('RouteNotFound');
        expect(store.status).toBeNull();
    });

    it('ignores a second send while a payment is in flight', () => {
        fetchInvoiceFromOffer.mockReturnValue(deferred().promise);

        const store = newStore();
        store.sendOfferPayment({ offer, amount: '1000' });
        const second = store.sendOfferPayment({ offer, amount: '1000' });

        expect(second).toBeUndefined();
        expect(fetchInvoiceFromOffer).toHaveBeenCalledTimes(1);
    });

    it('clears the in-flight guard after the timeout plus grace if the backend never settles', () => {
        fetchInvoiceFromOffer.mockReturnValue(deferred().promise);

        const store = newStore();
        store.sendOfferPayment({ offer, amount: '1000', timeout_seconds: 30 });

        jest.advanceTimersByTime(89_000);
        expect(store.paymentInFlight).toBe(true);
        jest.advanceTimersByTime(1_000);
        expect(store.paymentInFlight).toBe(false);
    });

    it('defaults the backstop to a 60 second payment timeout', () => {
        fetchInvoiceFromOffer.mockReturnValue(deferred().promise);

        const store = newStore();
        store.sendOfferPayment({ offer, amount: '1000' });

        jest.advanceTimersByTime(119_000);
        expect(store.paymentInFlight).toBe(true);
        jest.advanceTimersByTime(1_000);
        expect(store.paymentInFlight).toBe(false);
    });
});
