import ReactNativeBiometrics, { BiometryType } from 'react-native-biometrics';

// Must stay false: with device credentials allowed, iOS createKeys uses
// kSecAccessControlUserPresence instead of the BiometryCurrentSet flag from
// patches/patch-biometrics-enrollment.mjs, so newly enrolled biometrics (or
// the device passcode) could unlock the wallet again
const rnBiometrics = new ReactNativeBiometrics({
    allowDeviceCredentials: false
});

// Rejection code from createSignature when the OS invalidated the key because
// the enrolled biometrics changed (Android, see
// patches/patch-biometrics-enrollment.mjs)
export const KEY_INVALIDATED = 'key_invalidated';

// The signature itself is never checked: unlocking only needs the OS to
// release the private key, which it does only for the biometrics enrolled
// when the key was created
const UNLOCK_PAYLOAD = 'zeus-biometric-unlock';

export type BiometryResult = 'success' | 'cancelled' | 'invalidated' | 'failed';

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

export const createBiometryKey = async (): Promise<boolean> => {
    try {
        await rnBiometrics.createKeys();
        return true;
    } catch (error) {
        console.error(error);
        return false;
    }
};

export const deleteBiometryKey = async (): Promise<void> => {
    try {
        await rnBiometrics.deleteKeys();
    } catch (error) {
        console.error(error);
    }
};

export const verifyBiometry = async (
    promptMessage: string
): Promise<BiometryResult> => {
    try {
        const { success } = await rnBiometrics.createSignature({
            promptMessage,
            payload: UNLOCK_PAYLOAD
        });

        return success ? 'success' : 'cancelled';
    } catch (error: any) {
        console.error(error);

        if (error?.code === KEY_INVALIDATED) return 'invalidated';
    }

    // iOS has no distinct error for a key invalidated by an enrollment
    // change, but the keychain stops returning the item
    try {
        const { keysExist } = await rnBiometrics.biometricKeysExist();
        if (!keysExist) return 'invalidated';
    } catch (error) {
        console.error(error);
    }

    return 'failed';
};

export default rnBiometrics;
