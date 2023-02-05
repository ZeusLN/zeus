import ReactNativeBiometrics, { BiometryType } from 'react-native-biometrics';
import { Settings } from '../stores/SettingsStore';

const rnBiometrics = new ReactNativeBiometrics({
    allowDeviceCredentials: false
});

export const getSupportedBiometryType = async (): Promise<
    BiometryType | undefined
> => {
    try {
        const { available, biometryType } =
            await rnBiometrics.isSensorAvailable();

        if (available) {
            return biometryType;
        }
    } catch (error) {
        console.log(error);
    }
};

export const verifyBiometry = async (
    promptMessage: string
): Promise<boolean> => {
    try {
        const { success, error } = await rnBiometrics.simplePrompt({
            promptMessage
        });

        if (error) {
            console.error(error);

            return false;
        }

        return success;
    } catch (error) {
        console.error(error);
    }

    return false;
};

export const getIsBiometryRequired = (settings?: Settings): boolean =>
    settings != null &&
    settings.isBiometryEnabled &&
    settings.supportedBiometryType !== undefined;

export default rnBiometrics;
