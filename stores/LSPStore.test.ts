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
