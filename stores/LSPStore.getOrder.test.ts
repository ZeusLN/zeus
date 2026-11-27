jest.mock('react-native-blob-util', () => ({ fetch: jest.fn() }));
jest.mock('../lndmobile/LndMobileInjection', () => ({
    __esModule: true,
    default: { index: {}, channel: {} }
}));
jest.mock('../storage', () => ({
    __esModule: true,
    default: { getItem: jest.fn(), setItem: jest.fn() }
}));
jest.mock('../utils/LndMobileUtils', () => ({ LndMobileEventEmitter: {} }));
jest.mock('../utils/ClientInfoUtils', () => ({ getClientInfo: jest.fn() }));
jest.mock('../utils/BackendUtils', () => ({
    supportsLSPS1rest: () => true,
    supportsLSPScustomMessage: () => true,
    supportsLSPS7native: jest.fn(() => false),
    checkLsps1OrderStatus: jest.fn(),
    lsps7CheckOrderStatus: jest.fn()
}));
jest.mock('../utils/LocaleUtils');
jest.mock('./SettingsStore', () => ({
    __esModule: true,
    default: class {},
    getLspConfigForNetwork: () => ({ lsps1Pubkey: 'aa' })
}));

import ReactNativeBlobUtil from 'react-native-blob-util';

import LSPStore from './LSPStore';
import BackendUtils from '../utils/BackendUtils';
import { LSPService } from '../models/LSP';

const makeStore = () =>
    new LSPStore(
        { implementation: 'lnd', settings: {} } as any,
        { channels: [] } as any,
        { nodeInfo: {}, getNodeInfo: jest.fn() } as any
    );

const deferred = () => {
    let resolve!: (value: any) => void;
    let reject!: (reason: any) => void;
    const promise = new Promise<any>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
};

// The get_order paths that are not answered over custom messages. Each
// waits on one backend call, which the tests hold open and settle late.
const PATHS = [
    {
        name: 'LSPS1 REST',
        backendCall: () => jest.mocked(ReactNativeBlobUtil.fetch) as jest.Mock,
        request: (store: LSPStore, orderId: string) =>
            store.lsps1GetOrderREST(orderId, 'https://lsp.example.com'),
        answer: (orderId: string) => ({
            data: JSON.stringify({ order_id: orderId, order_state: 'CREATED' })
        }),
        slot: 'getOrderResponse',
        loading: 'loadingLSPS1',
        reset: 'resetLSPS1Data'
    },
    {
        name: 'LSPS1 on LDK Node',
        backendCall: () =>
            jest.mocked(BackendUtils.checkLsps1OrderStatus) as jest.Mock,
        request: (store: LSPStore, orderId: string) =>
            store.lsps1GetOrderNative(orderId),
        answer: (orderId: string) => ({ order_id: orderId, payment: {} }),
        slot: 'getOrderResponse',
        loading: 'loadingLSPS1',
        reset: 'resetLSPS1Data'
    },
    {
        name: 'LSPS7 on LDK Node',
        backendCall: () =>
            jest.mocked(BackendUtils.lsps7CheckOrderStatus) as jest.Mock,
        request: (store: LSPStore, orderId: string) =>
            store.lsps7GetOrderCustomMessage(orderId, 'aa'),
        answer: (orderId: string) => ({
            order_id: orderId,
            order_state: 'CREATED'
        }),
        slot: 'getExtensionOrderResponse',
        loading: 'loadingLSPS7',
        reset: 'resetLSPS7Data'
    }
] as const;

describe.each(PATHS)(
    'LSPStore get_order: $name',
    ({ name, backendCall, request, answer, slot, loading, reset }) => {
        const storedOrderId = (store: LSPStore) =>
            (store[slot]?.result || store[slot])?.order_id;
        const replyOrderId = (reply: any) => (reply?.result || reply)?.order_id;

        // holds the next backend calls open, in the order they are made
        const holdRequests = (count: number) => {
            const held = Array.from({ length: count }, deferred);
            held.forEach(({ promise }) =>
                backendCall().mockReturnValueOnce(promise)
            );
            return held;
        };

        beforeEach(() => {
            jest.clearAllMocks();
            jest.mocked(BackendUtils.supportsLSPS7native).mockReturnValue(
                name === 'LSPS7 on LDK Node'
            );
            jest.spyOn(console, 'log').mockImplementation(() => {});
            jest.spyOn(console, 'error').mockImplementation(() => {});
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        it('stores the reply to the current request', async () => {
            const [held] = holdRequests(1);
            const store = makeStore();

            const done = request(store, 'order-a');
            expect(store[loading]).toBe(true);
            held.resolve(answer('order-a'));
            const reply = await done;

            expect(replyOrderId(reply)).toBe('order-a');
            expect(storedOrderId(store)).toBe('order-a');
            expect(store[loading]).toBe(false);
            expect(store.error).toBe(false);
        });

        it('reports a failure of the current request', async () => {
            const [held] = holdRequests(1);
            const store = makeStore();

            const done = request(store, 'order-a');
            held.reject(new Error('lsp unreachable'));
            const reply = await done;

            expect(reply).toBeUndefined();
            expect(store.error).toBe(true);
            expect(store.error_msg).toBe('lsp unreachable');
            expect(store[loading]).toBe(false);
            expect(store[slot]).toEqual({});
        });

        it(`${reset} drops a reply that arrives later`, async () => {
            const [held] = holdRequests(1);
            const store = makeStore();

            const done = request(store, 'order-a');
            store[reset]();
            // the next screen's own request is waiting
            store[loading] = true;
            held.resolve(answer('order-a'));
            await done;

            expect(store[slot]).toEqual({});
            expect(store[loading]).toBe(true);
        });

        it(`${reset} drops a failure that arrives later`, async () => {
            const [held] = holdRequests(1);
            const store = makeStore();

            const done = request(store, 'order-a');
            store[reset]();
            store[loading] = true;
            held.reject(new Error('lsp unreachable'));
            await done;

            expect(store.error).toBe(false);
            expect(store.error_msg).toBe('');
            expect(store[loading]).toBe(true);
        });

        it('keeps the reply to an older request out of the slot while a newer one waits, and returns it to its caller', async () => {
            const [first, second] = holdRequests(2);
            const store = makeStore();

            const firstDone = request(store, 'order-a');
            const secondDone = request(store, 'order-b');
            first.resolve(answer('order-a'));
            const firstReply = await firstDone;

            // the caller that waits on order-a, such as the payment-await
            // or free-order poll, still gets its answer
            expect(replyOrderId(firstReply)).toBe('order-a');
            expect(store[slot]).toEqual({});
            expect(store[loading]).toBe(true);

            second.resolve(answer('order-b'));
            await secondDone;

            expect(storedOrderId(store)).toBe('order-b');
            expect(store[loading]).toBe(false);
        });

        it('drops the failure of an older request while a newer one waits', async () => {
            const [first, second] = holdRequests(2);
            const store = makeStore();

            const firstDone = request(store, 'order-a');
            const secondDone = request(store, 'order-b');
            first.reject(new Error('lsp unreachable'));
            const firstReply = await firstDone;

            expect(firstReply).toBeUndefined();
            expect(store.error).toBe(false);
            expect(store.error_msg).toBe('');
            expect(store[loading]).toBe(true);

            second.resolve(answer('order-b'));
            await secondDone;

            expect(storedOrderId(store)).toBe('order-b');
            expect(store.error).toBe(false);
        });

        it('keeps the newer reply when the older request is answered after it', async () => {
            const [first, second] = holdRequests(2);
            const store = makeStore();

            const firstDone = request(store, 'order-a');
            const secondDone = request(store, 'order-b');
            second.resolve(answer('order-b'));
            await secondDone;
            first.resolve(answer('order-a'));
            const firstReply = await firstDone;

            expect(replyOrderId(firstReply)).toBe('order-a');
            expect(storedOrderId(store)).toBe('order-b');
        });
    }
);

it('LSPS1 REST: returns nothing for an error reply', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.mocked(ReactNativeBlobUtil.fetch as jest.Mock).mockResolvedValueOnce({
        data: JSON.stringify({ error: true, message: 'unknown order' })
    });
    const store = makeStore();

    const reply = await store.lsps1GetOrderREST(
        'order-a',
        'https://lsp.example.com'
    );

    expect(reply).toBeUndefined();
    expect(store.error).toBe(true);
    expect(store.error_msg).toBe('unknown order');
    jest.restoreAllMocks();
});

// The free-order poll runs while the user opens and pays other orders, so
// another get_order can start while its own request waits.
const FREE_POLL_PATHS = [
    {
        name: 'LSPS1 REST',
        service: LSPService.LSPS1,
        backendCall: () => jest.mocked(ReactNativeBlobUtil.fetch) as jest.Mock,
        request: (store: LSPStore, orderId: string) =>
            store.lsps1GetOrderREST(orderId, 'https://lsp.example.com'),
        answer: (orderId: string, orderState: string) => ({
            data: JSON.stringify({ order_id: orderId, order_state: orderState })
        }),
        created: 'createOrderResponse'
    },
    {
        name: 'LSPS7 on LDK Node',
        service: LSPService.LSPS7,
        backendCall: () =>
            jest.mocked(BackendUtils.lsps7CheckOrderStatus) as jest.Mock,
        request: (store: LSPStore, orderId: string) =>
            store.lsps7GetOrderCustomMessage(orderId, 'aa'),
        answer: (orderId: string, orderState: string) => ({
            order_id: orderId,
            order_state: orderState
        }),
        created: 'createExtensionOrderResponse'
    }
] as const;

describe.each(FREE_POLL_PATHS)(
    'LSPStore free-order poll: $name',
    ({ name, service, backendCall, request, answer, created }) => {
        beforeEach(() => {
            jest.clearAllMocks();
            jest.mocked(BackendUtils.supportsLSPS7native).mockReturnValue(
                name === 'LSPS7 on LDK Node'
            );
            jest.spyOn(console, 'log').mockImplementation(() => {});
            jest.spyOn(console, 'error').mockImplementation(() => {});
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        it('finishes its order when another get_order starts while its request waits', async () => {
            const held = [deferred(), deferred()];
            held.forEach(({ promise }) =>
                backendCall().mockReturnValueOnce(promise)
            );
            const store = makeStore();
            jest.spyOn(store as any, 'getLSPS1Rest').mockReturnValue(
                'https://lsp.example.com'
            );
            const updateOrderInStorage = jest
                .spyOn(store, 'updateOrderInStorage')
                .mockImplementation(() => {});

            store.startFreeOrderStatusPolling('order-free', service);
            // the payment-await screen polls another order
            const otherDone = request(store, 'order-paid');
            held[0].resolve(answer('order-free', 'COMPLETED'));
            await new Promise((resolve) => setImmediate(resolve));

            const result = store[created]?.result || store[created];
            expect(result?.order_id).toBe('order-free');
            expect(result?.order_state).toBe('COMPLETED');
            expect(updateOrderInStorage).toHaveBeenCalledTimes(1);

            held[1].resolve(answer('order-paid', 'CREATED'));
            await otherDone;
            store.stopFreeOrderStatusPolling();
        });
    }
);
