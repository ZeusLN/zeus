import { runWhenIdle } from './SchedulingUtils';

const globalScope = global as any;

const flushMicrotasks = () =>
    new Promise<void>((resolve) => setImmediate(resolve));

describe('SchedulingUtils', () => {
    const originalRequestIdleCallback = globalScope.requestIdleCallback;
    const originalCancelIdleCallback = globalScope.cancelIdleCallback;

    afterEach(() => {
        globalScope.requestIdleCallback = originalRequestIdleCallback;
        globalScope.cancelIdleCallback = originalCancelIdleCallback;
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    describe('runWhenIdle with an idle scheduler', () => {
        it('defers the task to the idle queue', () => {
            const requestIdle = jest.fn();
            globalScope.requestIdleCallback = requestIdle;
            const task = jest.fn();

            runWhenIdle(task, 500);

            expect(task).not.toHaveBeenCalled();
            expect(requestIdle).toHaveBeenCalledTimes(1);

            requestIdle.mock.calls[0][0]();

            expect(task).toHaveBeenCalledTimes(1);
        });

        it('passes the caller timeout as a backstop', () => {
            const requestIdle = jest.fn();
            globalScope.requestIdleCallback = requestIdle;

            runWhenIdle(jest.fn(), 500);

            expect(requestIdle.mock.calls[0][1]).toEqual({ timeout: 500 });
        });

        it('applies a default timeout when none is given', () => {
            const requestIdle = jest.fn();
            globalScope.requestIdleCallback = requestIdle;

            runWhenIdle(jest.fn());

            expect(requestIdle.mock.calls[0][1]).toEqual({ timeout: 2000 });
        });

        it('cancels a pending task and hands the handle back', () => {
            const handle = { nativeHandle: true };
            const requestIdle = jest.fn().mockReturnValue(handle);
            const cancelIdle = jest.fn();
            globalScope.requestIdleCallback = requestIdle;
            globalScope.cancelIdleCallback = cancelIdle;
            const task = jest.fn();

            const cancel = runWhenIdle(task);
            cancel();

            expect(cancelIdle).toHaveBeenCalledWith(handle);

            // Belt and braces: a callback that fires anyway must not run the
            // task, since cancellation is not guaranteed to be synchronous.
            requestIdle.mock.calls[0][0]();

            expect(task).not.toHaveBeenCalled();
        });

        it('is a no-op when cancelled after the task has run', () => {
            const requestIdle = jest.fn().mockReturnValue({});
            const cancelIdle = jest.fn();
            globalScope.requestIdleCallback = requestIdle;
            globalScope.cancelIdleCallback = cancelIdle;
            const task = jest.fn();

            const cancel = runWhenIdle(task);
            requestIdle.mock.calls[0][0]();
            cancel();

            expect(task).toHaveBeenCalledTimes(1);
            expect(cancelIdle).not.toHaveBeenCalled();
        });
    });

    describe('runWhenIdle without an idle scheduler', () => {
        it('falls back to a timer when requestIdleCallback is missing', () => {
            jest.useFakeTimers();
            delete globalScope.requestIdleCallback;
            const task = jest.fn();

            runWhenIdle(task);

            expect(task).not.toHaveBeenCalled();

            jest.runAllTimers();

            expect(task).toHaveBeenCalledTimes(1);
        });

        it('falls back to a timer when requestIdleCallback throws', () => {
            jest.useFakeTimers();
            globalScope.requestIdleCallback = jest.fn(() => {
                throw new Error(
                    'requestIdleCallback is not supported in legacy runtime scheduler'
                );
            });
            const task = jest.fn();

            runWhenIdle(task);
            jest.runAllTimers();

            expect(task).toHaveBeenCalledTimes(1);
        });

        it('does not hold the task back for the caller timeout', () => {
            // The timeout is a deadline for the idle scheduler, not a delay.
            // With no scheduler to wait on, the fallback runs on the next
            // macrotask rather than at the deadline.
            jest.useFakeTimers();
            delete globalScope.requestIdleCallback;
            const task = jest.fn();

            runWhenIdle(task, 5000);
            jest.advanceTimersByTime(0);

            expect(task).toHaveBeenCalledTimes(1);
        });

        it('cancels a pending timer', () => {
            jest.useFakeTimers();
            delete globalScope.requestIdleCallback;
            const task = jest.fn();

            runWhenIdle(task)();
            jest.runAllTimers();

            expect(task).not.toHaveBeenCalled();
        });
    });

    describe('runWhenIdle error handling', () => {
        it('logs a rejected task instead of leaving it unhandled', async () => {
            const consoleError = jest
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            const requestIdle = jest.fn();
            globalScope.requestIdleCallback = requestIdle;
            const error = new Error('sweep failed');

            runWhenIdle(async () => {
                throw error;
            });
            requestIdle.mock.calls[0][0]();
            await flushMicrotasks();

            expect(consoleError).toHaveBeenCalledWith(
                'runWhenIdle: deferred task failed:',
                error
            );
        });

        it('logs a task that throws synchronously', async () => {
            const consoleError = jest
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            const requestIdle = jest.fn();
            globalScope.requestIdleCallback = requestIdle;
            const error = new Error('boom');

            runWhenIdle(() => {
                throw error;
            });

            expect(() => requestIdle.mock.calls[0][0]()).not.toThrow();

            await flushMicrotasks();

            expect(consoleError).toHaveBeenCalledWith(
                'runWhenIdle: deferred task failed:',
                error
            );
        });
    });
});
