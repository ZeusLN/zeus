// Manual mock, used by tests that call jest.mock('../utils/LockKdf') without
// a factory. Node's PBKDF2 stands in for the native module and resolves
// asynchronously, as the native call does. LockVerifierUtils.test.ts checks
// it against RFC 7914 test vectors.
const crypto = require('crypto');

export const pbkdf2Sha256 = (
    secret: Buffer,
    salt: Buffer,
    iterations: number,
    keyLen: number
): Promise<Buffer> =>
    new Promise((resolve, reject) =>
        crypto.pbkdf2(
            secret,
            salt,
            iterations,
            keyLen,
            'sha256',
            (err: Error | null, key: Buffer) =>
                err ? reject(err) : resolve(key)
        )
    );
