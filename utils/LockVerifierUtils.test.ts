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
    getPlaintextCredential,
    hasLockCredential,
    resolveLoginVerifiers,
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

        // A KDF failure must not look like a wrong entry: the Lockscreen
        // counts wrong entries toward the wipe
        it('rejects when the derivation fails', async () => {
            const record = await deriveVerifier('1234', salt);
            jest.spyOn(LockKdf, 'pbkdf2Sha256').mockRejectedValue(
                new Error('LockKdf native module unavailable')
            );

            await expect(verifySecret('1234', record)).rejects.toThrow(
                'LockKdf native module unavailable'
            );
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
        it('copies the KDF and cost parameters of a PBKDF2 primary', async () => {
            const primary = await deriveVerifier('1234', salt);
            const dummy = getDummyVerifier(primary);

            expect(dummy).toEqual({
                ...primary,
                salt: '0'.repeat(primary.salt.length),
                hash: '0'.repeat(primary.hash.length)
            });
            expect(hasVerifier(dummy)).toBe(true);
            expect(await verifySecret('1234', dummy)).toBe(false);
        });

        // e.g. a record written before PBKDF2_ITERATIONS is raised: a fixed
        // dummy at the new count would cost more than the primary check
        it('keeps the iteration count and key length of an older record', async () => {
            const primary = {
                ...(await deriveVerifier('1234', salt)),
                iterations: 1000,
                hash: 'ab'.repeat(16)
            } as VerifierRecord;
            const native = jest.spyOn(LockKdf, 'pbkdf2Sha256');

            await verifySecret('1234', getDummyVerifier(primary));

            expect(native).toHaveBeenCalledWith(
                Buffer.from('1234'),
                Buffer.alloc(16),
                1000,
                16
            );
        });

        it('copies the parameters of a scrypt primary', async () => {
            const scryptDummy = getDummyVerifier({
                v: 1,
                kdf: 'scrypt',
                n: 1024,
                r: 8,
                p: 1,
                salt: 'aa',
                hash: 'bb'
            });
            expect(scryptDummy).toEqual({
                v: 1,
                kdf: 'scrypt',
                n: 1024,
                r: 8,
                p: 1,
                salt: '00',
                hash: '00'
            });
            expect(await verifySecret('1234', scryptDummy)).toBe(false);
        });

        it('falls back to DUMMY_VERIFIER without a well-formed primary', () => {
            expect(getDummyVerifier(undefined)).toBe(DUMMY_VERIFIER);
            expect(getDummyVerifier(null)).toBe(DUMMY_VERIFIER);
            expect(
                getDummyVerifier({
                    salt: '',
                    hash: ''
                } as unknown as VerifierRecord)
            ).toBe(DUMMY_VERIFIER);
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

    // A credential the verifier migration has not hashed yet: the migration
    // threw on this boot, or an older build wrote it after a downgrade
    describe('getPlaintextCredential', () => {
        it('returns a non-empty string and nothing else', () => {
            expect(getPlaintextCredential({ pin: '1234' }, 'pin')).toBe('1234');
            expect(getPlaintextCredential({ pin: '' }, 'pin')).toBeUndefined();
            expect(
                getPlaintextCredential({ pin: 1234 }, 'pin')
            ).toBeUndefined();
            expect(getPlaintextCredential({}, 'pin')).toBeUndefined();
            expect(getPlaintextCredential(undefined, 'pin')).toBeUndefined();
        });
    });

    describe('hasLockCredential', () => {
        it('counts a verifier or a plaintext credential for the method', async () => {
            const record = await deriveVerifier('1234', salt);
            expect(hasLockCredential({ pinVerifier: record }, 'pin')).toBe(
                true
            );
            expect(hasLockCredential({ pin: '1234' }, 'pin')).toBe(true);
            expect(
                hasLockCredential({ passphrase: 'open sesame' }, 'passphrase')
            ).toBe(true);
            expect(hasLockCredential({ pin: '1234' }, 'passphrase')).toBe(
                false
            );
            expect(hasLockCredential({ pin: '' }, 'pin')).toBe(false);
            expect(hasLockCredential({}, 'pin')).toBe(false);
            expect(hasLockCredential(undefined, 'pin')).toBe(false);
        });
    });

    describe('resolveLoginVerifiers', () => {
        it('passes stored records through without deriving', async () => {
            const primary = await deriveVerifier('1234', salt);
            const duress = await deriveVerifier('0000', salt);
            const derive = jest.spyOn(LockKdf, 'pbkdf2Sha256');

            expect(
                await resolveLoginVerifiers(
                    primary,
                    undefined,
                    duress,
                    undefined
                )
            ).toEqual({ primary, duress });
            expect(
                await resolveLoginVerifiers(
                    primary,
                    undefined,
                    undefined,
                    undefined
                )
            ).toEqual({ primary, duress: getDummyVerifier(primary) });
            expect(derive).not.toHaveBeenCalled();
        });

        it('hashes a plaintext primary and pairs it with a dummy duress record', async () => {
            const derive = jest.spyOn(LockKdf, 'pbkdf2Sha256');

            const result = await resolveLoginVerifiers(
                undefined,
                '1234',
                undefined,
                undefined
            );

            // the throwaway duress derivation keeps the count at two, as
            // with a duress credential set
            expect(derive).toHaveBeenCalledTimes(2);
            expect(await verifySecret('1234', result.primary)).toBe(true);
            expect(await verifySecret('0000', result.primary)).toBe(false);
            expect(result.duress).toEqual(getDummyVerifier(result.primary));
        });

        it('hashes a plaintext duress credential', async () => {
            const derive = jest.spyOn(LockKdf, 'pbkdf2Sha256');

            const result = await resolveLoginVerifiers(
                undefined,
                '1234',
                undefined,
                '0000'
            );

            expect(derive).toHaveBeenCalledTimes(2);
            expect(await verifySecret('0000', result.duress)).toBe(true);
            expect(await verifySecret('1234', result.duress)).toBe(false);
        });

        it('prefers the plaintext over a stored record for the same field', async () => {
            const stale = await deriveVerifier('1111', salt);

            const result = await resolveLoginVerifiers(
                stale,
                '2222',
                undefined,
                undefined
            );

            expect(await verifySecret('2222', result.primary)).toBe(true);
            expect(await verifySecret('1111', result.primary)).toBe(false);
        });

        it('keeps a stored duress record when only the primary is plaintext', async () => {
            const duress = await deriveVerifier('0000', salt);

            const result = await resolveLoginVerifiers(
                undefined,
                '1234',
                duress,
                undefined
            );

            expect(result.duress).toBe(duress);
        });

        it('rejects when the derivation fails', async () => {
            jest.spyOn(LockKdf, 'pbkdf2Sha256').mockRejectedValue(
                new Error('LockKdf native module unavailable')
            );

            await expect(
                resolveLoginVerifiers(undefined, '1234', undefined, undefined)
            ).rejects.toThrow('LockKdf native module unavailable');
        });
    });
});
