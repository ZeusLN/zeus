import {
    DeviceEventEmitter,
    NativeEventEmitter,
    NativeModules,
    Platform
} from 'react-native';

export const LndMobileEventEmitter =
    Platform.OS == 'android'
        ? DeviceEventEmitter
        : new NativeEventEmitter(NativeModules.LndMobile);

export const LndMobileToolsEventEmitter =
    Platform.OS == 'android'
        ? DeviceEventEmitter
        : new NativeEventEmitter(NativeModules.LndMobileTools);
