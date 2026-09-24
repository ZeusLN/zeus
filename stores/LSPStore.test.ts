jest.mock('react-native-blob-util', () => ({ fetch: jest.fn() }));
jest.mock('../lndmobile/LndMobileInjection', () => ({
    __esModule: true,
    default: {
        index: {
            subscribeCustomMessages: jest.fn(() => Promise.resolve()),
            decodeCustomMessage: jest.fn()
        },
        channel: {}
    }
}));
jest.mock('../storage', () => ({
    __esModule: true,
    default: { getItem: jest.fn(), setItem: jest.fn() }
}));
jest.mock('../utils/LndMobileUtils', () => ({
    LndMobileEventEmitter: {
        addListener: jest.fn(() => ({ remove: jest.fn() }))
    }
}));
jest.mock('../utils/LspUtils', () => ({ verifyWrappedInvoice: jest.fn() }));
jest.mock('../utils/ClientInfoUtils', () => ({ getClientInfo: jest.fn() }));
jest.mock('../utils/BackendUtils', () => ({
    sendCustomMessage: jest.fn(),
    subscribeCustomMessages: jest.fn(),
    supportsLSPScustomMessage: () => true,
    supportsLSPS7native: () => false
}));
jest.mock('../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));
jest.mock('../utils/ErrorUtils', () => ({
    errorToUserFriendly: (e: any) => String(e)
}));
jest.mock('./SettingsStore', () => ({
    __esModule: true,
    default: class {},
    getLspConfigForNetwork: () => ({ lsps1Pubkey: 'lsp-pubkey' })
}));

import LSPStore from './LSPStore';
import BackendUtils from '../utils/BackendUtils';

const TIMEOUT_MS = 7000;

const makeStore = (implementation = 'lnd') =>
    new LSPStore(
        { implementation, settings: {} } as any,
        { channels: [] } as any,
        { nodeInfo: {}, getNodeInfo: jest.fn() } as any
    );

describe('LSPStore custom-message request timeouts', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
        jest.mocked(BackendUtils.sendCustomMessage).mockResolvedValue({});
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('times out get_info even after a subscription already succeeded', async () => {
        // embedded-lnd is the path where customMessagesSubscriber is kept and
        // the early return skips any later subscription-level timer (#4669)
        const store = makeStore('embedded-lnd');
        await store.subscribeCustomMessages();
        jest.advanceTimersByTime(TIMEOUT_MS);
        store.error = false;
        store.error_msg = '';
        await store.subscribeCustomMessages();

        store.lsps1GetInfoCustomMessage();
        expect(store.loadingLSPS1).toBe(true);

        jest.advanceTimersByTime(TIMEOUT_MS);

        expect(store.error).toBe(true);
        expect(store.error_msg).toBe('views.LSPS1.timeoutError');
        expect(store.loadingLSPS1).toBe(false);
    });

    it('does not report a timeout from a superseded overlapping request', async () => {
        const store = makeStore();
        store.lsps1GetInfoCustomMessage();
        jest.advanceTimersByTime(3000);
        store.lsps1GetInfoCustomMessage();

        // first request's timer would have fired here if it were still armed
        jest.advanceTimersByTime(TIMEOUT_MS - 3000);
        expect(store.error).toBe(false);
        expect(store.loadingLSPS1).toBe(true);

        // second request still times out on its own schedule
        jest.advanceTimersByTime(3000);
        expect(store.error).toBe(true);
        expect(store.loadingLSPS1).toBe(false);
    });

    it('does not time out once the response arrives', () => {
        const store = makeStore();
        const promise = store.lsps1GetInfoCustomMessage();
        const payload = { jsonrpc: '2.0', id: store.getInfoId, result: {} };
        store.handleCustomMessages({
            peer: Buffer.from('aa', 'hex').toString('base64'),
            data: Buffer.from(JSON.stringify(payload)).toString('base64')
        });

        jest.advanceTimersByTime(TIMEOUT_MS);

        expect(store.error).toBe(false);
        expect(store.loadingLSPS1).toBe(false);
        return expect(promise).resolves.toBeUndefined();
    });

    it('background get_extendable_channels probe times out silently', async () => {
        const store = makeStore();
        store.loadingLSPS7 = true;

        const probe = store.getExtendableChannels();
        await jest.advanceTimersByTimeAsync(TIMEOUT_MS);
        await probe;

        expect(store.error).toBe(false);
        expect(store.error_msg).toBe('');
        expect(store.loadingLSPS7).toBe(true);
    });

    it('probe timeout does not clear an in-flight create_order spinner', async () => {
        const store = makeStore();
        const probe = store.getExtendableChannels();
        await jest.advanceTimersByTimeAsync(3000);
        store.lsps7CreateOrderCustomMessage({});
        expect(store.loadingLSPS7).toBe(true);

        await jest.advanceTimersByTimeAsync(4000);
        await probe;

        expect(store.loadingLSPS7).toBe(true);
        expect(store.error).toBe(false);
    });

    it('resetLSPS1Data cancels pending timers so no stale timeout fires', () => {
        const store = makeStore();
        store.lsps1GetInfoCustomMessage();
        store.resetLSPS1Data();

        jest.advanceTimersByTime(TIMEOUT_MS);

        expect(store.error).toBe(false);
        expect(store.error_msg).toBe('');
    });

    it('resetLSPS7Data cancels a pending create_order timer', async () => {
        const store = makeStore();
        store.lsps7CreateOrderCustomMessage({});
        store.resetLSPS7Data();

        await jest.advanceTimersByTimeAsync(TIMEOUT_MS);

        expect(store.error).toBe(false);
        expect(store.error_msg).toBe('');
    });

    it('resetLSPS1Data ignores a send failure that lands after the reset', async () => {
        let rejectSend: (e: any) => void = () => {};
        jest.mocked(BackendUtils.sendCustomMessage).mockReturnValue(
            new Promise((_, reject) => {
                rejectSend = reject;
            }) as any
        );
        const store = makeStore();
        store.lsps1GetInfoCustomMessage();
        store.resetLSPS1Data();

        rejectSend('peer not connected');
        await Promise.resolve();
        await Promise.resolve();

        expect(store.error).toBe(false);
        expect(store.error_msg).toBe('');
    });

    it('resetLSPS1Data drops a late get_info response', () => {
        const store = makeStore();
        store.lsps1GetInfoCustomMessage();
        const lateId = store.getInfoId;
        store.resetLSPS1Data();

        store.handleCustomMessages({
            peer: Buffer.from('aa', 'hex').toString('base64'),
            data: Buffer.from(
                JSON.stringify({ jsonrpc: '2.0', id: lateId, result: { x: 1 } })
            ).toString('base64')
        });

        expect(store.getInfoData).toEqual({});
    });

    it('background probe send failure does not surface an error', async () => {
        jest.mocked(BackendUtils.sendCustomMessage).mockRejectedValue(
            'peer not connected'
        );
        const store = makeStore();

        await store.getExtendableChannels();

        expect(store.error).toBe(false);
        expect(store.error_msg).toBe('');
    });
});
