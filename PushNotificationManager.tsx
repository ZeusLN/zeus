import React from 'react';
import { Alert, EmitterSubscription, Platform, View } from 'react-native';
import { Notifications } from 'react-native-notifications';
import DeviceInfo from 'react-native-device-info';

import { lightningAddressStore, settingsStore } from './stores/Stores';
import NavigationService from './NavigationService';
import { parseNwcActivityNotif } from './utils/NostrConnectUtils';

export default class PushNotificationManager extends React.Component<any, any> {
    // Removed on unmount. A remount would otherwise register a second set of
    // listeners, and on iOS each foreground notification would then be
    // completed once per set, which can abort the app in
    // react-native-notifications (dispatch_group_leave).
    private subscriptions: EmitterSubscription[] = [];
    private unmounted = false;

    async componentDidMount() {
        if (Platform.OS === 'ios') Notifications.ios.setBadgeCount(0);
        if (Platform.OS === 'android') {
            const isPlayServicesAvailable = await DeviceInfo.hasGms();
            if (!isPlayServicesAvailable) return;
        }
        // unmounted while the Play Services check was pending
        if (this.unmounted) return;
        this.registerDevice();
        this.registerNotificationEvents();
    }

    componentWillUnmount() {
        this.unmounted = true;
        this.subscriptions.forEach((subscription) => subscription.remove());
        this.subscriptions = [];
    }

    registerDevice = () => {
        this.subscriptions.push(
            Notifications.events().registerRemoteNotificationsRegistered(
                (event) => {
                    const deviceToken = event.deviceToken;
                    if (__DEV__)
                        console.log('Device Token Received', deviceToken);
                    lightningAddressStore.setDeviceToken(deviceToken);
                }
            )
        );
        this.subscriptions.push(
            Notifications.events().registerRemoteNotificationsRegistrationFailed(
                (event) => {
                    console.error('event-err', event);
                }
            )
        );

        Notifications.registerRemoteNotifications();
    };

    /** NWC local notifications may deep-link to connection activity (optional failed row). */
    private goToNwcActivityFromNotif(
        payload: Record<string, unknown> | undefined
    ): void {
        const link = parseNwcActivityNotif(payload);
        if (!link) return;
        NavigationService.navigateWhenReady('NWCConnectionActivity', {
            connectionId: link.connectionId,
            ...(link.failedActivityId && {
                failedActivityId: link.failedActivityId
            })
        });
    }

    registerNotificationEvents = () => {
        this.subscriptions.push(
            Notifications.events().registerNotificationReceivedForeground(
                (notification, completion) => {
                    if (__DEV__)
                        console.log(
                            'Notification Received - Foreground',
                            notification
                        );
                    // Don't display redeem notification if auto-redeem is on
                    if (
                        settingsStore.settings?.lightningAddress
                            ?.automaticallyAccept &&
                        JSON.stringify(notification.payload).includes(
                            'Redeem within the next 24 hours'
                        )
                    )
                        return;
                    if (Platform.OS === 'android') {
                        Alert.alert(
                            notification.payload['gcm.notification.title'],
                            notification.payload['gcm.notification.body'],
                            [
                                {
                                    text: 'OK',
                                    onPress: () => console.log('OK Pressed')
                                }
                            ]
                        );
                    }
                    if (Platform.OS === 'ios') {
                        // Calling completion on iOS with `alert: true` will present the native iOS inApp notification.
                        completion({ alert: true, sound: false, badge: false });
                    }
                }
            )
        );

        this.subscriptions.push(
            Notifications.events().registerNotificationOpened(
                (notification, completion) => {
                    if (__DEV__)
                        console.log(
                            'Notification opened by device user',
                            notification
                        );
                    console.log(
                        `Notification opened with an action identifier: ${notification.identifier}`
                    );
                    this.goToNwcActivityFromNotif(notification.payload);
                    completion();
                }
            )
        );

        this.subscriptions.push(
            Notifications.events().registerNotificationReceivedBackground(
                (notification, completion: any) => {
                    if (__DEV__)
                        console.log(
                            'Notification Received - Background',
                            notification
                        );
                    // Calling completion on iOS with `alert: true` will present the native iOS inApp notification.
                    completion({ alert: true, sound: true, badge: false });
                }
            )
        );

        Notifications.getInitialNotification()
            .then((notification) => {
                if (__DEV__)
                    console.log(
                        'Initial notification was:',
                        notification || 'N/A'
                    );
                this.goToNwcActivityFromNotif(notification?.payload);
            })
            .catch((err) =>
                console.error('getInitialNotifiation() failed', err)
            );
    };

    render() {
        const { children } = this.props;
        return <View style={{ flex: 1 }}>{children}</View>;
    }
}
