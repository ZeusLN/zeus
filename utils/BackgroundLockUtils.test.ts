import { AppState, Platform } from 'react-native';

import {
    BACKGROUND_LOCK_REARM_GRACE_MS,
    BACKGROUND_LOCK_SUPPRESSION_MAX_MS,
    shouldSkipBackgroundLock,
    skippedBackgroundLockIsOverdue,
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
    return { AppState, Platform: { OS: 'android' } };
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
        Platform.OS = 'android';
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

    it('re-arms the lock when the wall clock was set back while the dialog was up', async () => {
        jest.useFakeTimers();
        const store = createStore();
        (AppState as any).currentState = 'background';

        const flow = suppressBackgroundLockDuring(store, async () => {
            shouldSkipBackgroundLock();
            jest.advanceTimersByTime(5 * 1000);
            jest.setSystemTime(Date.now() - 24 * 60 * 60 * 1000);
        });
        await flushMicrotasks();
        (AppState as any).emit('active');
        await flow;

        expect(store.setLoginStatus).toHaveBeenCalledWith(false);
    });

    it('re-arms the lock when only the monotonic clock passed the ceiling', async () => {
        jest.useFakeTimers();
        const store = createStore();
        (AppState as any).currentState = 'background';

        const flow = suppressBackgroundLockDuring(store, async () => {
            shouldSkipBackgroundLock();
            jest.advanceTimersByTime(BACKGROUND_LOCK_SUPPRESSION_MAX_MS + 1);
            // Wall clock shows exactly the ceiling: neither over the limit
            // nor behind the monotonic clock by more than 1 s.
            jest.setSystemTime(Date.now() - 1);
        });
        await flushMicrotasks();
        (AppState as any).emit('active');
        await flow;

        expect(store.setLoginStatus).toHaveBeenCalledWith(false);
    });

    it('does not re-arm when the wall clock trails the monotonic clock by exactly 1000 ms', async () => {
        jest.useFakeTimers();
        const store = createStore();
        (AppState as any).currentState = 'background';

        const flow = suppressBackgroundLockDuring(store, async () => {
            shouldSkipBackgroundLock();
            jest.advanceTimersByTime(5 * 1000);
            jest.setSystemTime(Date.now() - 1000);
        });
        await flushMicrotasks();
        (AppState as any).emit('active');
        await flow;

        expect(store.setLoginStatus).not.toHaveBeenCalled();
    });

    it('re-arms the lock when the wall clock trails the monotonic clock by just over 1000 ms', async () => {
        jest.useFakeTimers();
        const store = createStore();
        (AppState as any).currentState = 'background';

        const flow = suppressBackgroundLockDuring(store, async () => {
            shouldSkipBackgroundLock();
            jest.advanceTimersByTime(5 * 1000);
            jest.setSystemTime(Date.now() - 1001);
        });
        await flushMicrotasks();
        (AppState as any).emit('active');
        await flow;

        expect(store.setLoginStatus).toHaveBeenCalledWith(false);
    });

    // An export makes more native calls after its save dialog closes
    // (copying the file, removing staged files), so it settles after the
    // 'active' event that would have shown the Lockscreen.
    describe('when the flow settles after the app is back in front', () => {
        const runFlow = async (dialogUpForMs: number) => {
            jest.useFakeTimers();
            const store = createStore();
            let finishFlow!: () => void;
            const flow = suppressBackgroundLockDuring(
                store,
                () => new Promise<void>((resolve) => (finishFlow = resolve))
            );
            (AppState as any).emit('background');
            shouldSkipBackgroundLock();
            jest.advanceTimersByTime(dialogUpForMs);

            (AppState as any).emit('active');
            const overdueOnResume = skippedBackgroundLockIsOverdue();
            finishFlow();
            await flow;
            return { store, overdueOnResume };
        };

        it('reports the skipped lock as overdue on resume past the ceiling', async () => {
            const { store, overdueOnResume } = await runFlow(
                BACKGROUND_LOCK_SUPPRESSION_MAX_MS + 1
            );

            expect(overdueOnResume).toBe(true);
            // the Wallet handler locked on 'active'; a lock set after it
            // would have no Lockscreen in front of it
            expect(store.setLoginStatus).not.toHaveBeenCalled();
            expect(skippedBackgroundLockIsOverdue()).toBe(false);
        });

        it('does not report it within the ceiling', async () => {
            const { store, overdueOnResume } = await runFlow(1000);

            expect(overdueOnResume).toBe(false);
            expect(store.setLoginStatus).not.toHaveBeenCalled();
        });
    });

    it('is not overdue when no lock was skipped', async () => {
        jest.useFakeTimers();
        const store = createStore();
        let finishFlow!: () => void;
        const flow = suppressBackgroundLockDuring(
            store,
            () => new Promise<void>((resolve) => (finishFlow = resolve))
        );
        jest.advanceTimersByTime(BACKGROUND_LOCK_SUPPRESSION_MAX_MS + 1);

        expect(skippedBackgroundLockIsOverdue()).toBe(false);
        finishFlow();
        await flow;
    });

    it('does not skip the lock on iOS, where a background event means the user left the app', async () => {
        Platform.OS = 'ios';
        const store = createStore();

        await suppressBackgroundLockDuring(store, async () => {
            expect(shouldSkipBackgroundLock()).toBe(false);
        });

        expect(store.setLoginStatus).not.toHaveBeenCalled();
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
