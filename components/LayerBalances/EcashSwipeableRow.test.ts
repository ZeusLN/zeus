jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
const mockGetLnurlParams = jest.fn();
jest.mock('../../utils/LnurlParamsUtils', () => ({
    getLnurlParams: (...args: any[]) => mockGetLnurlParams(...args)
}));
jest.mock('../../utils/BackendUtils', () => ({}));
jest.mock('../../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));
jest.mock('../../utils/ThemeUtils', () => ({ themeColor: () => '#ffffff' }));
jest.mock('../../stores/Stores', () => ({
    cashuStore: {},
    settingsStore: {}
}));
jest.mock('../../stores/SyncStore', () => ({}));
jest.mock('./SwipeableRowAction', () => 'SwipeableRowAction');
jest.mock('./SwipeableRowContainer', () => 'SwipeableRowContainer');

import { settingsStore } from '../../stores/Stores';
import EcashSwipeableRow from './EcashSwipeableRow';

const mockSettingsStore = settingsStore as { enableTor?: boolean };

describe('EcashSwipeableRow LNURL params lookup', () => {
    let navigation: { navigate: jest.Mock };
    let row: any;

    beforeEach(() => {
        mockGetLnurlParams.mockReset();
        mockGetLnurlParams.mockResolvedValue({ tag: 'withdrawRequest' });
        delete mockSettingsStore.enableTor;
        navigation = { navigate: jest.fn() };
        row = new EcashSwipeableRow({} as any);
    });

    it('passes the Tor setting to the lookup', async () => {
        mockSettingsStore.enableTor = true;

        await row.handleLnurlRequest('lnurl1abc', undefined, navigation);

        expect(mockGetLnurlParams).toHaveBeenCalledWith('lnurl1abc', true);
        expect(navigation.navigate).toHaveBeenCalledWith('ReceiveEcash', {
            lnurlParams: { tag: 'withdrawRequest' }
        });
    });

    it('skips the lookup when params are already known', async () => {
        await row.handleLnurlRequest(
            'lnurl1abc',
            { tag: 'payRequest' },
            navigation
        );

        expect(mockGetLnurlParams).not.toHaveBeenCalled();
        expect(navigation.navigate).toHaveBeenCalledWith(
            'LnurlPay',
            expect.objectContaining({ ecash: true })
        );
    });
});
