const mockSendStreamCommand = jest.fn();
jest.mock('./utils', () => ({
    sendCommand: jest.fn(),
    sendStreamCommand: (...args: any[]) => mockSendStreamCommand(...args),
    // test events carry the decoded payment as JSON
    decodeStreamResult: ({ base64Result }: { base64Result: string }) =>
        JSON.parse(base64Result)
}));
jest.mock('./channel', () => ({
    getChanInfo: jest.fn(),
    listPrivateChannels: jest.fn()
}));
jest.mock('../utils/LocaleUtils', () => ({
    localeString: (s: string) => s
}));

const mockListeners: Array<{
    name: string;
    handler: (event: any) => void;
    removed: boolean;
}> = [];
jest.mock('../utils/LndMobileUtils', () => ({
    LndMobileEventEmitter: {
        addListener: (name: string, handler: (event: any) => void) => {
            const listener = { name, handler, removed: false };
            mockListeners.push(listener);
            return {
                remove: () => {
                    listener.removed = true;
                }
            };
        }
    },
    // reduced to the two outcomes the payment listeners distinguish: end of
    // stream and an error
    checkLndStreamErrorResponse: (_name: string, event: any) => {
        if (!event.error_code) return null;
        return event.error_desc === 'EOF' ? 'EOF' : new Error(event.error_desc);
    }
}));

import { sendKeysendPaymentV2, sendPaymentV2Sync } from './index';

const EVENT = 'RouterSendPaymentV2';
const DEST = '02' + 'aa'.repeat(32);

// the request id the nth payment was started with
const requestIdOf = (n: number) =>
    mockSendStreamCommand.mock.calls[n][0].requestId;
const emit = (event: any, request_id: string) =>
    mockListeners
        .filter((l) => l.name === EVENT && !l.removed)
        .forEach((l) => l.handler({ ...event, request_id }));
const payment = (data: any) => ({ data: JSON.stringify(data) });

const track = (promise: Promise<any>) => {
    const state: { settled: boolean; result?: any; error?: any } = {
        settled: false
    };
    promise.then(
        (result) => {
            state.settled = true;
            state.result = result;
        },
        (error) => {
            state.settled = true;
            state.error = error;
        }
    );
    return state;
};
const flush = () => jest.advanceTimersByTimeAsync(0);

beforeEach(() => {
    jest.useFakeTimers();
    mockListeners.length = 0;
    mockSendStreamCommand.mockReset();
    mockSendStreamCommand.mockResolvedValue('done');
});

afterEach(() => {
    jest.useRealTimers();
});

describe('sendPaymentV2Sync', () => {
    it('starts the stream with a request id', async () => {
        track(
            sendPaymentV2Sync({ payment_request: 'lnbc1', timeout_seconds: 60 })
        );
        await flush();

        expect(mockSendStreamCommand).toHaveBeenCalledWith(
            expect.objectContaining({
                method: EVENT,
                requestId: expect.any(String)
            }),
            false
        );
    });

    it("ignores another payment's error and resolves with its own result", async () => {
        const a = track(
            sendPaymentV2Sync({
                payment_request: 'lnbc1a',
                timeout_seconds: 60
            })
        );
        const b = track(
            sendPaymentV2Sync({
                payment_request: 'lnbc1b',
                timeout_seconds: 60
            })
        );
        await flush();
        expect(requestIdOf(0)).not.toEqual(requestIdOf(1));

        emit({ error_code: 'Error', error_desc: 'no route' }, requestIdOf(1));
        await flush();

        expect(b.error?.message).toEqual('no route');
        expect(a.settled).toBe(false);

        emit(payment({ status: 'SUCCEEDED' }), requestIdOf(0));
        await flush();

        expect(a.result).toEqual({ status: 'SUCCEEDED' });
    });
});

describe('sendKeysendPaymentV2', () => {
    it("ignores another payment's error and resolves with its own result", async () => {
        const a = track(sendKeysendPaymentV2({ dest: DEST, amt: 1 }));
        const b = track(sendKeysendPaymentV2({ dest: DEST, amt: 2 }));
        await flush();
        expect(requestIdOf(0)).not.toEqual(requestIdOf(1));

        emit({ error_code: 'Error', error_desc: 'no route' }, requestIdOf(1));
        await flush();

        expect(b.error?.message).toEqual('no route');
        expect(a.settled).toBe(false);

        emit(payment({ status: 'SUCCEEDED' }), requestIdOf(0));
        await flush();

        expect(a.result).toEqual({ status: 'SUCCEEDED' });
    });
});
