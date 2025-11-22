import { NativeModules, Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';

export async function isBatterySaverEnabled(): Promise<boolean> {
    try {
        if (Platform.OS === 'ios') {
            const powerState = await DeviceInfo.getPowerState();
            return powerState.lowPowerMode === true;
        } else if (Platform.OS === 'android') {
            try {
                const { MobileTools } = NativeModules;
                if (MobileTools?.isBatterySaverEnabled) {
                    return await MobileTools.isBatterySaverEnabled();
                }
            } catch (nativeError) {
                console.warn(
                    '[BatteryUtils] Native check failed, using fallback:',
                    nativeError
                );
            }

            try {
                const powerState = await DeviceInfo.getPowerState();
                const { batteryLevel, charging, batteryState } = powerState;
                return (
                    (batteryLevel !== undefined &&
                        batteryLevel < 10 &&
                        !charging) ||
                    (batteryState === 'unplugged' &&
                        batteryLevel !== undefined &&
                        batteryLevel < 20 &&
                        !charging)
                );
            } catch (error) {
                console.error('[BatteryUtils] Fallback check error:', error);
                return false;
            }
        }
        return false;
    } catch (error) {
        console.error('[BatteryUtils] Error:', error);
        return false;
    }
}
