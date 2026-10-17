// BiometricUtils builds its instance at import time, before any test-file
// const is initialized, so the instance lives inside the factory
jest.mock('react-native-biometrics', () => {
    const instance = {
        isSensorAvailable: jest.fn(),
        createKeys: jest.fn(),
        deleteKeys: jest.fn(),
        createSignature: jest.fn(),
        biometricKeysExist: jest.fn()
    };
    return {
        __esModule: true,
        default: jest.fn(() => instance),
        instance
    };
});

import {
    KEY_INVALIDATED,
    createBiometryKey,
    deleteBiometryKey,
    getSupportedBiometryType,
    verifyBiometry
} from './BiometricUtils';

const mockBiometrics: Record<string, jest.Mock> = jest.requireMock(
    'react-native-biometrics'
).instance;

const nativeError = (code: string) =>
    Object.assign(new Error('native error'), { code });

let logSpy: jest.SpyInstance;
let errorSpy: jest.SpyInstance;

beforeEach(() => {
    Object.values(mockBiometrics).forEach((fn) => fn.mockReset());
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
});

describe('verifyBiometry', () => {
    it('unlocks with a key signature, not a bare prompt', async () => {
        mockBiometrics.createSignature.mockResolvedValue({
            success: true,
            signature: 'sig'
        });

        await expect(verifyBiometry('Unlock ZEUS')).resolves.toBe('success');
        expect(mockBiometrics.createSignature).toHaveBeenCalledWith(
            expect.objectContaining({ promptMessage: 'Unlock ZEUS' })
        );
    });

    it('reports a cancelled prompt', async () => {
        mockBiometrics.createSignature.mockResolvedValue({
            success: false,
            error: 'User cancellation'
        });

        await expect(verifyBiometry('Unlock')).resolves.toBe('cancelled');
        expect(mockBiometrics.biometricKeysExist).not.toHaveBeenCalled();
    });

    it('reports an invalidated key on the Android key_invalidated code', async () => {
        mockBiometrics.createSignature.mockRejectedValue(
            nativeError(KEY_INVALIDATED)
        );
        // Android keeps the invalidated alias in the keystore
        mockBiometrics.biometricKeysExist.mockResolvedValue({
            keysExist: true
        });

        await expect(verifyBiometry('Unlock')).resolves.toBe('invalidated');
    });

    it('reports an invalidated key when the keychain no longer returns it', async () => {
        mockBiometrics.createSignature.mockRejectedValue(
            nativeError('storage_error')
        );
        mockBiometrics.biometricKeysExist.mockResolvedValue({
            keysExist: false
        });

        await expect(verifyBiometry('Unlock')).resolves.toBe('invalidated');
    });

    it('reports other errors as failed while the key still exists', async () => {
        mockBiometrics.createSignature.mockRejectedValue(
            nativeError('Too many attempts')
        );
        mockBiometrics.biometricKeysExist.mockResolvedValue({
            keysExist: true
        });

        await expect(verifyBiometry('Unlock')).resolves.toBe('failed');
    });

    it('reports failed when the key lookup also errors', async () => {
        mockBiometrics.createSignature.mockRejectedValue(
            nativeError('signature_error')
        );
        mockBiometrics.biometricKeysExist.mockRejectedValue(
            new Error('keystore unavailable')
        );

        await expect(verifyBiometry('Unlock')).resolves.toBe('failed');
    });
});

describe('createBiometryKey', () => {
    it('returns true once the key exists', async () => {
        mockBiometrics.createKeys.mockResolvedValue({ publicKey: 'pk' });

        await expect(createBiometryKey()).resolves.toBe(true);
    });

    it('returns false when key generation fails', async () => {
        mockBiometrics.createKeys.mockRejectedValue(new Error('no passcode'));

        await expect(createBiometryKey()).resolves.toBe(false);
    });
});

describe('deleteBiometryKey', () => {
    it('swallows deletion errors', async () => {
        mockBiometrics.deleteKeys.mockRejectedValue(new Error('locked'));

        await expect(deleteBiometryKey()).resolves.toBeUndefined();
    });
});

describe('getSupportedBiometryType', () => {
    it('returns the type when a sensor is available', async () => {
        mockBiometrics.isSensorAvailable.mockResolvedValue({
            available: true,
            biometryType: 'FaceID'
        });

        await expect(getSupportedBiometryType()).resolves.toBe('FaceID');
    });

    it('returns undefined when no biometrics are enrolled', async () => {
        mockBiometrics.isSensorAvailable.mockResolvedValue({
            available: false,
            error: 'BIOMETRIC_ERROR_NONE_ENROLLED'
        });

        await expect(getSupportedBiometryType()).resolves.toBeUndefined();
    });
});
