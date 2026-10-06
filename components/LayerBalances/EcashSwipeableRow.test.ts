jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
// the request fetchLnurlUrl sends for each hop
const mockFetch = jest.fn();
jest.mock('react-native-blob-util', () => ({
    config: () => ({ fetch: (...args: any[]) => mockFetch(...args) })
}));
jest.mock('../../utils/BackendUtils', () => ({}));
jest.mock('../../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));
jest.mock('../../utils/ThemeUtils', () => ({ themeColor: () => '#ffffff' }));
jest.mock('../../stores/Stores', () => ({ cashuStore: {} }));
jest.mock('../../stores/SyncStore', () => ({}));
jest.mock('./SwipeableRowAction', () => 'SwipeableRowAction');
jest.mock('./SwipeableRowContainer', () => 'SwipeableRowContainer');

import { Alert } from 'react-native';

import EcashSwipeableRow from './EcashSwipeableRow';

describe('EcashSwipeableRow LNURL errors', () => {
    let navigation: { navigate: jest.Mock };
    let alertSpy: jest.SpyInstance;

    // what tapping a locked row runs
    const press = (props: any) =>
        (
            new EcashSwipeableRow({ navigation, ...props }) as any
        ).fetchLnInvoice();

    const alertedMessage = () => alertSpy.mock.calls[0]?.[1];

    beforeEach(() => {
        mockFetch.mockReset();
        navigation = { navigate: jest.fn() };
        alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    });

    afterEach(() => alertSpy.mockRestore());

    // #5060: this error used to end up as an unhandled rejection
    it('alerts on an .onion LNURL error response', async () => {
        await expect(
            press({
                lnurlParams: {
                    status: 'ERROR',
                    domain: 'example.onion',
                    reason: 'unreachable'
                }
            })
        ).resolves.toBeUndefined();

        expect(alertedMessage()).toBe('example.onion says: unreachable');
        expect(navigation.navigate).not.toHaveBeenCalled();
    });

    it('keeps the host policy message for a refused LNURL', async () => {
        await press({ lightning: 'lnurlw://192.168.1.1/withdraw' });

        expect(alertedMessage()).toBe('utils.lnurl.unsafeEndpoint');
        expect(mockFetch).not.toHaveBeenCalled();
        expect(navigation.navigate).not.toHaveBeenCalled();
    });

    it('opens ReceiveEcash for a valid withdraw LNURL', async () => {
        const params = {
            tag: 'withdrawRequest',
            callback: 'https://example.com/callback',
            k1: 'k1'
        };
        mockFetch.mockResolvedValue({
            info: () => ({ status: 200 }),
            json: () => params
        });

        await press({ lightning: 'lnurlw://example.com/withdraw' });

        expect(navigation.navigate).toHaveBeenCalledWith('ReceiveEcash', {
            lnurlParams: { ...params, domain: 'example.com' }
        });
        expect(alertSpy).not.toHaveBeenCalled();
    });
});
