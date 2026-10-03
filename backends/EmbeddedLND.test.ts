// Import-time scaffolding for the native modules EmbeddedLND and LND pull
// in. EmbeddedLND destructures every lndMobile namespace at load, so the
// injection mock hands back an empty object for any namespace but `index`.
const mockTrackPaymentV2 = jest.fn();
const mockListPayments = jest.fn();

jest.mock('react-native-blob-util', () => ({
    __esModule: true,
    default: { fetch: jest.fn(), config: jest.fn() }
}));
jest.mock('../stores/Stores', () => ({
    settingsStore: { settings: {} },
    nodeInfoStore: { nodeInfo: {} }
}));
jest.mock('../utils/TorUtils', () => ({
    doTorRequest: jest.fn(),
    isOnionHttpsUrl: jest.fn(),
    RequestMethod: {}
}));
jest.mock('../lndmobile/LndMobileInjection', () => ({
    __esModule: true,
    default: new Proxy(
        {},
        {
            get: (_target, namespace) =>
                namespace === 'index'
                    ? {
                          trackPaymentV2: (...args: any[]) =>
                              mockTrackPaymentV2(...args),
                          listPayments: (...args: any[]) =>
                              mockListPayments(...args)
                      }
                    : {}
        }
    )
}));
jest.mock('../lndmobile/onchain', () => ({}));
jest.mock('../utils/LndMobileUtils', () => ({}));

import EmbeddedLND from './EmbeddedLND';

describe('EmbeddedLND.lookupPayment', () => {
    const HASH = 'ab'.repeat(32);
    const NOT_FOUND = new Error("payment isn't initiated");

    const fullPage = {
        payments: Array.from({ length: 50 }, (_, i) => ({
            payment_hash: i.toString(16).padStart(64, '0')
        }))
    };

    beforeEach(() => {
        mockTrackPaymentV2.mockReset();
        mockListPayments.mockReset();
    });

    it('resolves the tracked payment without scanning', async () => {
        const payment = { payment_hash: HASH, status: 'IN_FLIGHT' };
        mockTrackPaymentV2.mockResolvedValue(payment);

        await expect(
            new EmbeddedLND().lookupPayment({ payment_hash: HASH })
        ).resolves.toBe(payment);
        expect(mockListPayments).not.toHaveBeenCalled();
    });

    it('answers null when NOT_FOUND and the scan agrees', async () => {
        mockTrackPaymentV2.mockRejectedValue(NOT_FOUND);
        mockListPayments.mockResolvedValue({ payments: [] });

        await expect(
            new EmbeddedLND().lookupPayment({
                payment_hash: HASH,
                creation_date_start: 1700000000
            })
        ).resolves.toBeNull();
    });

    // the NOT_FOUND event carries no hash and may belong to another lookup
    it('returns the scanned payment when NOT_FOUND was another stream', async () => {
        const payment = { payment_hash: HASH, status: 'SUCCEEDED' };
        mockTrackPaymentV2.mockRejectedValue(NOT_FOUND);
        mockListPayments.mockResolvedValue({ payments: [payment] });

        await expect(
            new EmbeddedLND().lookupPayment({ payment_hash: HASH })
        ).resolves.toBe(payment);
    });

    it('keeps NOT_FOUND as the answer when the confirming scan fails', async () => {
        mockTrackPaymentV2.mockRejectedValue(NOT_FOUND);
        mockListPayments.mockRejectedValue(new Error('rpc error'));

        await expect(
            new EmbeddedLND().lookupPayment({ payment_hash: HASH })
        ).resolves.toBeNull();
    });

    it('does not answer null when NOT_FOUND meets a full page that missed', async () => {
        mockTrackPaymentV2.mockRejectedValue(NOT_FOUND);
        mockListPayments
            .mockResolvedValueOnce(fullPage)
            .mockResolvedValueOnce({ payments: [] });

        await expect(
            new EmbeddedLND().lookupPayment({
                payment_hash: HASH,
                creation_date_start: 1700000000
            })
        ).rejects.toMatchObject({ name: 'PaymentLookupInconclusive' });
    });

    it('falls back to the scan when the stream times out', async () => {
        const payment = { payment_hash: HASH, status: 'IN_FLIGHT' };
        mockTrackPaymentV2.mockRejectedValue(new Error('Request timeout'));
        mockListPayments.mockResolvedValue({ payments: [payment] });

        await expect(
            new EmbeddedLND().lookupPayment({ payment_hash: HASH })
        ).resolves.toBe(payment);
    });
});
