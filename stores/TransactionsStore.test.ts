jest.mock('../stores/Stores');
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
        payOffer: jest.fn(),
        payLightningInvoice: jest.fn(),
        sendKeysend: jest.fn(),
        sendCoins: jest.fn(),
        fundPsbt: jest.fn(),
        supportsOffersDirectPay: jest.fn(() => true),
        supportsOnchainSendMax: jest.fn(() => true),
        isLNDBased: jest.fn(() => false)
    }
}));
jest.mock('../utils/GraphSyncUtils', () => ({
    checkGraphSyncBeforePayment: jest.fn(() => true)
}));
jest.mock('../utils/LocaleUtils');
jest.mock('../utils/UrlUtils', () => ({
    __esModule: true,
    default: {}
}));

import TransactionsStore from './TransactionsStore';
import BackendUtils from '../utils/BackendUtils';

const payOffer = BackendUtils.payOffer as jest.Mock;
const payLightningInvoice = BackendUtils.payLightningInvoice as jest.Mock;
const sendKeysend = BackendUtils.sendKeysend as jest.Mock;
const sendCoins = BackendUtils.sendCoins as jest.Mock;
const fundPsbt = BackendUtils.fundPsbt as jest.Mock;
const isLNDBased = BackendUtils.isLNDBased as jest.Mock;
const supportsOffersDirectPay =
    BackendUtils.supportsOffersDirectPay as jest.Mock;

const offer = 'lno1qgsyxjtl6luzd9t3pr62xr7eemp6awnejusgf6gw45q75vcfqqqqqqq';

const newStore = (implementation = 'ldk-node') =>
    new TransactionsStore(
        { implementation, settings: {} } as any,
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

// let the payFunc .then/.catch chain run
const flushPromises = () =>
    new Promise(jest.requireActual('timers').setImmediate);

describe('TransactionsStore.sendPayment with an offer', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        payOffer.mockReset();
        payLightningInvoice.mockReset();
        sendKeysend.mockReset();
        supportsOffersDirectPay.mockReset();
        supportsOffersDirectPay.mockReturnValue(true);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('dispatches to payOffer with the offer, amount, fee limit and timeout', () => {
        payOffer.mockReturnValue(deferred().promise);

        const store = newStore();
        store.sendPayment({
            offer,
            amount: '1000',
            fee_limit_sat: '50',
            timeout_seconds: '30'
        });

        expect(payOffer).toHaveBeenCalledTimes(1);
        expect(payOffer).toHaveBeenCalledWith(
            expect.objectContaining({
                offer,
                amt: 1000,
                fee_limit_sat: 50,
                timeout_seconds: 30
            })
        );
        expect(payLightningInvoice).not.toHaveBeenCalled();
        expect(sendKeysend).not.toHaveBeenCalled();
    });

    it('enters the loading state SendingLightning animates on until the backend settles', async () => {
        const pending = deferred();
        payOffer.mockReturnValue(pending.promise);

        const store = newStore();
        // leftovers from a previous failed payment
        store.error = true;
        store.error_msg = 'old error';
        store.payment_error = 'old payment error';
        store.payment_preimage = 'old preimage';
        store.status = 'FAILED';

        store.sendPayment({ offer, amount: '1000' });

        expect(store.loading).toBe(true);
        expect(store.paymentInFlight).toBe(true);
        expect(store.error).toBe(false);
        expect(store.error_msg).toBeNull();
        expect(store.payment_error).toBeNull();
        expect(store.payment_preimage).toBeNull();
        expect(store.status).toBeNull();

        pending.resolve({
            payment_hash: 'ab'.repeat(32),
            payment_preimage: 'cd'.repeat(32),
            status: 'SUCCEEDED'
        });
        await flushPromises();

        expect(store.loading).toBe(false);
        expect(store.paymentInFlight).toBe(false);
        expect(store.error).toBe(false);
        expect(store.status).toBe('SUCCEEDED');
        expect(store.payment_preimage).toBe('cd'.repeat(32));
        expect(store.paymentDuration).not.toBeNull();
    });

    it('surfaces a failed payment as an error and releases the in-flight guard', async () => {
        payOffer.mockRejectedValue(new Error('RouteNotFound'));

        const store = newStore();
        store.sendPayment({ offer, amount: '1000' });
        await flushPromises();

        expect(store.loading).toBe(false);
        expect(store.paymentInFlight).toBe(false);
        expect(store.error).toBe(true);
        // errorToUserFriendly splits PascalCase error codes into words
        expect(store.error_msg).toBe('Route not found');
        expect(store.status).toBeNull();
    });

    // LdkNode reports an offer payment still pending at its timeout as
    // IN_FLIGHT; SendingLightning then shows it as in transit with no retry
    it('records an offer payment still pending at timeout as in transit, not an error', async () => {
        payOffer.mockResolvedValue({
            payment_hash: '',
            payment_preimage: '',
            fee_msat: '0',
            status: 'IN_FLIGHT'
        });

        const store = newStore();
        store.sendPayment({ offer, amount: '1000' });
        await flushPromises();

        expect(store.loading).toBe(false);
        expect(store.error).toBe(false);
        expect(store.error_msg).toBeNull();
        expect(store.payment_error).toBeNull();
        expect(store.status).toBe('IN_FLIGHT');
    });

    it('ignores a second send while a payment is in flight', () => {
        payOffer.mockReturnValue(deferred().promise);

        const store = newStore();
        store.sendPayment({ offer, amount: '1000' });
        store.sendPayment({ offer, amount: '1000' });

        expect(payOffer).toHaveBeenCalledTimes(1);
    });

    it('clears the in-flight guard after the timeout plus grace if the backend never settles', () => {
        payOffer.mockReturnValue(deferred().promise);

        const store = newStore();
        store.sendPayment({ offer, amount: '1000', timeout_seconds: '30' });

        jest.advanceTimersByTime(89_000);
        expect(store.paymentInFlight).toBe(true);
        jest.advanceTimersByTime(1_000);
        expect(store.paymentInFlight).toBe(false);
    });

    it('defaults the backstop to a 60 second payment timeout', () => {
        payOffer.mockReturnValue(deferred().promise);

        const store = newStore();
        store.sendPayment({ offer, amount: '1000' });

        jest.advanceTimersByTime(119_000);
        expect(store.paymentInFlight).toBe(true);
        jest.advanceTimersByTime(1_000);
        expect(store.paymentInFlight).toBe(false);
    });

    it('fails fast and releases the guard on a backend without direct offer pay', () => {
        supportsOffersDirectPay.mockReturnValue(false);

        const store = newStore('cln-rest');
        store.sendPayment({ offer, amount: '1000' });

        expect(payOffer).not.toHaveBeenCalled();
        expect(payLightningInvoice).not.toHaveBeenCalled();
        expect(store.loading).toBe(false);
        expect(store.paymentInFlight).toBe(false);
        expect(store.error).toBe(true);
        expect(store.error_msg).toBe('views.Send.payBolt12.offersNotSupported');

        // the guard is free, so the next payment goes through
        payLightningInvoice.mockReturnValue(deferred().promise);
        store.sendPayment({ payment_request: 'lnbcrt1...' });
        expect(payLightningInvoice).toHaveBeenCalledTimes(1);
    });
});

describe('TransactionsStore.sendCoins with selected UTXOs on LND', () => {
    const utxo = `${'cd'.repeat(32)}:0`;
    const request = {
        addr: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
        amount: '100000',
        sat_per_vbyte: '5',
        spend_unconfirmed: true,
        account: 'default',
        utxos: [utxo]
    };

    beforeEach(() => {
        sendCoins.mockReset();
        sendCoins.mockReturnValue(deferred().promise);
        fundPsbt.mockReset();
        fundPsbt.mockReturnValue(deferred().promise);
        isLNDBased.mockReturnValue(true);
    });

    afterEach(() => {
        isLNDBased.mockReturnValue(false);
    });

    it('passes the UTXOs to sendCoins as outpoints for a single output', () => {
        newStore('lnd').sendCoins({ ...request, additional_outputs: [] });

        expect(fundPsbt).not.toHaveBeenCalled();
        expect(sendCoins).toHaveBeenCalledTimes(1);
        expect(sendCoins).toHaveBeenCalledWith(
            expect.objectContaining({
                addr: request.addr,
                amount: '100000',
                outpoints: [{ txid_str: 'cd'.repeat(32), output_index: 0 }]
            })
        );
    });

    it('funds a PSBT paying every output when there are additional outputs', () => {
        const address = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';
        newStore('lnd').sendCoins({
            ...request,
            additional_outputs: [
                { address, amount: '250000', satAmount: '250000' }
            ]
        });

        expect(sendCoins).not.toHaveBeenCalled();
        expect(fundPsbt).toHaveBeenCalledTimes(1);
        expect(fundPsbt).toHaveBeenCalledWith(
            expect.objectContaining({
                raw: {
                    outputs: { [request.addr]: 100000, [address]: 250000 },
                    inputs: [{ txid_str: 'cd'.repeat(32), output_index: 0 }]
                },
                account: 'default'
            })
        );
    });
});
