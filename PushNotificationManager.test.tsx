import React from 'react';
import { Platform } from 'react-native';
import { act, render } from '@testing-library/react-native';

// Each register* call returns a subscription; `mockActive` holds the ones not
// yet removed, keyed by event, so the tests can count live listeners.
const mockActive = new Map<string, Set<any>>();
const mockHandlers = new Map<string, Function>();
const mockRegister = (event: string) =>
    jest.fn((handler: Function) => {
        mockHandlers.set(event, handler);
        const subscription: { remove: jest.Mock } = {
            remove: jest.fn((): void => {
                mockActive.get(event)?.delete(subscription);
            })
        };
        if (!mockActive.has(event)) mockActive.set(event, new Set());
        mockActive.get(event)!.add(subscription);
        return subscription;
    });

const mockEvents = {
    registerRemoteNotificationsRegistered: mockRegister('registered'),
    registerRemoteNotificationsRegistrationFailed: mockRegister('failed'),
    registerNotificationReceivedForeground: mockRegister('foreground'),
    registerNotificationOpened: mockRegister('opened'),
    registerNotificationReceivedBackground: mockRegister('background')
};

jest.mock('react-native-notifications', () => ({
    Notifications: {
        events: () => mockEvents,
        registerRemoteNotifications: jest.fn(),
        getInitialNotification: jest.fn(() => Promise.resolve(undefined)),
        ios: { setBadgeCount: jest.fn() }
    }
}));

jest.mock('react-native-device-info', () => ({
    hasGms: jest.fn()
}));

jest.mock('./stores/Stores', () => ({
    lightningAddressStore: { setDeviceToken: jest.fn() },
    settingsStore: { settings: {} }
}));

jest.mock('./NavigationService', () => ({
    navigateWhenReady: jest.fn()
}));

jest.mock('./utils/NostrConnectUtils', () => ({
    parseNwcActivityNotif: jest.fn(() => null)
}));

import DeviceInfo from 'react-native-device-info';
import { Notifications } from 'react-native-notifications';
import PushNotificationManager from './PushNotificationManager';

const EVENTS = ['registered', 'failed', 'foreground', 'opened', 'background'];
const live = (event: string) => mockActive.get(event)?.size ?? 0;

const mount = async () => {
    const view = await render(<PushNotificationManager />);
    // componentDidMount is async; let it and getInitialNotification settle
    await act(async () => {});
    return view;
};

describe('PushNotificationManager', () => {
    const platform = Platform.OS;

    beforeEach(() => {
        mockActive.clear();
        mockHandlers.clear();
        jest.clearAllMocks();
    });

    afterEach(() => {
        Platform.OS = platform;
    });

    describe('on iOS', () => {
        beforeEach(() => {
            Platform.OS = 'ios';
        });

        it('registers each listener once on mount', async () => {
            await mount();
            EVENTS.forEach((event) => expect(live(event)).toBe(1));
            expect(
                Notifications.registerRemoteNotifications
            ).toHaveBeenCalledTimes(1);
        });

        it('removes every listener on unmount', async () => {
            const { unmount } = await mount();
            await unmount();
            EVENTS.forEach((event) => expect(live(event)).toBe(0));
        });

        it('leaves one foreground listener after a remount', async () => {
            // A theme switch between linear and radial gradients used to
            // remount the app tree; two listeners completed each foreground
            // notification twice and crashed the app
            const first = await mount();
            await first.unmount();
            await mount();
            EVENTS.forEach((event) => expect(live(event)).toBe(1));
        });

        it('completes a foreground notification once, with an alert', async () => {
            await mount();
            const completion = jest.fn();
            mockHandlers.get('foreground')!(
                { payload: { aps: { alert: 'You received 21 sats' } } },
                completion
            );
            expect(completion).toHaveBeenCalledTimes(1);
            expect(completion).toHaveBeenCalledWith({
                alert: true,
                sound: false,
                badge: false
            });
        });
    });

    describe('on Android', () => {
        beforeEach(() => {
            Platform.OS = 'android';
        });

        it('registers nothing without Play Services', async () => {
            (DeviceInfo.hasGms as jest.Mock).mockResolvedValue(false);
            await mount();
            EVENTS.forEach((event) => expect(live(event)).toBe(0));
        });

        it('registers nothing when unmounted before the Play Services check returns', async () => {
            let resolveGms: (value: boolean) => void = () => {};
            (DeviceInfo.hasGms as jest.Mock).mockReturnValue(
                new Promise<boolean>((resolve) => {
                    resolveGms = resolve;
                })
            );
            const { unmount } = await render(<PushNotificationManager />);
            await unmount();
            await act(async () => resolveGms(true));
            EVENTS.forEach((event) => expect(live(event)).toBe(0));
            expect(
                Notifications.registerRemoteNotifications
            ).not.toHaveBeenCalled();
        });

        it('registers once Play Services are available', async () => {
            (DeviceInfo.hasGms as jest.Mock).mockResolvedValue(true);
            await mount();
            EVENTS.forEach((event) => expect(live(event)).toBe(1));
        });
    });
});
