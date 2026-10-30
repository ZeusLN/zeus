import { NativeModules } from 'react-native';

// PBKDF2-HMAC-SHA256 in native code (android LockKdf.java, ios LockKdf.m),
// off the JS thread. The secret and salt cross the bridge as hex so the
// native side derives over exactly the bytes encoded here. Tests use the
// Node implementation in utils/__mocks__/LockKdf.ts.
export const pbkdf2Sha256 = (
    secret: Buffer,
    salt: Buffer,
    iterations: number,
    keyLen: number
): Promise<Buffer> => {
    const { LockKdf } = NativeModules;
    if (!LockKdf?.pbkdf2Sha256) {
        return Promise.reject(new Error('LockKdf native module unavailable'));
    }
    return LockKdf.pbkdf2Sha256(
        secret.toString('hex'),
        salt.toString('hex'),
        iterations,
        keyLen
    ).then((hex: string) => Buffer.from(hex, 'hex'));
};
