jest.mock('react-native-blob-util', () => ({
    __esModule: true,
    default: { fetch: jest.fn() }
}));
jest.mock('../utils/TorUtils', () => ({
    doTorRequest: jest.fn(),
    doTorRequestRaw: jest.fn(),
    RequestMethod: { GET: 'GET', POST: 'POST', DELETE: 'DELETE' }
}));
jest.mock('./SettingsStore', () => ({
    __esModule: true,
    default: class SettingsStore {}
}));
// UnitsUtils, imported for number formatting, loads the store graph
jest.mock('./Stores', () => ({
    settingsStore: { settings: {} },
    fiatStore: {}
}));

import ReactNativeBlobUtil from 'react-native-blob-util';
import FiatStore from './FiatStore';
import { doTorRequestRaw } from '../utils/TorUtils';

const blobFetch = ReactNativeBlobUtil.fetch as jest.Mock;
const torFetch = doTorRequestRaw as jest.Mock;

const USD = { code: 'USD', rate: 100000.5 };

// fiat off, so the constructor does not fetch on its own
const newStore = (enableTor: boolean) =>
    new FiatStore({
        enableTor,
        getSettings: async () => ({ fiatEnabled: false })
    } as any);

const respond = (body: any) => {
    torFetch.mockResolvedValue({ status: 200, body: JSON.stringify(body) });
    blobFetch.mockResolvedValue({
        info: () => ({ status: 200 }),
        json: () => body
    });
};

const expectTransport = (enableTor: boolean, url: string) => {
    if (enableTor) {
        expect(blobFetch).not.toHaveBeenCalled();
        expect(torFetch).toHaveBeenCalledWith(url, 'GET', undefined, undefined);
    } else {
        expect(torFetch).not.toHaveBeenCalled();
        expect(blobFetch).toHaveBeenCalledWith(
            'GET',
            url,
            undefined,
            undefined
        );
    }
};

describe('FiatStore rate fetches over Tor', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it.each([true, false])('Yadio (Tor %s)', async (enableTor) => {
        respond({ rate: USD.rate });
        const store = newStore(enableTor);

        const rate = await (store as any).getSelectedFiatRateFromYadio('USD');

        expectTransport(enableTor, 'https://api.yadio.io/rate/USD/BTC');
        expect(rate).toMatchObject({ code: 'USD', rate: USD.rate });
    });

    it.each([true, false])('ZEUS (Tor %s)', async (enableTor) => {
        respond([USD]);
        const store = newStore(enableTor);

        const rates = await (store as any).getFiatRatesFromZeus();

        expectTransport(
            enableTor,
            'https://pay.zeusln.app/api/rates?storeId=Fjt7gLnGpg4UeBMFccLquy3GTTEz4cHU4PZMU63zqMBo'
        );
        expect(rates).toEqual([USD]);
    });
});
