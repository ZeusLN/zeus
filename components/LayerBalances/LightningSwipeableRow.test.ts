jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('js-lnurl', () => ({ getParams: jest.fn() }));
const mockBlobUtilFetch = jest.fn();
// networkFetch passes headers and body through even when they are undefined;
// drop trailing undefined args so assertions can name only the method and URL
jest.mock('react-native-blob-util', () => ({
    fetch: (...args: any[]) => {
        while (args.length && args[args.length - 1] === undefined) args.pop();
        return mockBlobUtilFetch(...args);
    }
}));
const mockDoTorRequest = jest.fn();
const mockDoTorRequestRaw = jest.fn();
jest.mock('../../utils/TorUtils', () => ({
    doTorRequest: (...args: any[]) => mockDoTorRequest(...args),
    doTorRequestRaw: (...args: any[]) => mockDoTorRequestRaw(...args),
    RequestMethod: { GET: 'GET', POST: 'POST', DELETE: 'DELETE' }
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
        mockDoTorRequestRaw.mockReset();
        mockDoTorRequestRaw.mockResolvedValue({
            status: 200,
            body: JSON.stringify({ callback: 'https://example.com/callback' })
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

    it('fetches a clearnet domain over Tor when Tor is enabled', async () => {
        mockSettingsStore.enableTor = true;

        await row.handleLightningAddress(
            'satoshi@pay.onion.example.com',
            navigation,
            {}
        );

        expect(mockDoTorRequestRaw).toHaveBeenCalledWith(
            'https://pay.onion.example.com/.well-known/lnurlp/satoshi',
            'GET',
            undefined,
            undefined
        );
        expect(mockDoTorRequest).not.toHaveBeenCalled();
        expect(mockBlobUtilFetch).not.toHaveBeenCalled();
        expect(navigation.navigate).toHaveBeenCalledWith(
            'LnurlPay',
            expect.objectContaining({
                lnurlParams: { callback: 'https://example.com/callback' }
            })
        );
    });

    it('does not fall back to a direct request when the Tor request fails', async () => {
        mockSettingsStore.enableTor = true;
        mockDoTorRequestRaw.mockRejectedValue(new Error('tor failure'));

        await expect(
            row.handleLightningAddress('satoshi@domain.com', navigation, {})
        ).rejects.toThrow('tor failure');
        expect(mockBlobUtilFetch).not.toHaveBeenCalled();
        expect(navigation.navigate).not.toHaveBeenCalled();
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

    it('passes the Tor setting to the LNURL params lookup', async () => {
        const LnurlParamsUtils = require('../../utils/LnurlParamsUtils');
        const spy = jest
            .spyOn(LnurlParamsUtils, 'getLnurlParams')
            .mockResolvedValue({ tag: 'payRequest' });
        mockSettingsStore.enableTor = true;

        try {
            await row.handleLnurlRequest(
                'lnurl1abc',
                undefined,
                navigation,
                {}
            );

            expect(spy).toHaveBeenCalledWith('lnurl1abc', true);
            expect(navigation.navigate).toHaveBeenCalledWith(
                'LnurlPay',
                expect.anything()
            );
        } finally {
            spy.mockRestore();
        }
    });
});
