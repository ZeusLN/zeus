const mockNetworkFetch = jest.fn();
jest.mock('./NetworkUtils', () => ({
    networkFetch: (...args: any[]) => mockNetworkFetch(...args)
}));

jest.mock('./LocaleUtils');

import SwapStatusPoller, { SWAP_STATUS_MAX_FAILURES } from './SwapStatusPoller';

const ENDPOINT = 'https://swaps.example.com/v2';
const INTERVAL = 1000;

const reply = (status: number, body: any) => ({
    info: () => ({ status }),
    json: () => body
});

// Run pending timers and let the awaited fetch and handlers settle
const tick = async (ms: number = 0) => {
    await jest.advanceTimersByTimeAsync(ms);
};

const messages = (onmessage: jest.Mock) =>
    onmessage.mock.calls.map(([event]) => JSON.parse(event.data));

describe('SwapStatusPoller', () => {
    let poller: SwapStatusPoller;
    let onmessage: jest.Mock;

    beforeEach(() => {
        jest.useFakeTimers();
        mockNetworkFetch.mockReset();
        onmessage = jest.fn();
    });

    afterEach(() => {
        poller?.close();
        jest.useRealTimers();
    });

    const start = (headers?: any) => {
        poller = new SwapStatusPoller(ENDPOINT, 'swap1', headers, INTERVAL);
        poller.onmessage = onmessage;
    };

    it('polls the swap status over Tor', async () => {
        mockNetworkFetch.mockResolvedValue(
            reply(200, { status: 'swap.created' })
        );
        const headers = { Referral: 'pro' };
        start(headers);

        await tick();

        expect(mockNetworkFetch).toHaveBeenCalledWith({
            method: 'GET',
            url: `${ENDPOINT}/swap/swap1`,
            headers,
            enableTor: true
        });
    });

    it('opens after handlers are attached', async () => {
        mockNetworkFetch.mockResolvedValue(reply(200, {}));
        start();
        const onopen = jest.fn();
        poller.onopen = onopen;

        await tick();

        expect(onopen).toHaveBeenCalledTimes(1);
    });

    it('replays each status change once, in the WebSocket message shape', async () => {
        const transaction = { id: 'txid', hex: '0200' };
        mockNetworkFetch
            .mockResolvedValueOnce(reply(200, { status: 'swap.created' }))
            .mockResolvedValueOnce(reply(200, { status: 'swap.created' }))
            .mockResolvedValueOnce(
                reply(200, { status: 'transaction.mempool', transaction })
            );
        start();

        await tick();
        await tick(INTERVAL);
        await tick(INTERVAL);

        expect(messages(onmessage)).toEqual([
            {
                event: 'update',
                args: [{ id: 'swap1', status: 'swap.created' }]
            },
            {
                event: 'update',
                args: [
                    {
                        id: 'swap1',
                        status: 'transaction.mempool',
                        transaction
                    }
                ]
            }
        ]);
    });

    it('reports a client error from the server as an update error', async () => {
        mockNetworkFetch.mockResolvedValue(
            reply(404, { error: 'could not find swap' })
        );
        start();

        await tick();

        expect(messages(onmessage)).toEqual([
            {
                event: 'update',
                args: [{ id: 'swap1', error: 'could not find swap' }]
            }
        ]);
    });

    it('keeps polling after a failed request or a server error', async () => {
        mockNetworkFetch
            .mockRejectedValueOnce(new Error('tor circuit failed'))
            .mockResolvedValueOnce(reply(503, { error: 'busy' }))
            .mockResolvedValueOnce(reply(200, { status: 'swap.created' }));
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        start();

        await tick();
        await tick(INTERVAL);
        await tick(INTERVAL);

        expect(mockNetworkFetch).toHaveBeenCalledTimes(3);
        expect(messages(onmessage)).toEqual([
            {
                event: 'update',
                args: [{ id: 'swap1', status: 'swap.created' }]
            }
        ]);
    });

    describe('failed polls', () => {
        const fail = () =>
            mockNetworkFetch.mockRejectedValueOnce(new Error('tor down'));

        beforeEach(() => {
            jest.spyOn(console, 'warn').mockImplementation(() => {});
        });

        // The first call runs the opening poll, later calls the next ones
        let polled = 0;
        const pollTimes = async (n: number) => {
            for (let i = 0; i < n; i++) {
                await tick(polled++ === 0 ? 0 : INTERVAL);
            }
        };

        beforeEach(() => {
            polled = 0;
        });

        it('reports an error once after three in a row, and keeps polling', async () => {
            expect(SWAP_STATUS_MAX_FAILURES).toBe(3);
            mockNetworkFetch.mockRejectedValue(new Error('tor down'));
            start();
            const onerror = jest.fn();
            poller.onerror = onerror;

            await pollTimes(2);
            expect(onerror).not.toHaveBeenCalled();

            await pollTimes(4);
            expect(mockNetworkFetch).toHaveBeenCalledTimes(6);
            expect(onerror).toHaveBeenCalledTimes(1);
            expect(onerror).toHaveBeenCalledWith({
                message: 'views.SwapDetails.statusUnavailable'
            });
        });

        it('counts server errors and non-JSON replies as failures', async () => {
            mockNetworkFetch
                .mockResolvedValueOnce(reply(503, { error: 'busy' }))
                .mockResolvedValueOnce({
                    info: () => ({ status: 502 }),
                    json: () => {
                        throw new SyntaxError('Unexpected token <');
                    }
                })
                .mockResolvedValueOnce(reply(429, {}));
            start();
            const onerror = jest.fn();
            poller.onerror = onerror;

            await pollTimes(3);

            expect(onerror).toHaveBeenCalledTimes(1);
        });

        it('starts the count over after any response', async () => {
            fail();
            fail();
            mockNetworkFetch.mockResolvedValueOnce(
                reply(200, { status: 'swap.created' })
            );
            fail();
            fail();
            mockNetworkFetch.mockResolvedValue(
                reply(200, { status: 'swap.created' })
            );
            start();
            const onerror = jest.fn();
            poller.onerror = onerror;

            await pollTimes(6);

            expect(onerror).not.toHaveBeenCalled();
        });

        it('opens again once a poll gets a response after an error', async () => {
            fail();
            fail();
            fail();
            mockNetworkFetch.mockResolvedValue(
                reply(200, { status: 'swap.created' })
            );
            start();
            const onopen = jest.fn();
            const onerror = jest.fn();
            poller.onopen = onopen;
            poller.onerror = onerror;

            await pollTimes(3);
            expect(onerror).toHaveBeenCalledTimes(1);
            expect(onopen).toHaveBeenCalledTimes(1);

            await pollTimes(3);
            // only the first response after the error reopens
            expect(onopen).toHaveBeenCalledTimes(2);
            expect(messages(onmessage)).toEqual([
                {
                    event: 'update',
                    args: [{ id: 'swap1', status: 'swap.created' }]
                }
            ]);
        });

        it('reports a second outage after recovering', async () => {
            fail();
            fail();
            fail();
            mockNetworkFetch.mockResolvedValueOnce(reply(200, {}));
            fail();
            fail();
            fail();
            mockNetworkFetch.mockResolvedValue(reply(200, {}));
            start();
            const onerror = jest.fn();
            poller.onerror = onerror;

            await pollTimes(7);

            expect(onerror).toHaveBeenCalledTimes(2);
        });

        it('does not report after being closed', async () => {
            mockNetworkFetch.mockRejectedValue(new Error('tor down'));
            start();
            const onerror = jest.fn();
            poller.onerror = onerror;

            await pollTimes(2);
            let rejectLast: (e: Error) => void = () => {};
            mockNetworkFetch.mockReturnValueOnce(
                new Promise((_resolve, reject) => {
                    rejectLast = reject;
                })
            );
            await tick(INTERVAL);
            poller.close();
            rejectLast(new Error('tor down'));
            await tick();

            expect(onerror).not.toHaveBeenCalled();
        });
    });

    it('stops polling once closed', async () => {
        mockNetworkFetch.mockResolvedValue(
            reply(200, { status: 'swap.created' })
        );
        start();
        const onclose = jest.fn();
        poller.onclose = onclose;

        await tick();
        poller.close();
        poller.close();
        await tick(INTERVAL * 5);

        expect(mockNetworkFetch).toHaveBeenCalledTimes(1);
        expect(onclose).toHaveBeenCalledTimes(1);
    });

    it('stops polling when a handler closes it', async () => {
        mockNetworkFetch.mockResolvedValue(
            reply(200, { status: 'invoice.settled' })
        );
        start();
        onmessage.mockImplementation(() => poller.close());

        await tick();
        await tick(INTERVAL * 5);

        expect(mockNetworkFetch).toHaveBeenCalledTimes(1);
    });

    it('never fetches if closed before opening', async () => {
        start();
        poller.close();

        await tick(INTERVAL * 5);

        expect(mockNetworkFetch).not.toHaveBeenCalled();
    });
});
