jest.mock('react-native-restart', () => ({
    __esModule: true,
    default: { Restart: jest.fn() }
}));
jest.mock('./LocaleUtils', () => ({
    localeString: (s: string) => s
}));
jest.mock('../stores/Stores', () => ({
    settingsStore: { implementation: 'lnd' }
}));
jest.mock('../ldknode/LdkNodeInjection', () => ({
    __esModule: true,
    default: { node: { stop: jest.fn() } }
}));

import { NativeModules, Platform } from 'react-native';
import RNRestart from 'react-native-restart';

import { IN_APP_RESTART } from './InAppRestartUtils';
import { restartApp } from './RestartUtils';

describe('restartApp', () => {
    const originalOS = Platform.OS;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterEach(() => {
        Platform.OS = originalOS;
    });

    it('reloads JS with the in-app restart reason on iOS', () => {
        Platform.OS = 'ios';

        restartApp();

        expect(RNRestart.Restart).toHaveBeenCalledWith(IN_APP_RESTART);
    });

    it('restarts the process natively on Android', () => {
        Platform.OS = 'android';
        NativeModules.LndMobileTools = { restartApp: jest.fn() } as any;

        restartApp();

        expect(NativeModules.LndMobileTools.restartApp).toHaveBeenCalled();
        expect(RNRestart.Restart).not.toHaveBeenCalled();
    });
});
