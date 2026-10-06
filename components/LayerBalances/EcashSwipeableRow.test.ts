jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
const mockGetParams = jest.fn();
jest.mock('js-lnurl', () => ({
    getParams: (...args: any[]) => mockGetParams(...args)
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

describe('EcashSwipeableRow payment errors', () => {
    let navigation: { navigate: jest.Mock };
    let alertSpy: jest.SpyInstance;

    const press = (props: any) =>
        (
            new EcashSwipeableRow({ navigation, ...props }) as any
        ).fetchLnInvoice();

    beforeEach(() => {
        mockGetParams.mockReset();
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
                domain: 'example.onion',
                reason: 'unreachable'
            }
        });

        expect(alertSpy).toHaveBeenCalledWith(
            'general.error',
            'example.onion says: unreachable',
            expect.anything(),
            expect.anything()
        );
        expect(navigation.navigate).not.toHaveBeenCalled();
    });

    it('still opens ReceiveEcash for a valid withdraw LNURL', async () => {
        const params = { tag: 'withdrawRequest' };
        mockGetParams.mockResolvedValue(params);

        await press({ lightning: 'lnurlw://example.com/withdraw' });

        expect(navigation.navigate).toHaveBeenCalledWith('ReceiveEcash', {
            lnurlParams: params
        });
        expect(alertSpy).not.toHaveBeenCalled();
    });
});
