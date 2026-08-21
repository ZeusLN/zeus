import { AppState } from 'react-native';

import {
    BACKGROUND_LOCK_REARM_GRACE_MS,
    BACKGROUND_LOCK_SUPPRESSION_MAX_MS,
    shouldSkipBackgroundLock,
    suppressBackgroundLockDuring
} from './BackgroundLockUtils';
import type SettingsStore from '../stores/SettingsStore';

jest.mock('react-native', () => {
    const listeners: Array<(status: string) => void> = [];
    const AppState: any = {
        currentState: 'active',
        addEventListener: (
            _type: string,
            handler: (status: string) => void
        ) => {
            listeners.push(handler);
            return {
                remove: () => {
                    const idx = listeners.indexOf(handler);
                    if (idx !== -1) listeners.splice(idx, 1);
                }
            };
        },
        emit: (status: string) => {
            AppState.currentState = status;
            [...listeners].forEach((handler) => handler(status));
        }
    };
    return { AppState };
});

const createStore = (loginBackground = true) =>
    ({
        settings: { loginBackground },
        loginMethodConfigured: jest.fn().mockReturnValue(true),
        setLoginStatus: jest.fn()
    } as unknown as SettingsStore);

// Lets a settled task's finally block run far enough to subscribe to
// AppState before the test emits events or advances timers.
const flushMicrotasks = async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
};

describe('BackgroundLockUtils', () => {
    afterEach(() => {
        (AppState as any).currentState = 'active';
        jest.restoreAllMocks();
        jest.useRealTimers();
    });

    it('does not skip the lock when no system dialog is up', () => {
        expect(shouldSkipBackgroundLock()).toBe(false);
    });

    it('skips the lock fired while a dialog is up and does not re-arm after a quick in-app dismissal', async () => {
        const store = createStore();

        await suppressBackgroundLockDuring(store, async () => {
            // The Wallet AppState handler fires 'background' when the
            // dialog's activity covers the app.
            expect(shouldSkipBackgroundLock()).toBe(true);
        });

        expect(store.setLoginStatus).not.toHaveBeenCalled();
        // Suppression is one-shot: cleared once the flow settles.
        expect(shouldSkipBackgroundLock()).toBe(false);
    });

    it('does not re-arm when the app foregrounds right after the flow settles (picker canceled via back)', async () => {
        const store = createStore();
        (AppState as any).currentState = 'background';

        // Android delivers the picker result via onActivityResult, which
        // runs before onResume: the task settles while AppState still
        // reads 'background', then 'active' fires moments later.
        const flow = suppressBackgroundLockDuring(store, async () => {
            shouldSkipBackgroundLock();
            throw new Error('OPERATION_CANCELED');
        }).catch((error) => error);
        await flushMicrotasks();
        (AppState as any).emit('active');

        expect((await flow).message).toBe('OPERATION_CANCELED');
        expect(store.setLoginStatus).not.toHaveBeenCalled();
    });

    it('re-arms the lock when the app stays backgrounded past the grace window (user left the app)', async () => {
        jest.useFakeTimers();
        const store = createStore();
        (AppState as any).currentState = 'background';

        const flow = suppressBackgroundLockDuring(store, async () => {
            shouldSkipBackgroundLock();
        });
        await flushMicrotasks();
        jest.advanceTimersByTime(BACKGROUND_LOCK_REARM_GRACE_MS + 1);
        await flow;

        expect(store.setLoginStatus).toHaveBeenCalledWith(false);
    });

    it('re-arms the lock immediately when the dialog was up longer than the suppression ceiling', async () => {
        const store = createStore();
        jest.spyOn(Date, 'now')
            .mockReturnValueOnce(0)
            .mockReturnValue(BACKGROUND_LOCK_SUPPRESSION_MAX_MS + 1);
        // Still backgrounded at settle: the overdue check must not wait
        // out the grace window before re-arming.
        (AppState as any).currentState = 'background';

        await suppressBackgroundLockDuring(store, async () => {
            shouldSkipBackgroundLock();
        });

        expect(store.setLoginStatus).toHaveBeenCalledWith(false);
    });

    it('does not re-arm when no background event was suppressed (in-process iOS dialogs)', async () => {
        const store = createStore();
        jest.spyOn(Date, 'now')
            .mockReturnValueOnce(0)
            .mockReturnValue(BACKGROUND_LOCK_SUPPRESSION_MAX_MS + 1);

        await suppressBackgroundLockDuring(store, async () => {});

        expect(store.setLoginStatus).not.toHaveBeenCalled();
    });

    it('does not re-arm when loginBackground is disabled', async () => {
        const store = createStore(false);
        (AppState as any).currentState = 'background';

        await suppressBackgroundLockDuring(store, async () => {
            shouldSkipBackgroundLock();
        });

        expect(store.setLoginStatus).not.toHaveBeenCalled();
    });

    it('propagates task rejections while still restoring lock semantics', async () => {
        jest.useFakeTimers();
        const store = createStore();
        (AppState as any).currentState = 'background';

        const flow = suppressBackgroundLockDuring(store, async () => {
            shouldSkipBackgroundLock();
            throw new Error('write failed');
        }).catch((error) => error);
        await flushMicrotasks();
        jest.advanceTimersByTime(BACKGROUND_LOCK_REARM_GRACE_MS + 1);

        expect((await flow).message).toBe('write failed');
        expect(store.setLoginStatus).toHaveBeenCalledWith(false);
        expect(shouldSkipBackgroundLock()).toBe(false);
    });
});
