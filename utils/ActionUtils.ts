import { Alert, AlertButton, Platform } from 'react-native';

export function confirmAction(
    title: string,
    message: string,
    actionButton: AlertButton,
    cancelButton: AlertButton
) {
    // iOS: system honors style ('destructive') and isPreferred for placement
    // Android: ignores style — position is determined by array index
    //          [0] = left, [1] = right; place action on right per Material Design
    const buttons =
        Platform.OS === 'ios'
            ? [actionButton, cancelButton]
            : [cancelButton, actionButton];

    Alert.alert(title, message, buttons, { cancelable: false });
}
