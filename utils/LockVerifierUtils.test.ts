// The native randombytes module cannot init under jest; back it with node crypto.
jest.mock('react-native-randombytes', () => ({
    randomBytes: (length: number) => require('crypto').randomBytes(length)
}));
jest.mock('./LockKdf');

import { pbkdf2Sync } from 'crypto';

import * as LockKdf from './LockKdf';
import {
    deriveVerifier,
    verifySecret,
    hasVerifier,
    getDummyVerifier,
    DUMMY_VERIFIER,
    PBKDF2_ITERATIONS,
    VerifierRecord
} from './LockVerifierUtils';

describe('LockVerifierUtils', () => {
    // Fixed salt so the derived output is deterministic where we need it.
    const salt = Buffer.alloc(16, 0x01);

    afterEach(() => jest.restoreAllMocks());

    describe('LockKdf mock', () => {
        // RFC 7914 section 11, PBKDF2-HMAC-SHA256. The Android and iOS
        // modules were checked against the same vectors.
        it('matches the RFC 7914 PBKDF2-HMAC-SHA256 test vectors', async () => {
            expect(
                (
                    await LockKdf.pbkdf2Sha256(
                        Buffer.from('passwd'),
                        Buffer.from('salt'),
                        1,
                        64
                    )
                ).toString('hex')
            ).toEqual(
                '55ac046e56e3089fec1691c22544b605f94185216dde0465e68b9d57c20dacbc49ca9cccf179b645991664b39d77ef317c71b845b1e30bd509112041d3a19783'
            );
            expect(
                (
                    await LockKdf.pbkdf2Sha256(
                        Buffer.from('Password'),
                        Buffer.from('NaCl'),
                        80000,
                        64
                    )
                ).toString('hex')
            ).toEqual(
                '4ddcd8f60b98be21830cee5ef22701f9641a4418d04c0414aeff08876b34ab56a1d425a1225833549adb841b51c9b3176a272bdebba1d078478f62b397f33c8d'
            );
        });
    });

    describe('deriveVerifier', () => {
        it('produces a well-formed PBKDF2 record and never stores the secret', async () => {
            const record = await deriveVerifier('1234', salt);
            expect(record).toEqual({
                v: 1,
                kdf: 'pbkdf2-sha256',
                iterations: PBKDF2_ITERATIONS,
                salt: salt.toString('hex'),
                hash: '46487fbb227c644efe9a4e0f3359c1b7207b233a0555832f9b5e8af1b675ddaf'
            });
            expect(JSON.stringify(record)).not.toContain('1234');
        });

        it('derives over the UTF-8 bytes of the secret', async () => {
            const secret = 'päss 🔒';
            const record = await deriveVerifier(secret, salt);
            expect(record.hash).toEqual(
                pbkdf2Sync(
                    Buffer.from(secret, 'utf8'),
                    salt,
                    PBKDF2_ITERATIONS,
                    32,
                    'sha256'
                ).toString('hex')
            );
            expect(await verifySecret(secret, record)).toBe(true);
        });

        it('uses a fresh random salt per call', async () => {
            const a = await deriveVerifier('1234');
            const b = await deriveVerifier('1234');
            expect(a.salt).not.toEqual(b.salt);
            expect(a.hash).not.toEqual(b.hash);
        });

        it('rejects when the native derivation fails', async () => {
            jest.spyOn(LockKdf, 'pbkdf2Sha256').mockRejectedValue(
                new Error('LockKdf native module unavailable')
            );
            await expect(deriveVerifier('1234', salt)).rejects.toThrow(
                'LockKdf native module unavailable'
            );
        });
    });

    describe('verifySecret', () => {
        it('accepts the correct secret and rejects a wrong one', async () => {
            const record = await deriveVerifier('correct horse', salt);
            expect(await verifySecret('correct horse', record)).toBe(true);
            expect(await verifySecret('wrong horse', record)).toBe(false);
        });

        it('round-trips regardless of the random salt', async () => {
            const record = await deriveVerifier('98765');
            expect(await verifySecret('98765', record)).toBe(true);
            expect(await verifySecret('98764', record)).toBe(false);
        });

        it("uses the record's iteration count", async () => {
            const record = {
                v: 1,
                kdf: 'pbkdf2-sha256',
                iterations: 1000,
                salt: salt.toString('hex'),
                hash: pbkdf2Sync('1234', salt, 1000, 32, 'sha256').toString(
                    'hex'
                )
            } as VerifierRecord;
            expect(await verifySecret('1234', record)).toBe(true);
        });

        it('fails closed on an empty secret', async () => {
            const record = await deriveVerifier('1234', salt);
            expect(await verifySecret('', record)).toBe(false);
        });

        it('fails closed when the native derivation fails', async () => {
            const record = await deriveVerifier('1234', salt);
            jest.spyOn(LockKdf, 'pbkdf2Sha256').mockRejectedValue(
                new Error('Invalid PBKDF2 parameters')
            );
            expect(await verifySecret('1234', record)).toBe(false);
        });

        it('fails closed on a missing or malformed record', async () => {
            expect(await verifySecret('1234', undefined)).toBe(false);
            expect(await verifySecret('1234', null)).toBe(false);
            expect(
                await verifySecret('1234', {
                    v: 1,
                    kdf: 'pbkdf2-sha256',
                    iterations: 0,
                    salt: '',
                    hash: ''
                } as VerifierRecord)
            ).toBe(false);
            expect(
                await verifySecret('1234', {
                    salt: 'zz',
                    hash: 'zz'
                } as unknown as VerifierRecord)
            ).toBe(false);
        });

        // Records from earlier builds of the lock verifier change, which used
        // scrypt-js (N=32768, r=8, p=1). This hash was derived for '1234'
        // under the same salt.
        it('still verifies scrypt records', async () => {
            const record = {
                v: 1,
                kdf: 'scrypt',
                n: 32768,
                r: 8,
                p: 1,
                salt: salt.toString('hex'),
                hash: 'e46bd81f58f1f7b373c222b44cf978520a563205869f540681b6bcf460c7032d'
            } as VerifierRecord;
            const native = jest.spyOn(LockKdf, 'pbkdf2Sha256');

            expect(hasVerifier(record)).toBe(true);
            expect(await verifySecret('1234', record)).toBe(true);
            expect(await verifySecret('1235', record)).toBe(false);
            expect(native).not.toHaveBeenCalled();
        });
    });

    describe('DUMMY_VERIFIER', () => {
        it('is well-formed, so verifying against it runs the full derivation', async () => {
            expect(hasVerifier(DUMMY_VERIFIER)).toBe(true);
            const native = jest.spyOn(LockKdf, 'pbkdf2Sha256');
            await verifySecret('1234', DUMMY_VERIFIER);
            expect(native).toHaveBeenCalledWith(
                Buffer.from('1234'),
                Buffer.alloc(16),
                PBKDF2_ITERATIONS,
                32
            );
        });

        it('never matches an attempt', async () => {
            expect(await verifySecret('1234', DUMMY_VERIFIER)).toBe(false);
            expect(await verifySecret('0000', DUMMY_VERIFIER)).toBe(false);
            expect(
                await verifySecret('correct horse battery', DUMMY_VERIFIER)
            ).toBe(false);
        });
    });

    describe('getDummyVerifier', () => {
        it('uses the KDF of the primary verifier', async () => {
            const pbkdf2 = await deriveVerifier('1234', salt);
            expect(getDummyVerifier(pbkdf2)).toBe(DUMMY_VERIFIER);
            expect(getDummyVerifier(undefined)).toBe(DUMMY_VERIFIER);

            const scryptDummy = getDummyVerifier({
                v: 1,
                kdf: 'scrypt',
                n: 32768,
                r: 8,
                p: 1,
                salt: 'aa',
                hash: 'bb'
            });
            expect(scryptDummy.kdf).toEqual('scrypt');
            expect(hasVerifier(scryptDummy)).toBe(true);
            expect(await verifySecret('1234', scryptDummy)).toBe(false);
        });
    });

    describe('hasVerifier', () => {
        it('detects presence of a valid verifier', async () => {
            const record = await deriveVerifier('1234', salt);
            expect(hasVerifier(record)).toBe(true);
            expect(hasVerifier(undefined)).toBe(false);
            expect(hasVerifier(null)).toBe(false);
            expect(
                hasVerifier({ salt: '', hash: '' } as unknown as VerifierRecord)
            ).toBe(false);
            expect(
                hasVerifier({
                    kdf: 'md5',
                    salt: 'aa',
                    hash: 'bb'
                } as unknown as VerifierRecord)
            ).toBe(false);
        });
    });
});
