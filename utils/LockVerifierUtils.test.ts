// The native randombytes module cannot init under jest; back it with node crypto.
jest.mock('react-native-randombytes', () => ({
    randomBytes: (length: number) => require('crypto').randomBytes(length)
}));

import {
    deriveVerifier,
    verifySecret,
    hasVerifier,
    VerifierRecord
} from './LockVerifierUtils';

describe('LockVerifierUtils', () => {
    // Fixed salt so the scrypt output is deterministic where we need it.
    const salt = Buffer.alloc(16, 0x01);

    describe('deriveVerifier', () => {
        it('produces a well-formed scrypt record and never stores the secret', async () => {
            const record = await deriveVerifier('1234', salt);
            expect(record.v).toEqual(1);
            expect(record.kdf).toEqual('scrypt');
            expect(record.n).toBeGreaterThan(0);
            expect(record.salt).toEqual(salt.toString('hex'));
            expect(record.hash).toMatch(/^[0-9a-f]{64}$/);
            expect(JSON.stringify(record)).not.toContain('1234');
        });

        it('uses a fresh random salt per call', async () => {
            const a = await deriveVerifier('1234');
            const b = await deriveVerifier('1234');
            expect(a.salt).not.toEqual(b.salt);
            expect(a.hash).not.toEqual(b.hash);
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
                    kdf: 'scrypt',
                    n: 0,
                    r: 0,
                    p: 0,
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
        });
    });
});
