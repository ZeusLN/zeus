const mockGetReason = jest.fn();
jest.mock('react-native-restart', () => ({
    __esModule: true,
    default: { getReason: () => mockGetReason() }
}));

import { Platform } from 'react-native';

import { IN_APP_RESTART, startedByInAppRestart } from './InAppRestartUtils';

describe('startedByInAppRestart', () => {
    const originalOS = Platform.OS;

    beforeEach(() => {
        mockGetReason.mockReset();
    });

    afterEach(() => {
        Platform.OS = originalOS;
    });

    it('is false on iOS when no restart reason is set', async () => {
        Platform.OS = 'ios';
        mockGetReason.mockResolvedValue(null);

        await expect(startedByInAppRestart()).resolves.toBe(false);
    });

    it('is true on iOS after an in-app restart', async () => {
        Platform.OS = 'ios';
        mockGetReason.mockResolvedValue(IN_APP_RESTART);

        await expect(startedByInAppRestart()).resolves.toBe(true);
    });

    it('is false on iOS when getReason rejects', async () => {
        // the launch URL is still handled if the native module fails
        Platform.OS = 'ios';
        mockGetReason.mockRejectedValue(new Error('not linked'));

        await expect(startedByInAppRestart()).resolves.toBe(false);
    });

    it('is false on Android without asking the native module', async () => {
        Platform.OS = 'android';
        mockGetReason.mockResolvedValue(IN_APP_RESTART);

        await expect(startedByInAppRestart()).resolves.toBe(false);
        expect(mockGetReason).not.toHaveBeenCalled();
    });
});
