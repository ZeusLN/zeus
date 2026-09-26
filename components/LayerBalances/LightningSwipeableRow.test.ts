jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('js-lnurl', () => ({ getParams: jest.fn() }));
const mockBlobUtilFetch = jest.fn();
jest.mock('react-native-blob-util', () => ({
    fetch: (...args: any[]) => mockBlobUtilFetch(...args)
}));
const mockDoTorRequest = jest.fn();
jest.mock('../../utils/TorUtils', () => ({
    doTorRequest: (...args: any[]) => mockDoTorRequest(...args),
    RequestMethod: { GET: 'GET' }
}));
jest.mock('../../utils/BackendUtils', () => ({
    supportsCashuWallet: () => false
}));
jest.mock('../../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));
jest.mock('../../utils/ThemeUtils', () => ({ themeColor: () => '#ffffff' }));
jest.mock('../../stores/Stores', () => ({
    modalStore: {},
    invoicesStore: {},
    nodeInfoStore: {},
    settingsStore: {}
}));
jest.mock('../../stores/SyncStore', () => ({}));
jest.mock('./SwipeableRowAction', () => 'SwipeableRowAction');
jest.mock('./SwipeableRowContainer', () => 'SwipeableRowContainer');

import { settingsStore } from '../../stores/Stores';
import LightningSwipeableRow from './LightningSwipeableRow';

const mockSettingsStore = settingsStore as { enableTor?: boolean };

const ONION = 'zeuspayzeuspayzeuspayzeuspayzeuspayzeuspayzeuspayzeus.onion';

describe('LightningSwipeableRow Lightning Address lookup', () => {
    let navigation: { navigate: jest.Mock };
    let row: any;

    beforeEach(() => {
        mockBlobUtilFetch.mockReset();
        mockBlobUtilFetch.mockResolvedValue({
            info: () => ({ status: 200 }),
            json: () => ({ callback: 'https://example.com/callback' })
        });
        mockDoTorRequest.mockReset();
        mockDoTorRequest.mockResolvedValue({
            callback: `http://${ONION}/callback`
        });
        mockSettingsStore.enableTor = false;
        navigation = { navigate: jest.fn() };
        row = new LightningSwipeableRow({} as any);
    });

    it('lowercases an uppercase domain and username', async () => {
        await row.handleLightningAddress('SATOSHI@BLINK.SV', navigation, {});

        expect(mockBlobUtilFetch).toHaveBeenCalledWith(
            'get',
            'https://blink.sv/.well-known/lnurlp/satoshi'
        );
        expect(navigation.navigate).toHaveBeenCalledWith(
            'LnurlPay',
            expect.objectContaining({ lightningAddress: 'SATOSHI@BLINK.SV' })
        );
    });

    it('keeps the username casing for cryptoqr.net', async () => {
        const username = 'https%3A%2F%2Fpay.cryptoqr.net%2F3458967';

        await row.handleLightningAddress(
            `${username}@cryptoqr.net`,
            navigation,
            {}
        );

        expect(mockBlobUtilFetch).toHaveBeenCalledWith(
            'get',
            `https://cryptoqr.net/.well-known/lnurlp/${username}`
        );
    });

    it('routes an uppercase .onion address through Tor', async () => {
        mockSettingsStore.enableTor = true;

        await row.handleLightningAddress(
            `SATOSHI@${ONION.toUpperCase()}`,
            navigation,
            {}
        );

        expect(mockDoTorRequest).toHaveBeenCalledWith(
            `http://${ONION}/.well-known/lnurlp/satoshi`,
            'GET'
        );
        expect(mockBlobUtilFetch).not.toHaveBeenCalled();
        expect(navigation.navigate).toHaveBeenCalledWith(
            'LnurlPay',
            expect.anything()
        );
    });

    it('fetches a clearnet domain with an .onion label over https', async () => {
        mockSettingsStore.enableTor = true;

        await row.handleLightningAddress(
            'satoshi@pay.onion.example.com',
            navigation,
            {}
        );

        expect(mockDoTorRequest).not.toHaveBeenCalled();
        expect(mockBlobUtilFetch).toHaveBeenCalledWith(
            'get',
            'https://pay.onion.example.com/.well-known/lnurlp/satoshi'
        );
    });

    it('rejects a response without a callback', async () => {
        mockBlobUtilFetch.mockResolvedValue({
            info: () => ({ status: 200 }),
            json: () => ({})
        });

        await expect(
            row.handleLightningAddress('satoshi@domain.com', navigation, {})
        ).rejects.toThrow('utils.handleAnything.lightningAddressError');
        expect(navigation.navigate).not.toHaveBeenCalled();
    });
});
