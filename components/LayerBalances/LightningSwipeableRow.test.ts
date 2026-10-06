jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
const mockGetParams = jest.fn();
jest.mock('js-lnurl', () => ({
    getParams: (...args: any[]) => mockGetParams(...args)
}));
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

import { Alert } from 'react-native';

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

describe('LightningSwipeableRow payment errors', () => {
    let navigation: { navigate: jest.Mock };
    let alertSpy: jest.SpyInstance;

    const press = (props: any) =>
        (
            new LightningSwipeableRow({ navigation, ...props }) as any
        ).fetchLnInvoice();

    beforeEach(() => {
        mockGetParams.mockReset();
        mockBlobUtilFetch.mockReset();
        mockSettingsStore.enableTor = false;
        navigation = { navigate: jest.fn() };
        alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    });

    afterEach(() => alertSpy.mockRestore());

    it('alerts instead of rejecting when the LNURL guard trips', async () => {
        await expect(
            press({
                lightning: 'lnurlp://example.com/pay?a=' + '%FF'.repeat(600)
            })
        ).resolves.toBeUndefined();

        expect(mockGetParams).not.toHaveBeenCalled();
        expect(alertSpy).toHaveBeenCalledWith(
            'general.error',
            'utils.handleAnything.invalidLnurlParams',
            expect.anything(),
            expect.anything()
        );
        expect(navigation.navigate).not.toHaveBeenCalled();
    });

    it('alerts on an .onion LNURL error response', async () => {
        await press({
            lnurlParams: {
                status: 'ERROR',
                domain: `${ONION}`,
                reason: 'unreachable'
            }
        });

        expect(alertSpy).toHaveBeenCalledWith(
            'general.error',
            `${ONION} says: unreachable`,
            expect.anything(),
            expect.anything()
        );
        expect(navigation.navigate).not.toHaveBeenCalled();
    });

    it('alerts when the Lightning Address lookup fails', async () => {
        mockBlobUtilFetch.mockResolvedValue({
            info: () => ({ status: 404 }),
            json: () => ({})
        });

        await expect(
            press({ lightningAddress: 'satoshi@domain.com' })
        ).resolves.toBeUndefined();

        expect(alertSpy).toHaveBeenCalledWith(
            'general.error',
            'utils.handleAnything.lightningAddressError',
            expect.anything(),
            expect.anything()
        );
        expect(navigation.navigate).not.toHaveBeenCalled();
    });

    it('still opens LnurlPay for a valid LNURL', async () => {
        mockGetParams.mockResolvedValue({ tag: 'payRequest' });
        const lightning = 'lnurlp://example.com/pay';

        await press({ lightning });

        expect(mockGetParams).toHaveBeenCalledWith(lightning);
        expect(navigation.navigate).toHaveBeenCalledWith(
            'LnurlPay',
            expect.objectContaining({
                lnurlParams: expect.objectContaining({ lnurlText: lightning })
            })
        );
        expect(alertSpy).not.toHaveBeenCalled();
    });
});
