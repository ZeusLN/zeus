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
    default: { node: { stop: jest.fn().mockResolvedValue(undefined) } }
}));
jest.mock('./LndMobileUtils', () => ({
    stopLnd: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('react-native', () => ({
    Alert: { alert: jest.fn() },
    Platform: { OS: 'android' },
    NativeModules: { LndMobileTools: { restartApp: jest.fn() } }
}));

import { Alert, NativeModules, Platform } from 'react-native';
import RNRestart from 'react-native-restart';

import { settingsStore } from '../stores/Stores';
import LdkNode from '../ldknode/LdkNodeInjection';
import { IN_APP_RESTART } from './InAppRestartUtils';
import { restartApp, restartNeeded, stopNodeAndRestart } from './RestartUtils';
import { stopLnd } from './LndMobileUtils';

const mockStopLnd = stopLnd as jest.Mock;
const mockLdkStop = LdkNode.node.stop as jest.Mock;

describe('restartApp', () => {
    const originalOS = Platform.OS;

    beforeEach(() => {
        jest.clearAllMocks();
        (settingsStore as { implementation: string }).implementation = 'lnd';
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

describe('stopNodeAndRestart', () => {
    const originalOS = Platform.OS;

    beforeEach(() => {
        jest.clearAllMocks();
        Platform.OS = 'android';
        NativeModules.LndMobileTools = { restartApp: jest.fn() } as any;
        mockStopLnd.mockResolvedValue(undefined);
        mockLdkStop.mockResolvedValue(undefined);
    });

    afterEach(() => {
        Platform.OS = originalOS;
        jest.useRealTimers();
    });

    it('stops embedded LND via stopLnd then restarts on Android', async () => {
        (settingsStore as { implementation: string }).implementation =
            'embedded-lnd';

        await stopNodeAndRestart();

        expect(mockStopLnd).toHaveBeenCalledTimes(1);
        expect(mockLdkStop).not.toHaveBeenCalled();
        expect(NativeModules.LndMobileTools.restartApp).toHaveBeenCalledTimes(
            1
        );
    });

    it('stops LDK Node then restarts on Android', async () => {
        (settingsStore as { implementation: string }).implementation =
            'ldk-node';

        await stopNodeAndRestart();

        expect(mockLdkStop).toHaveBeenCalledTimes(1);
        expect(mockStopLnd).not.toHaveBeenCalled();
        expect(NativeModules.LndMobileTools.restartApp).toHaveBeenCalledTimes(
            1
        );
    });

    it('restarts without stopping on a remote backend', async () => {
        (settingsStore as { implementation: string }).implementation = 'lnd';

        await stopNodeAndRestart();

        expect(mockStopLnd).not.toHaveBeenCalled();
        expect(mockLdkStop).not.toHaveBeenCalled();
        expect(NativeModules.LndMobileTools.restartApp).toHaveBeenCalledTimes(
            1
        );
    });

    it('still restarts when stopLnd rejects', async () => {
        (settingsStore as { implementation: string }).implementation =
            'embedded-lnd';
        mockStopLnd.mockRejectedValue(new Error('stop failed'));
        jest.spyOn(console, 'log').mockImplementation(() => {});

        await stopNodeAndRestart();

        expect(NativeModules.LndMobileTools.restartApp).toHaveBeenCalledTimes(
            1
        );
    });

    it('restarts after the stop timeout when stopLnd never settles', async () => {
        (settingsStore as { implementation: string }).implementation =
            'embedded-lnd';
        mockStopLnd.mockImplementation(() => new Promise(() => {}));
        jest.useFakeTimers();

        const pending = stopNodeAndRestart();
        await Promise.resolve();
        expect(NativeModules.LndMobileTools.restartApp).not.toHaveBeenCalled();

        jest.advanceTimersByTime(10_000);
        await pending;

        expect(NativeModules.LndMobileTools.restartApp).toHaveBeenCalledTimes(
            1
        );
    });
});

describe('restartNeeded', () => {
    const originalOS = Platform.OS;
    const mockAlert = Alert.alert as jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        Platform.OS = 'android';
        NativeModules.LndMobileTools = { restartApp: jest.fn() } as any;
        mockAlert.mockClear();
    });

    afterEach(() => {
        Platform.OS = originalOS;
    });

    it('on Android with force shows one button', () => {
        restartNeeded(true);

        const buttons = mockAlert.mock.calls[0][2] as Array<{ text: string }>;
        expect(buttons).toHaveLength(1);
        expect(buttons[0].text).toBe('views.Wallet.restart');
        expect(mockAlert.mock.calls[0][1]).toBe('restart.msg');
    });

    it('on Android without force shows cancel and yes plus restart.msg1', () => {
        restartNeeded();

        const buttons = mockAlert.mock.calls[0][2] as Array<{ text: string }>;
        expect(buttons).toHaveLength(2);
        expect(buttons[0].text).toBe('general.no');
        expect(buttons[1].text).toBe('general.yes');
        expect(mockAlert.mock.calls[0][1]).toContain('restart.msg1');
    });

    it('on iOS shows title and message with no buttons', () => {
        Platform.OS = 'ios';

        restartNeeded(true);

        expect(mockAlert).toHaveBeenCalledWith('restart.title', 'restart.msg');
        expect(mockAlert.mock.calls[0]).toHaveLength(2);
    });
});
