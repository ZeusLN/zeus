jest.mock('react-native-notifications', () => ({ Notifications: {} }));
jest.mock('react-native-device-info', () => ({ hasGms: jest.fn() }));
jest.mock('./utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));
jest.mock('./utils/BackendUtils', () => ({
    __esModule: true,
    default: {}
}));

let mockAuthRequired = false;
jest.mock('./stores/Stores', () => ({
    lightningAddressStore: {},
    settingsStore: {
        externalInputAuthRequired: () => mockAuthRequired,
        settings: {}
    }
}));

jest.mock('./NavigationService', () => ({
    __esModule: true,
    default: { navigateWhenReady: jest.fn() }
}));

import PushNotificationManager from './PushNotificationManager';
import NavigationService from './NavigationService';
import { processPendingNwcActivityLink } from './utils/NwcActivityLinkUtils';

describe('PushNotificationManager.goToNwcActivityFromNotif', () => {
    const payload = {
        zeusNwcAction: 'connection_activity',
        zeusNwcConnectionId: 'conn-1',
        zeusNwcFailedActivityId: 'act-1'
    };

    const tap = (p: Record<string, unknown> | undefined) =>
        (new PushNotificationManager({}) as any).goToNwcActivityFromNotif(p);

    beforeEach(() => {
        mockAuthRequired = false;
        // drop a link a previous test left queued
        processPendingNwcActivityLink();
        jest.clearAllMocks();
    });

    it('opens the connection activity when no login is required', () => {
        tap(payload);

        expect(NavigationService.navigateWhenReady).toHaveBeenCalledWith(
            'NWCConnectionActivity',
            { connectionId: 'conn-1', failedActivityId: 'act-1' }
        );
    });

    it('does not navigate while login is required or POS is active', () => {
        mockAuthRequired = true;

        tap(payload);

        expect(NavigationService.navigateWhenReady).not.toHaveBeenCalled();
    });

    it('opens the connection activity once after the login', () => {
        mockAuthRequired = true;
        tap(payload);

        mockAuthRequired = false;
        processPendingNwcActivityLink();

        expect(NavigationService.navigateWhenReady).toHaveBeenCalledTimes(1);
        expect(NavigationService.navigateWhenReady).toHaveBeenCalledWith(
            'NWCConnectionActivity',
            { connectionId: 'conn-1', failedActivityId: 'act-1' }
        );

        processPendingNwcActivityLink();

        expect(NavigationService.navigateWhenReady).toHaveBeenCalledTimes(1);
    });

    it('keeps the tap queued while login is still required', () => {
        mockAuthRequired = true;
        tap({ ...payload, zeusNwcFailedActivityId: undefined });

        processPendingNwcActivityLink();

        expect(NavigationService.navigateWhenReady).not.toHaveBeenCalled();

        mockAuthRequired = false;
        processPendingNwcActivityLink();

        expect(NavigationService.navigateWhenReady).toHaveBeenCalledWith(
            'NWCConnectionActivity',
            { connectionId: 'conn-1' }
        );
    });

    it('ignores notifications that are not NWC activity links', () => {
        tap({ 'gcm.notification.title': 'Redeem within the next 24 hours' });
        tap(undefined);

        expect(NavigationService.navigateWhenReady).not.toHaveBeenCalled();
    });
});
