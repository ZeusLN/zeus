jest.mock('../stores/Stores', () => ({}));

jest.mock('../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));

jest.mock('../utils/BackendUtils', () => ({
    __esModule: true,
    default: {
        signMessage: jest.fn()
    }
}));

jest.mock('react-native-notifications', () => ({
    Notifications: {
        postLocalNotification: jest.fn()
    }
}));

jest.mock('react-native-blob-util', () => ({
    __esModule: true,
    default: { fetch: jest.fn() }
}));

jest.mock('socket.io-client', () => ({
    io: jest.fn(() => ({ connect: jest.fn(), emit: jest.fn(), on: jest.fn() }))
}));

jest.mock('../storage', () => ({
    __esModule: true,
    default: { getItem: jest.fn(), setItem: jest.fn() }
}));

jest.mock('./CashuStore', () => ({ __esModule: true, default: class {} }));
jest.mock('./NodeInfoStore', () => ({ __esModule: true, default: class {} }));
jest.mock('./SettingsStore', () => ({ __esModule: true, default: class {} }));

import LightningAddressStore from './LightningAddressStore';

const CONFIGURED_MINT = 'https://mint.zeusnuts.com';
const ATTACKER_MINT = 'http://attacker-mint.example:3338';

const makeStore = (configuredMintUrl?: string) => {
    const checkInvoicePaid = jest.fn().mockResolvedValue({ isPaid: false });
    const cashuStore: any = {
        checkInvoicePaid,
        deriveCashuSecretKey: jest.fn(),
        receiveTokenCDK: jest.fn()
    };
    const settingsStore: any = {
        settings: {
            lightningAddress: configuredMintUrl
                ? { mintUrl: configuredMintUrl }
                : {}
        }
    };
    const nodeInfoStore: any = { nodeInfo: {} };
    const store = new LightningAddressStore(
        cashuStore,
        nodeInfoStore,
        settingsStore
    );
    return { store, checkInvoicePaid };
};

describe('LightningAddressStore.redeemCashu mint binding', () => {
    it('refuses to redeem against a mint that is not the configured one', async () => {
        const { store, checkInvoicePaid } = makeStore(CONFIGURED_MINT);

        const result = await store.redeemCashu(
            'attacker-quote-id',
            ATTACKER_MINT,
            21000,
            false,
            true
        );

        expect(result).toBe(false);
        expect(checkInvoicePaid).not.toHaveBeenCalled();
    });

    it('proceeds when the event mint matches the configured mint', async () => {
        const { store, checkInvoicePaid } = makeStore(CONFIGURED_MINT);

        await store.redeemCashu(
            'quote-id',
            CONFIGURED_MINT,
            21000,
            false,
            true
        );

        expect(checkInvoicePaid).toHaveBeenCalledTimes(1);
        expect(checkInvoicePaid.mock.calls[0][1]).toBe(CONFIGURED_MINT);
    });

    it('matches regardless of trailing slash or case differences', async () => {
        const { store, checkInvoicePaid } = makeStore(CONFIGURED_MINT);

        await store.redeemCashu(
            'quote-id',
            `${CONFIGURED_MINT.toUpperCase()}/`,
            21000,
            false,
            true
        );

        expect(checkInvoicePaid).toHaveBeenCalledTimes(1);
    });

    it('refuses to redeem when no mint is configured', async () => {
        const { store, checkInvoicePaid } = makeStore(undefined);

        const result = await store.redeemCashu(
            'quote-id',
            CONFIGURED_MINT,
            21000,
            false,
            true
        );

        expect(result).toBe(false);
        expect(checkInvoicePaid).not.toHaveBeenCalled();
    });
});
