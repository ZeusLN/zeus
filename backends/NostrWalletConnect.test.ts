const mockMakeInvoice = jest.fn();
const mockDecode = jest.fn();

jest.mock('../stores/Stores', () => ({
    settingsStore: {
        nostrWalletConnectUrl: 'nostr+walletconnect://test'
    }
}));

jest.mock('@getalby/sdk', () => ({
    webln: {
        NostrWebLNProvider: jest.fn(() => ({
            enable: jest.fn(),
            getBalance: jest.fn(),
            makeInvoice: mockMakeInvoice
        }))
    }
}));

jest.mock('bolt11', () => ({
    __esModule: true,
    default: {
        decode: mockDecode
    },
    decode: mockDecode
}));

import NostrWalletConnect from './NostrWalletConnect';

describe('NostrWalletConnect createInvoice', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockMakeInvoice.mockResolvedValue({
            paymentRequest: 'lnbc1invoice'
        });
        mockDecode.mockReturnValue({
            tags: [{ tagName: 'payment_hash', data: 'payment-hash' }]
        });
    });

    it('rounds valid non-sat-aligned msat amounts up for WebLN makeInvoice', async () => {
        const backend = new NostrWalletConnect();
        backend.nwc = {
            makeInvoice: mockMakeInvoice
        };

        await backend.createInvoice({
            value_msat: '1001',
            memo: 'subsat'
        });

        expect(mockMakeInvoice).toHaveBeenCalledWith({
            defaultMemo: 'subsat',
            amount: 2
        });
    });
});
