import React from 'react';
import { Alert, Platform, View } from 'react-native';
import { Notifications } from 'react-native-notifications';
import stores from './stores/Stores';

export default class PushNotificationManager extends React.Component<any, any> {
    componentDidMount() {
        if (Platform.OS === 'ios') Notifications.ios.setBadgeCount(0);
        this.registerDevice();
        this.registerNotificationEvents();
    }

    registerDevice = () => {
        Notifications.events().registerRemoteNotificationsRegistered(
            (event) => {
                const deviceToken = event.deviceToken;
                console.log('Device Token Received', deviceToken);
                stores.lightningAddressStore.setDeviceToken(deviceToken);
            }
        );
        Notifications.events().registerRemoteNotificationsRegistrationFailed(
            (event) => {
                console.error('event-err', event);
            }
        );

        Notifications.registerRemoteNotifications();
    };

    registerNotificationEvents = () => {
        Notifications.events().registerNotificationReceivedForeground(
            (notification, completion) => {
                console.log('Notification Received - Foreground', notification);
                // Don't display redeem notification if auto-redeem is on
                if (
                    stores.settingsStore.settings?.lightningAddress
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
        );

        Notifications.events().registerNotificationOpened(
            (notification, completion) => {
                console.log('Notification opened by device user', notification);
                console.log(
                    `Notification opened with an action identifier: ${notification.identifier}`
                );
                completion();
            }
        );

        Notifications.events().registerNotificationReceivedBackground(
            (notification, completion: any) => {
                console.log('Notification Received - Background', notification);
                // Calling completion on iOS with `alert: true` will present the native iOS inApp notification.
                completion({ alert: true, sound: true, badge: false });
            }
        );

        Notifications.getInitialNotification()
            .then((notification) => {
                console.log('Initial notification was:', notification || 'N/A');
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
