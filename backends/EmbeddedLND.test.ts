// import-time scaffolding for LND.ts (see LND.test.ts) and the native
// lndmobile modules EmbeddedLND.ts destructures at import time
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
jest.mock('../utils/LndMobileUtils', () => ({
    checkLndStreamErrorResponse: jest.fn(),
    LndMobileEventEmitter: {}
}));
jest.mock('../lndmobile/onchain', () => ({
    decodeSubscribeTransactionsResult: jest.fn()
}));
jest.mock('../lndmobile/wallet', () => ({}));
jest.mock('../lndmobile/LndMobileInjection', () => ({
    __esModule: true,
    default: {
        index: {},
        channel: {},
        wallet: {},
        wtclient: {},
        onchain: {
            getTransactions: jest.fn(),
            sendCoins: jest.fn()
        }
    }
}));

import EmbeddedLND from './EmbeddedLND';
import lndMobile from '../lndmobile/LndMobileInjection';

const { getTransactions, sendCoins } = lndMobile.onchain as unknown as {
    getTransactions: jest.Mock;
    sendCoins: jest.Mock;
};

describe('EmbeddedLND on-chain sends', () => {
    beforeEach(() => {
        getTransactions.mockReset();
        sendCoins.mockReset();
    });

    it('passes the send label to SendCoins', async () => {
        await new EmbeddedLND().sendCoins({
            addr: 'bcrt1qrecipient',
            amount: '100000',
            sat_per_vbyte: '2',
            label: 'ZEUS send 0123456789abcdef'
        });

        expect(sendCoins).toHaveBeenCalledWith(
            'bcrt1qrecipient',
            '100000',
            '2',
            undefined,
            undefined,
            undefined,
            'ZEUS send 0123456789abcdef'
        );
    });

    it('passes the lookup start height to GetTransactions', async () => {
        await new EmbeddedLND().getTransactions({ start_height: 799994 });

        expect(getTransactions).toHaveBeenCalledWith({
            start_height: 799994
        });
    });
});
