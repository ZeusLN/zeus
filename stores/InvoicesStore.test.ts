jest.mock('../stores/Stores', () => ({}));
jest.mock('react-native-blob-util', () => ({}));
jest.mock('../ldknode/LdkNodeInjection', () => ({}));
jest.mock('../utils/BackendUtils', () => ({
    __esModule: true,
    default: {
        decodePaymentRequest: jest.fn(),
        getNewAddress: jest.fn(),
        getNewChangeAddress: jest.fn(),
        isLNDBased: jest.fn(() => false)
    }
}));
jest.mock('../utils/LocaleUtils', () => ({
    localeString: (s: string) => s
}));
jest.mock('../utils/ErrorUtils', () => ({
    errorToUserFriendly: (error: Error) => error.message
}));

import InvoicesStore from './InvoicesStore';
import BackendUtils from '../utils/BackendUtils';

// decodes with timestamp 1700074718 and expiry 3600 (see Bolt11Utils.test.ts)
const paymentRequest =
    'lnbcrt1230n1pj429x7pp57t97q4awqj3f529snr0pa6senk83sq5pp760qf5a4jzvd7xgwcksdqqcqzzsxqrrsssp57eqtv7vxr46arupna3w4ct0lkf2mqmz9wt044cwkks0rwlnhfr5s9qyyssqragwpwav7nfwv2xyuuamxxj4pnnpzv2hlw7j473repd3sq7st698ta9kmzmygt0w7tmncl56a6mnma0w7e5dlpqd0wy6x3v35rssldspjhh8p0';

// lnd-style decodepayreq response: expiry fields present,
// but no bolt11 string to re-decode
const lndDecodeResponse = {
    destination: '02758997f184be06f4350b136db0bed6f8',
    timestamp: '1700074718',
    expiry: '3600',
    num_satoshis: '123'
};

const newStore = () =>
    new InvoicesStore({} as any, {} as any, {} as any, {} as any);

describe('InvoicesStore.getPayReq', () => {
    it('threads the original payment request through so expiry is computable when the decode response omits the bolt11 string', async () => {
        (BackendUtils.decodePaymentRequest as jest.Mock).mockResolvedValue(
            lndDecodeResponse
        );

        const store = newStore();
        await store.getPayReq(paymentRequest);

        expect(store.getPayReqError).toBeNull();
        expect(store.pay_req).not.toBeNull();
        expect(store.pay_req!.getPaymentRequest).toBe(paymentRequest);
        expect(store.pay_req!.isExpiredNow()).toBe(true);
    });

    it('surfaces decode errors and clears pay_req', async () => {
        (BackendUtils.decodePaymentRequest as jest.Mock).mockRejectedValue(
            new Error('decode failed')
        );

        const store = newStore();
        await store.getPayReq(paymentRequest);

        expect(store.pay_req).toBeNull();
        expect(store.getPayReqError).toBe('decode failed');
    });
});

// ZEUS-2223 / ZEUS-2932: imported accounts live under a single key scope;
// lnd rejects address requests whose type doesn't match it
describe('InvoicesStore.getNewAddress', () => {
    beforeEach(() => {
        (BackendUtils.getNewAddress as jest.Mock).mockResolvedValue({
            address: 'bcrt1qtest'
        });
    });

    it('honors an account-derived walletrpc address type for non-default accounts', async () => {
        const store = newStore();
        await store.getNewAddress({
            account: 'SeedSigner',
            type: 'TAPROOT_PUBKEY'
        });

        expect(BackendUtils.getNewAddress).toHaveBeenCalledWith({
            account: 'SeedSigner',
            type: 'TAPROOT_PUBKEY'
        });
    });

    it('normalizes walletrpc numeric address types from the embedded proto decode', async () => {
        const store = newStore();
        await store.getNewAddress({ account: 'SeedSigner', type: 4 });

        expect(BackendUtils.getNewAddress).toHaveBeenCalledWith({
            account: 'SeedSigner',
            type: 'TAPROOT_PUBKEY'
        });
    });

    it('drops non-account address types (like the settings preference) for non-default accounts', async () => {
        const store = newStore();
        await store.getNewAddress({ account: 'SeedSigner', type: '0' });

        expect(BackendUtils.getNewAddress).toHaveBeenCalledWith({
            account: 'SeedSigner'
        });
    });

    it('leaves the requested type untouched for the default account', async () => {
        const store = newStore();
        await store.getNewAddress({ account: 'default', type: '0' });

        expect(BackendUtils.getNewAddress).toHaveBeenCalledWith({
            account: 'default',
            type: '0'
        });
    });

    it('leaves the caller-supplied request object untouched', async () => {
        const store = newStore();
        const params = { account: 'SeedSigner', type: '0' };
        await store.getNewAddress(params);

        expect(params).toEqual({ account: 'SeedSigner', type: '0' });
    });

    it('surfaces backend errors instead of leaving a stale address', async () => {
        (BackendUtils.getNewAddress as jest.Mock).mockRejectedValue(
            new Error('account not found')
        );

        const store = newStore();
        await store.getNewAddress({ account: 'SeedSigner' });

        expect(store.onChainAddress).toBeNull();
        expect(store.error_msg).toContain('account not found');
    });
});

describe('InvoicesStore.getNewChangeAddress', () => {
    it('sets change without mutating the caller-supplied request object', async () => {
        (BackendUtils.getNewChangeAddress as jest.Mock).mockResolvedValue({
            addr: 'bcrt1qchange'
        });

        const store = newStore();
        const params = { account: 'SeedSigner', type: 'TAPROOT_PUBKEY' };
        await store.getNewChangeAddress(params);

        expect(BackendUtils.getNewChangeAddress).toHaveBeenCalledWith({
            account: 'SeedSigner',
            type: 'TAPROOT_PUBKEY',
            change: true
        });
        expect(params).toEqual({
            account: 'SeedSigner',
            type: 'TAPROOT_PUBKEY'
        });
    });
});
