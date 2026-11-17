jest.mock('@react-native-clipboard/clipboard', () => ({
    __esModule: true,
    default: { setString: jest.fn(), getString: jest.fn() }
}));

import { AppState, Platform } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';

import { copySensitive, SENSITIVE_CLIPBOARD_CLEAR_MS } from './ClipboardUtils';

const clipboard = Clipboard as unknown as {
    setString: jest.Mock;
    getString: jest.Mock;
};

// Simulates the system clipboard behind the mocked module
let systemClipboard = '';

const setAppState = (state: string) =>
    Object.defineProperty(AppState, 'currentState', {
        value: state,
        configurable: true
    });

// Lets the async read inside the timer callback settle
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

describe('copySensitive', () => {
    let handlers: { [type: string]: (state?: string) => void };
    let remove: jest.Mock;

    beforeEach(() => {
        jest.useFakeTimers({ doNotFake: ['setImmediate'] });
        jest.clearAllMocks();
        systemClipboard = '';
        clipboard.setString.mockImplementation((value: string) => {
            systemClipboard = value;
        });
        clipboard.getString.mockImplementation(async () => systemClipboard);
        setAppState('active');
        handlers = {};
        remove = jest.fn();
        jest.spyOn(AppState, 'addEventListener').mockImplementation(
            (type: any, handler: any) => {
                handlers[type] = handler;
                return {
                    remove: () => {
                        remove();
                        if (handlers[type] === handler) delete handlers[type];
                    }
                } as any;
            }
        );
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    it('copies the value', () => {
        copySensitive('seed words');

        expect(clipboard.setString).toHaveBeenCalledWith('seed words');
        expect(systemClipboard).toBe('seed words');
    });

    it('clears the clipboard after the default timeout', async () => {
        copySensitive('seed words');

        jest.advanceTimersByTime(SENSITIVE_CLIPBOARD_CLEAR_MS - 1);
        await flush();
        expect(systemClipboard).toBe('seed words');

        jest.advanceTimersByTime(1);
        await flush();
        expect(systemClipboard).toBe('');
    });

    it('uses a custom timeout', async () => {
        copySensitive('seed words', 1000);

        jest.advanceTimersByTime(1000);
        await flush();
        expect(systemClipboard).toBe('');
    });

    it('does not clear text the user copied afterwards', async () => {
        copySensitive('seed words');
        systemClipboard = 'an address';

        jest.advanceTimersByTime(SENSITIVE_CLIPBOARD_CLEAR_MS);
        await flush();

        expect(systemClipboard).toBe('an address');
        expect(clipboard.setString).toHaveBeenCalledTimes(1);
    });

    it('only clears the most recent copy', async () => {
        copySensitive('first', 1000);
        jest.advanceTimersByTime(500);
        copySensitive('second', 1000);

        jest.advanceTimersByTime(500);
        await flush();
        expect(systemClipboard).toBe('second');

        jest.advanceTimersByTime(500);
        await flush();
        expect(systemClipboard).toBe('');
    });

    it('leaves the clipboard alone when it cannot be read', async () => {
        clipboard.getString.mockRejectedValue(new Error('denied'));
        copySensitive('seed words', 1000);

        jest.advanceTimersByTime(1000);
        await flush();

        expect(systemClipboard).toBe('seed words');
    });

    it('waits until the app is active again when the timer fires in the background', async () => {
        copySensitive('seed words', 1000);
        setAppState('background');

        jest.advanceTimersByTime(1000);
        await flush();
        expect(clipboard.getString).not.toHaveBeenCalled();
        expect(systemClipboard).toBe('seed words');

        handlers.change('inactive');
        await flush();
        expect(systemClipboard).toBe('seed words');

        setAppState('active');
        handlers.change('active');
        await flush();
        expect(systemClipboard).toBe('');
        expect(remove).toHaveBeenCalled();
    });

    it('drops a pending background check when a new secret is copied', async () => {
        copySensitive('first', 1000);
        setAppState('background');
        jest.advanceTimersByTime(1000);
        expect(handlers.change).toBeDefined();

        setAppState('active');
        copySensitive('second', 1000);
        expect(remove).toHaveBeenCalled();
    });

    it('does not retry on iOS when the clipboard reads empty', async () => {
        copySensitive('seed words', 1000);
        systemClipboard = '';

        jest.advanceTimersByTime(1000);
        await flush();

        expect(AppState.addEventListener).not.toHaveBeenCalled();
    });

    describe('when a newer secret is copied during the clipboard read', () => {
        let resolveRead: (value: string) => void;

        // The next read stays pending until the test resolves it
        const deferNextRead = () => {
            clipboard.getString.mockReturnValueOnce(
                new Promise<string>((resolve) => (resolveRead = resolve))
            );
        };

        it('does not clear the newer secret when the read returns the older one', async () => {
            deferNextRead();
            copySensitive('first', 1000);
            jest.advanceTimersByTime(1000);
            expect(clipboard.getString).toHaveBeenCalledTimes(1);

            copySensitive('second', 1000);
            resolveRead('first');
            await flush();

            expect(clipboard.setString).not.toHaveBeenCalledWith('');
            expect(systemClipboard).toBe('second');
        });

        it('does not clear the same secret copied again before its own timeout', async () => {
            deferNextRead();
            copySensitive('seed words', 1000);
            jest.advanceTimersByTime(1000);
            expect(clipboard.getString).toHaveBeenCalledTimes(1);

            copySensitive('seed words', 1000);
            resolveRead('seed words');
            await flush();

            expect(clipboard.setString).not.toHaveBeenCalledWith('');
            expect(systemClipboard).toBe('seed words');
        });

        it('does not clear the newer secret when the read started on resume', async () => {
            copySensitive('first', 1000);
            setAppState('background');
            jest.advanceTimersByTime(1000);
            expect(clipboard.getString).not.toHaveBeenCalled();

            deferNextRead();
            setAppState('active');
            handlers.change('active');
            expect(clipboard.getString).toHaveBeenCalledTimes(1);

            copySensitive('second', 1000);
            resolveRead('first');
            await flush();

            expect(clipboard.setString).not.toHaveBeenCalledWith('');
            expect(systemClipboard).toBe('second');
        });

        it('does not clear the newer secret when the read started on focus on Android', async () => {
            jest.replaceProperty(Platform, 'OS', 'android');
            copySensitive('first', 1000);
            setAppState('background');
            jest.advanceTimersByTime(1000);
            expect(clipboard.getString).not.toHaveBeenCalled();

            deferNextRead();
            setAppState('active');
            handlers.focus();
            expect(clipboard.getString).toHaveBeenCalledTimes(1);

            copySensitive('second', 1000);
            resolveRead('first');
            await flush();

            expect(clipboard.setString).not.toHaveBeenCalledWith('');
            expect(systemClipboard).toBe('second');
        });

        it('still clears the newer secret after its own timeout', async () => {
            deferNextRead();
            copySensitive('first', 1000);
            jest.advanceTimersByTime(1000);

            copySensitive('second', 1000);
            resolveRead('first');
            await flush();

            jest.advanceTimersByTime(999);
            await flush();
            expect(systemClipboard).toBe('second');

            jest.advanceTimersByTime(1);
            await flush();
            expect(systemClipboard).toBe('');
            expect(clipboard.getString).toHaveBeenCalledTimes(2);
        });
    });

    describe('on Android', () => {
        beforeEach(() => {
            jest.replaceProperty(Platform, 'OS', 'android');
        });

        it('waits for focus, not active, when the timer fires in the background', async () => {
            copySensitive('seed words', 1000);
            setAppState('background');

            jest.advanceTimersByTime(1000);
            await flush();
            expect(handlers.change).toBeUndefined();
            expect(clipboard.getString).not.toHaveBeenCalled();

            setAppState('active');
            handlers.focus();
            await flush();
            expect(systemClipboard).toBe('');
            expect(remove).toHaveBeenCalled();
        });

        it('retries on the next focus when the read is refused while active', async () => {
            // the app is active but does not have window focus
            clipboard.getString.mockResolvedValueOnce('');
            copySensitive('seed words', 1000);

            jest.advanceTimersByTime(1000);
            await flush();
            expect(systemClipboard).toBe('seed words');
            expect(handlers.focus).toBeDefined();

            handlers.focus();
            await flush();
            expect(systemClipboard).toBe('');
            expect(remove).toHaveBeenCalled();
        });

        it('only retries once', async () => {
            clipboard.getString.mockResolvedValue('');
            copySensitive('seed words', 1000);

            jest.advanceTimersByTime(1000);
            await flush();
            handlers.focus();
            await flush();

            expect(clipboard.getString).toHaveBeenCalledTimes(2);
            expect(AppState.addEventListener).toHaveBeenCalledTimes(1);
            expect(systemClipboard).toBe('seed words');
        });

        it('does not retry when a newer secret was copied during the read', async () => {
            let resolveRead: (value: string) => void = () => {};
            clipboard.getString.mockReturnValueOnce(
                new Promise<string>((resolve) => (resolveRead = resolve))
            );
            copySensitive('first', 1000);
            jest.advanceTimersByTime(1000);

            copySensitive('second', 1000);
            resolveRead('');
            await flush();

            expect(AppState.addEventListener).toHaveBeenCalledTimes(1);
            expect(remove).toHaveBeenCalledTimes(1);
            expect(handlers.focus).toBeUndefined();
        });

        describe('when the first read is still in progress', () => {
            let resolveRead: (value: string) => void;

            beforeEach(() => {
                clipboard.getString.mockReturnValueOnce(
                    new Promise<string>((resolve) => (resolveRead = resolve))
                );
            });

            it('clears on focus that returns before the refused read ends', async () => {
                copySensitive('seed words', 1000);
                jest.advanceTimersByTime(1000);
                expect(clipboard.getString).toHaveBeenCalledTimes(1);

                // focus returns while the first read is still pending
                handlers.focus();
                resolveRead('');
                await flush();

                expect(clipboard.getString).toHaveBeenCalledTimes(2);
                expect(clipboard.setString).toHaveBeenCalledWith('');
                expect(systemClipboard).toBe('');
                expect(AppState.addEventListener).toHaveBeenCalledTimes(1);
                expect(handlers.focus).toBeUndefined();
            });

            it('removes the focus listener when the read was allowed', async () => {
                copySensitive('seed words', 1000);
                jest.advanceTimersByTime(1000);
                expect(handlers.focus).toBeDefined();

                resolveRead('seed words');
                await flush();

                expect(systemClipboard).toBe('');
                expect(remove).toHaveBeenCalledTimes(1);
                expect(handlers.focus).toBeUndefined();
                expect(clipboard.getString).toHaveBeenCalledTimes(1);
            });

            it('removes the focus listener when the user copied other text', async () => {
                copySensitive('seed words', 1000);
                jest.advanceTimersByTime(1000);

                resolveRead('an address');
                await flush();

                expect(clipboard.setString).not.toHaveBeenCalledWith('');
                expect(handlers.focus).toBeUndefined();
            });

            it('keeps the timer of a newer copy made during the read', async () => {
                copySensitive('first', 1000);
                jest.advanceTimersByTime(1000);

                copySensitive('second', 1000);
                resolveRead('second');
                await flush();
                expect(systemClipboard).toBe('second');

                jest.advanceTimersByTime(1000);
                await flush();
                expect(systemClipboard).toBe('');
                expect(clipboard.getString).toHaveBeenCalledTimes(2);
            });

            it('keeps the focus listener of a newer copy made during the read', async () => {
                copySensitive('first', 1000);
                jest.advanceTimersByTime(1000);

                // the newer copy's read is refused, so it waits for focus
                copySensitive('second', 1);
                clipboard.getString.mockResolvedValueOnce('');
                jest.advanceTimersByTime(1);
                await flush();
                expect(handlers.focus).toBeDefined();

                resolveRead('second');
                await flush();
                expect(handlers.focus).toBeDefined();

                handlers.focus();
                await flush();
                expect(systemClipboard).toBe('');
            });
        });

        it('does not clear text the user copied afterwards on focus', async () => {
            copySensitive('seed words', 1000);
            setAppState('background');
            jest.advanceTimersByTime(1000);
            systemClipboard = 'an address';

            setAppState('active');
            handlers.focus();
            await flush();

            expect(systemClipboard).toBe('an address');
        });
    });
});
