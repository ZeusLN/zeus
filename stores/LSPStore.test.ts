jest.mock('react-native-blob-util', () => ({ fetch: jest.fn() }));
jest.mock('../lndmobile/LndMobileInjection', () => ({
    __esModule: true,
    default: {
        index: {
            subscribeCustomMessages: jest.fn(() => Promise.resolve()),
            decodeCustomMessage: jest.fn()
        },
        channel: { channelAcceptor: jest.fn(() => Promise.resolve()) }
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
    initChanAcceptor: jest.fn(),
    supportsFlowLSP: jest.fn(() => true),
    supportsLSPScustomMessage: () => true,
    supportsLSPS7native: jest.fn(() => false),
    lsps7GetExtendableChannels: jest.fn()
}));
jest.mock('../utils/LocaleUtils');
jest.mock('./SettingsStore', () => ({
    __esModule: true,
    default: class {},
    getLspConfigForNetwork: () => ({ lsps1Pubkey: 'lsp-pubkey' })
}));

import ReactNativeBlobUtil from 'react-native-blob-util';

import LSPStore from './LSPStore';
import BackendUtils from '../utils/BackendUtils';
import LndMobileInjection from '../lndmobile/LndMobileInjection';
import { LndMobileEventEmitter } from '../utils/LndMobileUtils';

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

    it('background get_extendable_channels probe timeout only sets the lease error', async () => {
        const store = makeStore();
        store.loadingLSPS7 = true;

        const probe = store.getExtendableChannels();
        await jest.advanceTimersByTimeAsync(TIMEOUT_MS);
        await probe;

        expect(store.error).toBe(false);
        expect(store.error_msg).toBe('');
        expect(store.loadingLSPS7).toBe(true);
        expect(store.getExtendableChannelsError).toBe(true);
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

    it('background probe send failure only sets the lease error', async () => {
        jest.mocked(BackendUtils.sendCustomMessage).mockRejectedValue(
            'peer not connected'
        );
        const store = makeStore();

        await store.getExtendableChannels();

        expect(store.error).toBe(false);
        expect(store.error_msg).toBe('');
        expect(store.getExtendableChannelsError).toBe(true);
    });
});

const extendableChannelsReply = (store: LSPStore, reply: any) =>
    store.handleCustomMessages({
        peer: Buffer.from('aa', 'hex').toString('base64'),
        data: Buffer.from(
            JSON.stringify({
                jsonrpc: '2.0',
                id: store.getExtendableChannelsId,
                ...reply
            })
        ).toString('base64')
    });

const deferred = <T>() => {
    let resolve!: (value: T) => void;
    let reject!: (reason: any) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
};

describe('LSPStore.getExtendableChannels over custom messages', () => {
    const channel = {
        short_channel_id: '800000x1x0',
        max_channel_extension_expiry_blocks: 0,
        expiration_block: 852560
    };

    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
        jest.mocked(BackendUtils.sendCustomMessage).mockResolvedValue({});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.mocked(console.error).mockRestore();
    });

    it('stores the channels and clears the error on a reply', async () => {
        const store = makeStore();
        store.getExtendableChannelsError = true;
        const probe = store.getExtendableChannels();

        extendableChannelsReply(store, {
            result: { extendable_channels: [channel] }
        });
        await probe;

        expect(store.getExtendableChannelsData).toEqual([channel]);
        expect(store.getExtendableChannelsError).toBe(false);
    });

    it('sets only the lease error on a JSON-RPC error reply', async () => {
        const store = makeStore();
        const probe = store.getExtendableChannels();

        extendableChannelsReply(store, {
            error: { code: -32603, message: 'internal error' }
        });
        await probe;

        expect(store.getExtendableChannelsError).toBe(true);
        expect(store.error).toBe(false);
        expect(store.error_msg).toBe('');
        expect(store.getExtendableChannelsData).toEqual([]);
    });

    it('keeps an error another LSP screen is showing', async () => {
        const store = makeStore();
        store.error = true;
        store.error_msg = 'order failed';
        const probe = store.getExtendableChannels();

        extendableChannelsReply(store, {
            result: { extendable_channels: [channel] }
        });
        await probe;

        expect(store.error).toBe(true);
        expect(store.error_msg).toBe('order failed');
    });

    it.each([
        ['a reply', { result: { extendable_channels: [channel] } }],
        ['an error reply', { error: { code: -32603, message: 'x' } }]
    ])('leaves an LSPS7 order spinner alone on %s', async (_, reply) => {
        const store = makeStore();
        store.loadingLSPS7 = true;
        const probe = store.getExtendableChannels();

        extendableChannelsReply(store, reply);
        await probe;

        expect(store.loadingLSPS7).toBe(true);
    });

    it('does not time out once the reply arrives', async () => {
        const store = makeStore();
        const probe = store.getExtendableChannels();
        extendableChannelsReply(store, {
            result: { extendable_channels: [channel] }
        });
        await probe;

        await jest.advanceTimersByTimeAsync(TIMEOUT_MS);

        expect(store.getExtendableChannelsError).toBe(false);
    });

    it('does not count a superseded probe as a timeout', async () => {
        const store = makeStore();
        const first = store.getExtendableChannels();
        await jest.advanceTimersByTimeAsync(3000);
        const second = store.getExtendableChannels();
        await first;

        // the first probe's timer would have fired here if still armed
        await jest.advanceTimersByTimeAsync(TIMEOUT_MS - 3000);
        expect(store.getExtendableChannelsError).toBe(false);

        extendableChannelsReply(store, {
            result: { extendable_channels: [channel] }
        });
        await second;
        expect(store.getExtendableChannelsError).toBe(false);
        expect(store.getExtendableChannelsData).toEqual([channel]);
    });

    it('ignores a reply to a superseded probe', async () => {
        const store = makeStore();
        store.getExtendableChannels();
        const firstId = store.getExtendableChannelsId;
        const second = store.getExtendableChannels();

        store.handleCustomMessages({
            peer: Buffer.from('aa', 'hex').toString('base64'),
            data: Buffer.from(
                JSON.stringify({
                    jsonrpc: '2.0',
                    id: firstId,
                    error: { code: -32603, message: 'stale' }
                })
            ).toString('base64')
        });
        expect(store.getExtendableChannelsError).toBe(false);

        extendableChannelsReply(store, {
            result: { extendable_channels: [channel] }
        });
        await second;
        expect(store.getExtendableChannelsData).toEqual([channel]);
    });

    it('ignores a send failure from a superseded probe', async () => {
        const send = deferred<any>();
        jest.mocked(BackendUtils.sendCustomMessage)
            .mockReturnValueOnce(send.promise)
            .mockResolvedValue({});
        const store = makeStore();
        const first = store.getExtendableChannels();
        const second = store.getExtendableChannels();
        await first;

        send.reject('peer not connected');
        await jest.advanceTimersByTimeAsync(0);
        expect(store.getExtendableChannelsError).toBe(false);

        extendableChannelsReply(store, {
            result: { extendable_channels: [channel] }
        });
        await second;
        expect(store.getExtendableChannelsError).toBe(false);
    });
});

describe('LSPStore.reset and LSPS7 lease data', () => {
    const channel = {
        short_channel_id: '800000x1x0',
        max_channel_extension_expiry_blocks: 0,
        expiration_block: 852560
    };

    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
        jest.mocked(BackendUtils.sendCustomMessage).mockResolvedValue({});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.mocked(console.error).mockRestore();
    });

    it('starts with no LSPS7 spinner', () => {
        // the LSPS7 screen shows a spinner while this is true, and only an
        // order request should set it
        expect(makeStore().loadingLSPS7).toBe(false);
    });

    it('clears lease data and the fetch error', () => {
        const store = makeStore();
        store.getExtendableChannelsData = [channel];
        store.getExtendableChannelsError = true;

        store.reset();

        expect(store.getExtendableChannelsData).toEqual([]);
        expect(store.getExtendableChannelsError).toBe(false);
    });

    it('keeps lease data when only the errors are reset', () => {
        const store = makeStore();
        store.getExtendableChannelsData = [channel];
        store.getExtendableChannelsError = true;

        store.reset(true);

        expect(store.getExtendableChannelsData).toEqual([channel]);
        expect(store.getExtendableChannelsError).toBe(true);
    });

    it('drops a probe reply and timeout that land after reset', async () => {
        const store = makeStore();
        const probe = store.getExtendableChannels();
        const staleId = store.getExtendableChannelsId;

        store.reset();
        await probe;
        store.handleCustomMessages({
            peer: Buffer.from('aa', 'hex').toString('base64'),
            data: Buffer.from(
                JSON.stringify({
                    jsonrpc: '2.0',
                    id: staleId,
                    result: { extendable_channels: [channel] }
                })
            ).toString('base64')
        });
        await jest.advanceTimersByTimeAsync(TIMEOUT_MS);

        expect(store.getExtendableChannelsData).toEqual([]);
        expect(store.getExtendableChannelsError).toBe(false);
    });
});

describe('LSPStore.getExtendableChannels on LDK Node', () => {
    const nativeChannel = {
        shortChannelId: '800000x1x0',
        maxChannelExtensionExpiryBlocks: 0,
        expirationBlock: 852560,
        originalOrder: { id: 'order-1' },
        extensionOrderIds: ['ext-1']
    };
    const normalized = {
        short_channel_id: '800000x1x0',
        max_channel_extension_expiry_blocks: 0,
        expiration_block: 852560,
        original_order: { id: 'order-1' },
        extension_order_ids: ['ext-1']
    };

    beforeEach(() => {
        jest.clearAllMocks();
        jest.mocked(BackendUtils.supportsLSPS7native).mockReturnValue(true);
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.mocked(BackendUtils.supportsLSPS7native).mockReturnValue(false);
        jest.mocked(console.error).mockRestore();
    });

    it('normalizes the channels and clears the error on success', async () => {
        jest.mocked(BackendUtils.lsps7GetExtendableChannels).mockResolvedValue([
            nativeChannel
        ]);
        const store = makeStore('ldk-node');
        store.getExtendableChannelsError = true;

        await store.getExtendableChannels();

        expect(store.getExtendableChannelsData).toEqual([normalized]);
        expect(store.getExtendableChannelsError).toBe(false);
        expect(BackendUtils.sendCustomMessage).not.toHaveBeenCalled();
    });

    it('sets only the lease error when the native call rejects', async () => {
        jest.mocked(BackendUtils.lsps7GetExtendableChannels).mockRejectedValue(
            new Error('Liquidity request timed out')
        );
        const store = makeStore('ldk-node');

        await store.getExtendableChannels();

        expect(store.getExtendableChannelsError).toBe(true);
        expect(store.error).toBe(false);
        expect(store.error_msg).toBe('');
        expect(store.getExtendableChannelsData).toEqual([]);
    });

    it('keeps an error another LSP screen is showing', async () => {
        jest.mocked(BackendUtils.lsps7GetExtendableChannels).mockResolvedValue([
            nativeChannel
        ]);
        const store = makeStore('ldk-node');
        store.error = true;
        store.error_msg = 'order failed';

        await store.getExtendableChannels();

        expect(store.error).toBe(true);
        expect(store.error_msg).toBe('order failed');
    });

    it('leaves an LSPS7 order spinner alone on success', async () => {
        jest.mocked(BackendUtils.lsps7GetExtendableChannels).mockResolvedValue([
            nativeChannel
        ]);
        const store = makeStore('ldk-node');
        store.loadingLSPS7 = true;

        await store.getExtendableChannels();

        expect(store.loadingLSPS7).toBe(true);
    });

    it('leaves an LSPS7 order spinner alone on failure', async () => {
        jest.mocked(BackendUtils.lsps7GetExtendableChannels).mockRejectedValue(
            new Error('Liquidity request timed out')
        );
        const store = makeStore('ldk-node');
        store.loadingLSPS7 = true;

        await store.getExtendableChannels();

        expect(store.loadingLSPS7).toBe(true);
    });

    it('drops a rejection from an older call after a newer success', async () => {
        const older = deferred<any>();
        jest.mocked(BackendUtils.lsps7GetExtendableChannels)
            .mockReturnValueOnce(older.promise)
            .mockResolvedValueOnce([nativeChannel]);
        const store = makeStore('ldk-node');

        const first = store.getExtendableChannels();
        await store.getExtendableChannels();
        older.reject(new Error('Liquidity request timed out'));
        await first;

        expect(store.getExtendableChannelsError).toBe(false);
        expect(store.error).toBe(false);
        expect(store.getExtendableChannelsData).toEqual([normalized]);
    });

    it('drops a native result that lands after reset', async () => {
        const older = deferred<any>();
        jest.mocked(
            BackendUtils.lsps7GetExtendableChannels
        ).mockReturnValueOnce(older.promise);
        const store = makeStore('ldk-node');

        const call = store.getExtendableChannels();
        store.reset();
        older.reject(new Error('Liquidity request timed out'));
        await call;

        expect(store.getExtendableChannelsError).toBe(false);
        expect(store.error).toBe(false);
    });

    it('drops a success from an older call after a newer failure', async () => {
        const older = deferred<any>();
        jest.mocked(BackendUtils.lsps7GetExtendableChannels)
            .mockReturnValueOnce(older.promise)
            .mockRejectedValueOnce(new Error('Liquidity request timed out'));
        const store = makeStore('ldk-node');

        const first = store.getExtendableChannels();
        await store.getExtendableChannels();
        older.resolve([nativeChannel]);
        await first;

        expect(store.getExtendableChannelsError).toBe(true);
        expect(store.getExtendableChannelsData).toEqual([]);
    });
});

describe('LSPStore.initFlowLSP', () => {
    const makeFlowStore = (
        implementation: string,
        enableLSP = true,
        flowLspNotConfigured = false
    ) => {
        const store = new LSPStore(
            { implementation, settings: { enableLSP } } as any,
            { channels: [] } as any,
            {
                nodeInfo: {},
                getNodeInfo: jest.fn(),
                flowLspNotConfigured: jest.fn(() => ({
                    flowLspNotConfigured
                }))
            } as any
        );
        jest.spyOn(store, 'subscribeCustomMessages').mockResolvedValue(
            undefined
        );
        jest.spyOn(store, 'initChannelAcceptor').mockResolvedValue(undefined);
        return store;
    };

    beforeEach(() => {
        jest.clearAllMocks();
        jest.mocked(BackendUtils.supportsFlowLSP).mockReturnValue(true);
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.mocked(console.warn).mockRestore();
    });

    // getLSPInfo is not awaited; let its rejection and catch run
    const settle = () => new Promise((resolve) => setImmediate(resolve));

    it('finishes setup when the LSP cannot be reached (#4779)', async () => {
        jest.mocked(ReactNativeBlobUtil.fetch).mockRejectedValue(
            new Error('connection refused')
        );
        const store = makeFlowStore('ldk-node');

        store.initFlowLSP();
        await settle();

        expect(ReactNativeBlobUtil.fetch).toHaveBeenCalledTimes(1);
        expect(store.flow_error).toBe(true);
        expect(store.flow_error_msg).toBe('stores.LSPStore.connectionError');
        expect(store.subscribeCustomMessages).toHaveBeenCalled();
        expect(store.initChannelAcceptor).toHaveBeenCalled();
    });

    it('handles an error status from the LSP', async () => {
        jest.mocked(ReactNativeBlobUtil.fetch).mockResolvedValue({
            info: () => ({ status: 403 }),
            json: () => ({ message: 'unavailable in your country' }),
            text: () => ''
        } as any);
        const store = makeFlowStore('embedded-lnd');

        store.initFlowLSP();
        await settle();

        expect(store.flow_error).toBe(true);
        expect(store.showLspSettings).toBe(true);
        expect(store.initChannelAcceptor).toHaveBeenCalled();
    });

    it('does not wait for an LSP that never answers', () => {
        const store = makeFlowStore('embedded-lnd');
        jest.spyOn(store, 'getLSPInfo').mockReturnValue(new Promise(() => {}));

        expect(store.initFlowLSP()).toBeUndefined();

        expect(store.subscribeCustomMessages).toHaveBeenCalled();
        expect(store.initChannelAcceptor).toHaveBeenCalled();
    });

    it('fetches LSP info for embedded LND', async () => {
        const store = makeFlowStore('embedded-lnd');
        const getLSPInfo = jest
            .spyOn(store, 'getLSPInfo')
            .mockResolvedValue({});

        store.initFlowLSP();

        expect(getLSPInfo).toHaveBeenCalledTimes(1);
    });

    it('fetches LSP info for remote LND set up for Flow', async () => {
        const store = makeFlowStore('lnd');
        const getLSPInfo = jest
            .spyOn(store, 'getLSPInfo')
            .mockResolvedValue({});

        store.initFlowLSP();

        expect(getLSPInfo).toHaveBeenCalledTimes(1);
    });

    it('skips LSP info for remote LND not set up for Flow', async () => {
        const store = makeFlowStore('lnd', true, true);
        const getLSPInfo = jest.spyOn(store, 'getLSPInfo');

        store.initFlowLSP();

        expect(getLSPInfo).not.toHaveBeenCalled();
        expect(store.subscribeCustomMessages).toHaveBeenCalled();
        expect(store.initChannelAcceptor).toHaveBeenCalled();
    });

    it('skips LSP info for remote LND over Tor', async () => {
        const store = makeFlowStore('lnd');
        (store as any).settingsStore.enableTor = true;
        const getLSPInfo = jest.spyOn(store, 'getLSPInfo');

        store.initFlowLSP();

        expect(getLSPInfo).not.toHaveBeenCalled();
        expect(store.subscribeCustomMessages).toHaveBeenCalled();
        expect(store.initChannelAcceptor).toHaveBeenCalled();
    });

    it('logs a failed custom message subscription or channel acceptor', async () => {
        const store = makeFlowStore('embedded-lnd');
        jest.spyOn(store, 'getLSPInfo').mockResolvedValue({});
        jest.mocked(store.subscribeCustomMessages).mockRejectedValue(
            new Error('sub failed')
        );
        jest.mocked(store.initChannelAcceptor).mockRejectedValue(
            new Error('acceptor failed')
        );
        const error = jest.spyOn(console, 'error').mockImplementation(() => {});

        store.initFlowLSP();
        await settle();

        expect(error).toHaveBeenCalledWith(
            'Failed to subscribe to custom messages:',
            'sub failed'
        );
        expect(error).toHaveBeenCalledWith(
            'Failed to start channel acceptor:',
            'acceptor failed'
        );
        error.mockRestore();
    });

    it('skips LSP info when the LSP is turned off', async () => {
        const store = makeFlowStore('ldk-node', false);
        const getLSPInfo = jest.spyOn(store, 'getLSPInfo');

        store.initFlowLSP();

        expect(getLSPInfo).not.toHaveBeenCalled();
        expect(store.initChannelAcceptor).toHaveBeenCalled();
    });

    it('does nothing on backends without Flow LSP support', async () => {
        jest.mocked(BackendUtils.supportsFlowLSP).mockReturnValue(false);
        const store = makeFlowStore('cln-rest');
        const getLSPInfo = jest.spyOn(store, 'getLSPInfo');

        store.initFlowLSP();

        expect(getLSPInfo).not.toHaveBeenCalled();
        expect(store.subscribeCustomMessages).not.toHaveBeenCalled();
        expect(store.initChannelAcceptor).not.toHaveBeenCalled();
    });
});

describe('LSPStore.getLSPInfo across reset', () => {
    const lspInfo = {
        pubkey: 'old-lsp-pubkey',
        connection_methods: [{ address: '203.0.113.1', port: 9735 }]
    };

    let resolveFetch: (response: any) => void;
    let rejectFetch: (error: any) => void;

    const makeInfoStore = () => {
        const connectPeer = jest.fn().mockResolvedValue(undefined);
        const store = new LSPStore(
            { implementation: 'embedded-lnd', settings: {} } as any,
            { channels: [], connectPeer } as any,
            { nodeInfo: {}, getNodeInfo: jest.fn() } as any
        );
        return { store, connectPeer };
    };

    const okResponse = {
        info: () => ({ status: 200 }),
        json: () => lspInfo,
        text: () => ''
    };

    const settle = () => new Promise((resolve) => setImmediate(resolve));

    beforeEach(() => {
        jest.clearAllMocks();
        jest.mocked(ReactNativeBlobUtil.fetch).mockImplementation(
            () =>
                new Promise((resolve, reject) => {
                    resolveFetch = resolve;
                    rejectFetch = reject;
                }) as any
        );
    });

    it('applies a reply that arrives before reset', async () => {
        const { store, connectPeer } = makeInfoStore();

        const request = store.getLSPInfo();
        resolveFetch(okResponse);
        await expect(request).resolves.toEqual(lspInfo);
        await settle();

        expect(store.info).toEqual(lspInfo);
        expect(connectPeer).toHaveBeenCalledTimes(1);
    });

    it('drops a reply that arrives after reset', async () => {
        const { store, connectPeer } = makeInfoStore();

        const request = store.getLSPInfo();
        store.reset();
        resolveFetch(okResponse);
        await expect(request).rejects.toBeUndefined();
        await settle();

        expect(store.info).toEqual({});
        expect(connectPeer).not.toHaveBeenCalled();
    });

    it('drops a failure that arrives after reset', async () => {
        const { store } = makeInfoStore();

        const request = store.getLSPInfo();
        store.reset();
        rejectFetch(new Error('timed out'));
        await expect(request).rejects.toBeUndefined();

        expect(store.flow_error).toBe(false);
        expect(store.flow_error_msg).toBe('');
        expect(store.showLspSettings).toBe(false);
    });

    it('drops an error status that arrives after reset', async () => {
        const { store } = makeInfoStore();

        const request = store.getLSPInfo();
        store.reset();
        resolveFetch({
            info: () => ({ status: 403 }),
            json: () => ({ message: 'unavailable in your country' }),
            text: () => ''
        });
        await expect(request).rejects.toBeUndefined();

        expect(store.flow_error).toBe(false);
        expect(store.showLspSettings).toBe(false);
    });

    it('keeps a reply when only the errors were reset', async () => {
        const { store, connectPeer } = makeInfoStore();

        const request = store.getLSPInfo();
        store.reset(true);
        resolveFetch(okResponse);
        await expect(request).resolves.toEqual(lspInfo);
        await settle();

        expect(store.info).toEqual(lspInfo);
        expect(connectPeer).toHaveBeenCalledTimes(1);
    });

    it('applies a request made after reset', async () => {
        const { store, connectPeer } = makeInfoStore();

        store.reset();
        const request = store.getLSPInfo();
        resolveFetch(okResponse);
        await expect(request).resolves.toEqual(lspInfo);
        await settle();

        expect(store.info).toEqual(lspInfo);
        expect(connectPeer).toHaveBeenCalledTimes(1);
    });

    describe('overlapping requests', () => {
        let fetches: Array<{
            resolve: (value: any) => void;
            reject: (error: any) => void;
        }>;

        beforeEach(() => {
            fetches = [];
            jest.mocked(ReactNativeBlobUtil.fetch).mockImplementation(
                () =>
                    new Promise((resolve, reject) => {
                        fetches.push({ resolve, reject });
                    }) as any
            );
        });

        it('drops a failure from an older request after a newer success', async () => {
            const { store, connectPeer } = makeInfoStore();

            const older = store.getLSPInfo();
            const newer = store.getLSPInfo();
            fetches[1].resolve(okResponse);
            await expect(newer).resolves.toEqual(lspInfo);
            fetches[0].reject(new Error('timed out'));
            await expect(older).rejects.toBeUndefined();
            await settle();

            expect(store.info).toEqual(lspInfo);
            expect(store.flow_error).toBe(false);
            expect(store.flow_error_msg).toBe('');
            expect(store.showLspSettings).toBe(false);
            expect(connectPeer).toHaveBeenCalledTimes(1);
        });

        it('drops a success from an older request after a newer failure', async () => {
            const { store, connectPeer } = makeInfoStore();

            const older = store.getLSPInfo();
            const newer = store.getLSPInfo();
            fetches[1].resolve({
                info: () => ({ status: 403 }),
                json: () => ({ message: 'unavailable in your country' }),
                text: () => ''
            });
            await expect(newer).rejects.toBeUndefined();
            fetches[0].resolve(okResponse);
            await expect(older).rejects.toBeUndefined();
            await settle();

            expect(store.info).toEqual({});
            expect(store.flow_error).toBe(true);
            expect(store.showLspSettings).toBe(true);
            expect(connectPeer).not.toHaveBeenCalled();
        });
    });
});

describe('LSPStore remote LND sockets', () => {
    class FakeSocket {
        listeners: { [event: string]: Array<() => void> } = {};
        close = jest.fn(() => this.emit('close'));
        addEventListener(event: string, fn: () => void) {
            (this.listeners[event] ||= []).push(fn);
        }
        emit(event: string) {
            (this.listeners[event] || []).forEach((fn) => fn());
        }
    }

    let sockets: FakeSocket[];
    const openSocket = () => {
        const ws = new FakeSocket();
        sockets.push(ws);
        return ws;
    };

    beforeEach(() => {
        jest.clearAllMocks();
        sockets = [];
        jest.mocked(BackendUtils.initChanAcceptor).mockImplementation(
            openSocket as any
        );
        jest.mocked(BackendUtils.subscribeCustomMessages).mockImplementation(
            openSocket as any
        );
    });

    it('keeps one channel acceptor open across fetches', async () => {
        const store = makeStore('lnd');

        await store.initChannelAcceptor();
        await store.initChannelAcceptor();

        expect(BackendUtils.initChanAcceptor).toHaveBeenCalledTimes(1);
        expect(store.channelAcceptor).toBe(sockets[0]);
    });

    it('opens a new channel acceptor after the socket closes', async () => {
        const store = makeStore('lnd');

        await store.initChannelAcceptor();
        sockets[0].emit('close');
        await store.initChannelAcceptor();

        expect(BackendUtils.initChanAcceptor).toHaveBeenCalledTimes(2);
        expect(store.channelAcceptor).toBe(sockets[1]);
    });

    it('ignores a close from a socket that was already replaced', async () => {
        const store = makeStore('lnd');

        await store.initChannelAcceptor();
        sockets[0].emit('error');
        await store.initChannelAcceptor();
        sockets[0].emit('close');

        expect(store.channelAcceptor).toBe(sockets[1]);
    });

    it('gives the acceptor the current LSP pubkey and zeroConfPeers', async () => {
        const store = makeStore('lnd');

        await store.initChannelAcceptor();
        const { getLspPubkey, getZeroConfPeers } = jest.mocked(
            BackendUtils.initChanAcceptor
        ).mock.calls[0][0];

        expect(getLspPubkey()).toBeUndefined();
        store.info = { pubkey: 'lsp' };
        store.settingsStore.settings.zeroConfPeers = ['peer'];
        expect(getLspPubkey()).toBe('lsp');
        expect(getZeroConfPeers()).toEqual(['peer']);
    });

    it('keeps one custom message subscription open across fetches', async () => {
        const store = makeStore('lnd');

        await store.subscribeCustomMessages();
        await store.subscribeCustomMessages();
        expect(BackendUtils.subscribeCustomMessages).toHaveBeenCalledTimes(1);

        sockets[0].emit('error');
        await store.subscribeCustomMessages();
        expect(BackendUtils.subscribeCustomMessages).toHaveBeenCalledTimes(2);
    });

    it('closes both sockets on reset and opens new ones on the next connect', async () => {
        const store = makeStore('lnd');
        await store.initChannelAcceptor();
        await store.subscribeCustomMessages();
        const [acceptor, subscriber] = sockets;

        store.reset();

        expect(acceptor.close).toHaveBeenCalledTimes(1);
        expect(subscriber.close).toHaveBeenCalledTimes(1);
        expect(store.channelAcceptor).toBeUndefined();
        expect(store.customMessagesSubscriber).toBeUndefined();

        await store.initChannelAcceptor();
        await store.subscribeCustomMessages();
        expect(store.channelAcceptor).toBe(sockets[2]);
        expect(store.customMessagesSubscriber).toBe(sockets[3]);
    });

    it('keeps the sockets open on an errors-only reset', async () => {
        const store = makeStore('lnd');
        await store.initChannelAcceptor();
        await store.subscribeCustomMessages();

        store.reset(true);

        expect(sockets[0].close).not.toHaveBeenCalled();
        expect(sockets[1].close).not.toHaveBeenCalled();
        expect(store.channelAcceptor).toBe(sockets[0]);
        expect(store.customMessagesSubscriber).toBe(sockets[1]);
    });
});

describe('LSPStore embedded LND listeners', () => {
    it('removes the custom message listener on reset', async () => {
        const store = makeStore('embedded-lnd');
        await store.subscribeCustomMessages();
        const listener = store.customMessagesSubscriber;

        store.reset();

        expect(listener.remove).toHaveBeenCalledTimes(1);
        expect(store.customMessagesSubscriber).toBeUndefined();
    });

    it('removes the channel acceptor listener when the stream fails to start', async () => {
        jest.clearAllMocks();
        const { channel } = LndMobileInjection as any;
        channel.channelAcceptor.mockRejectedValueOnce(new Error('rpc error'));
        const store = makeStore('embedded-lnd');

        await expect(store.initChannelAcceptor()).rejects.toThrow('rpc error');
        const listener = jest.mocked(LndMobileEventEmitter.addListener).mock
            .results[0].value;
        expect(listener.remove).toHaveBeenCalledTimes(1);
        expect(store.channelAcceptor).toBeNull();

        await store.initChannelAcceptor();
        expect(channel.channelAcceptor).toHaveBeenCalledTimes(2);
        expect(store.channelAcceptor).toBeTruthy();
    });

    it('removes the custom message listener when the subscription fails to start', async () => {
        const { index } = LndMobileInjection as any;
        index.subscribeCustomMessages.mockRejectedValueOnce(
            new Error('rpc error')
        );
        const store = makeStore('embedded-lnd');

        await expect(store.subscribeCustomMessages()).rejects.toThrow(
            'rpc error'
        );
        expect(store.customMessagesSubscriber).toBeNull();

        await store.subscribeCustomMessages();
        expect(store.customMessagesSubscriber).toBeTruthy();
    });
});

// zeroConfFee prices the invoice, bounds the wrapped invoice and is the fee
// shown to the user, so only the latest fee request may write it
describe('LSPStore.getZeroConfFee superseded requests', () => {
    let answers: {
        resolve: (response: any) => void;
        reject: (error: Error) => void;
    }[];

    const quote = (fee_amount_msat: number, id: string) => ({
        info: () => ({ status: 200 }),
        json: () => ({ fee_amount_msat, id })
    });

    beforeEach(() => {
        answers = [];
        jest.mocked(ReactNativeBlobUtil.fetch).mockImplementation(
            () =>
                new Promise((resolve, reject) => {
                    answers.push({ resolve, reject });
                }) as any
        );
    });

    it('ignores a quote that arrives after a newer request', async () => {
        const store = makeStore();
        const first = store.getZeroConfFee(100000000);
        const second = store.getZeroConfFee(100000000);
        answers[1].resolve(quote(2000000, 'second'));
        answers[0].resolve(quote(0, 'first'));

        await expect(second).resolves.toEqual({
            feeSats: 2000,
            feeId: 'second'
        });
        await expect(first).rejects.toBeUndefined();
        expect(store.zeroConfFee).toBe(2000);
        expect(store.feeId).toBe('second');
        expect(store.flow_error).toBe(false);
    });

    it('ignores a quote that arrives after resetFee', async () => {
        const store = makeStore();
        const request = store.getZeroConfFee(100000000);
        store.resetFee();
        answers[0].resolve(quote(1000000, 'first'));

        await expect(request).rejects.toBeUndefined();
        expect(store.zeroConfFee).toBeUndefined();
        expect(store.feeId).toBeUndefined();
    });

    it('still records a quote that arrives after clearFee', async () => {
        // an invoice without the LSP was created in the meantime
        const store = makeStore();
        store.zeroConfFee = 500;
        store.flow_error_msg = 'old error';
        const request = store.getZeroConfFee(100000000);
        store.clearFee();
        expect(store.zeroConfFee).toBeUndefined();
        expect(store.flow_error_msg).toBe('');
        answers[0].resolve(quote(1000000, 'first'));

        await expect(request).resolves.toEqual({
            feeSats: 1000,
            feeId: 'first'
        });
        expect(store.zeroConfFee).toBe(1000);
        expect(store.feeId).toBe('first');
    });

    it('ignores errors from requests that have been replaced', async () => {
        const store = makeStore();
        const rejected = store.getZeroConfFee(100000000);
        const failed = store.getZeroConfFee(100000000);
        const latest = store.getZeroConfFee(100000000);
        answers[2].resolve(quote(10000, 'latest'));
        answers[1].reject(new Error('timeout'));
        answers[0].resolve({
            info: () => ({ status: 500 }),
            json: () => ({ message: 'no' })
        });

        await expect(latest).resolves.toEqual({
            feeSats: 10,
            feeId: 'latest'
        });
        await expect(failed).rejects.toBeUndefined();
        await expect(rejected).rejects.toBeUndefined();
        expect(store.zeroConfFee).toBe(10);
        expect(store.flow_error).toBe(false);
        expect(store.flow_error_msg).toBe('');
    });

    it('rejects a negative quote without storing it', async () => {
        // the Swaps fee box shows any stored zeroConfFee
        const store = makeStore();
        const request = store.getZeroConfFee(100000000);
        answers[0].resolve(quote(-5000, 'negative'));

        await expect(request).rejects.toBeUndefined();
        expect(store.zeroConfFee).toBeUndefined();
        expect(store.feeId).toBeUndefined();
        expect(store.flow_error).toBe(true);
        expect(store.flow_error_msg).toBe(
            'stores.LSPStore.getInfoResponseError'
        );
    });

    it('still records the quote of the latest request', async () => {
        const store = makeStore();
        const request = store.getZeroConfFee(50000000);
        answers[0].resolve(quote(1500000, 'only'));

        await expect(request).resolves.toEqual({
            feeSats: 1500,
            feeId: 'only'
        });
        expect(store.zeroConfFee).toBe(1500);
        expect(store.feeId).toBe('only');
    });
});

describe('LSPStore.getZeroConfInvoice', () => {
    it('sends the fee_id of the quote it is given, not the shared one', async () => {
        const store = makeStore();
        store.feeId = 'later-preview';
        jest.mocked(ReactNativeBlobUtil.fetch).mockReset();
        jest.mocked(ReactNativeBlobUtil.fetch).mockResolvedValue({
            info: () => ({ status: 400 }),
            json: () => ({ message: 'rejected' })
        } as any);

        await expect(
            store.getZeroConfInvoice('lnbc-inner', {
                feeSats: 2000,
                feeId: 'accepted-quote'
            })
        ).rejects.toBeUndefined();

        const body = JSON.parse(
            jest.mocked(ReactNativeBlobUtil.fetch).mock.calls[0][3] as string
        );
        expect(body.fee_id).toBe('accepted-quote');
    });
});
