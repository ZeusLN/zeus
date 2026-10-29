jest.mock('@react-native-clipboard/clipboard', () => ({
    __esModule: true,
    default: { setString: jest.fn(), getString: jest.fn() }
}));

import { AppState } from 'react-native';
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
    let changeHandler: ((state: string) => void) | undefined;
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
        changeHandler = undefined;
        remove = jest.fn();
        jest.spyOn(AppState, 'addEventListener').mockImplementation(
            (_type: any, handler: any) => {
                changeHandler = handler;
                return { remove } as any;
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

        changeHandler!('inactive');
        await flush();
        expect(systemClipboard).toBe('seed words');

        setAppState('active');
        changeHandler!('active');
        await flush();
        expect(systemClipboard).toBe('');
        expect(remove).toHaveBeenCalled();
    });

    it('drops a pending background check when a new secret is copied', async () => {
        copySensitive('first', 1000);
        setAppState('background');
        jest.advanceTimersByTime(1000);
        expect(changeHandler).toBeDefined();

        setAppState('active');
        copySensitive('second', 1000);
        expect(remove).toHaveBeenCalled();
    });
});
