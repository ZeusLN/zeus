import { randomBytes } from './RandomUtils';

describe('RandomUtils', () => {
    describe('randomBytes', () => {
        it('returns a Buffer of the requested length', () => {
            const bytes = randomBytes(32);
            expect(Buffer.isBuffer(bytes)).toBe(true);
            expect(bytes.length).toBe(32);
            expect(randomBytes(0).length).toBe(0);
        });

        it('returns fresh values on every call', () => {
            const a = randomBytes(32);
            const b = randomBytes(32);
            expect(a.equals(b)).toBe(false);
        });

        it('does not return all-zero output', () => {
            const bytes = randomBytes(64);
            expect(bytes.some((byte) => byte !== 0)).toBe(true);
        });
    });
});
