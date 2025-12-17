import { Linking, Platform } from 'react-native';

export const APP_STORE_ID = '1456038895';
export const ANDROID_PACKAGE = 'com.zeusln.zeus';

export const LOW_RATING_THRESHOLD = 2;
export const RATING_MODAL_TRIGGER_DELAY = 1000;

export const openStoreForReview = async () => {
    const url =
        Platform.OS === 'ios'
            ? `itms-apps://itunes.apple.com/app/id${APP_STORE_ID}?action=write-review`
            : `market://details?id=${ANDROID_PACKAGE}`;

    try {
        const supported = await Linking.canOpenURL(url);
        if (supported) {
            await Linking.openURL(url);
        }
    } catch (error) {
        console.error('An error occurred while opening store URL', error);
    }
};
