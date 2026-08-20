import { AppState } from 'react-native';

import {
    BACKGROUND_LOCK_SUPPRESSION_MAX_MS,
    shouldSkipBackgroundLock,
    suppressBackgroundLockDuring
} from './BackgroundLockUtils';
import type SettingsStore from '../stores/SettingsStore';

jest.mock('react-native', () => ({
    AppState: { currentState: 'active' }
}));

const createStore = (loginBackground = true) =>
    ({
        settings: { loginBackground },
        loginMethodConfigured: jest.fn().mockReturnValue(true),
        setLoginStatus: jest.fn()
    } as unknown as SettingsStore);

describe('BackgroundLockUtils', () => {
    afterEach(() => {
        (AppState as any).currentState = 'active';
        jest.restoreAllMocks();
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

    it('re-arms the lock when the flow settles while the app is backgrounded', async () => {
        const store = createStore();
        (AppState as any).currentState = 'background';

        await suppressBackgroundLockDuring(store, async () => {
            shouldSkipBackgroundLock();
        });

        expect(store.setLoginStatus).toHaveBeenCalledWith(false);
    });

    it('re-arms the lock when the dialog was up longer than the grace period', async () => {
        const store = createStore();
        jest.spyOn(Date, 'now')
            .mockReturnValueOnce(0)
            .mockReturnValue(BACKGROUND_LOCK_SUPPRESSION_MAX_MS + 1);

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
        const store = createStore();
        (AppState as any).currentState = 'background';

        await expect(
            suppressBackgroundLockDuring(store, async () => {
                shouldSkipBackgroundLock();
                throw new Error('user canceled');
            })
        ).rejects.toThrow('user canceled');

        expect(store.setLoginStatus).toHaveBeenCalledWith(false);
        expect(shouldSkipBackgroundLock()).toBe(false);
    });
});
