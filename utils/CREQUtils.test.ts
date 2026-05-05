import { isCREQ, encodeCREQ, decodeCREQ } from './CREQUtils';
import type { CREQParams } from './CREQUtils';

describe('CREQUtils', () => {
    describe('isCREQ', () => {
        it('returns true for valid CREQ strings', () => {
            expect(isCREQ('creqAoWFhZA')).toBe(true);
        });

        it('returns false for non-CREQ strings', () => {
            expect(isCREQ('lnbc1234')).toBe(false);
            expect(isCREQ('cashuA')).toBe(false);
            expect(isCREQ('creqB')).toBe(false);
            expect(isCREQ('')).toBe(false);
        });
    });

    describe('encodeCREQ / decodeCREQ round-trip', () => {
        it('round-trips a minimal payment request', () => {
            const params: CREQParams = {
                amount: 100,
                unit: 'sat'
            };

            const encoded = encodeCREQ(params);
            expect(encoded.startsWith('creqA')).toBe(true);

            const decoded = decodeCREQ(encoded);
            expect(decoded.amount).toBe(100);
            expect(decoded.unit).toBe('sat');
        });

        it('round-trips a full payment request', () => {
            const params: CREQParams = {
                id: 'pay123',
                amount: 21000,
                unit: 'sat',
                singleUse: true,
                mints: [
                    'https://mint.example.com',
                    'https://mint2.example.com'
                ],
                description: 'Coffee payment'
            };

            const encoded = encodeCREQ(params);
            const decoded = decodeCREQ(encoded);

            expect(decoded.id).toBe('pay123');
            expect(decoded.amount).toBe(21000);
            expect(decoded.unit).toBe('sat');
            expect(decoded.singleUse).toBe(true);
            expect(decoded.mints).toEqual([
                'https://mint.example.com',
                'https://mint2.example.com'
            ]);
            expect(decoded.description).toBe('Coffee payment');
        });

        it('round-trips transports', () => {
            const params: CREQParams = {
                amount: 500,
                unit: 'sat',
                transports: [
                    {
                        t: 'nostr',
                        a: 'nprofile1abc',
                        g: [['relays', 'wss://relay.example.com']]
                    },
                    {
                        t: 'post',
                        a: 'https://example.com/pay'
                    }
                ]
            };

            const encoded = encodeCREQ(params);
            const decoded = decodeCREQ(encoded);

            expect(decoded.transports).toHaveLength(2);
            expect(decoded.transports![0].t).toBe('nostr');
            expect(decoded.transports![0].a).toBe('nprofile1abc');
            expect(decoded.transports![0].g).toEqual([
                ['relays', 'wss://relay.example.com']
            ]);
            expect(decoded.transports![1].t).toBe('post');
            expect(decoded.transports![1].a).toBe('https://example.com/pay');
            expect(decoded.transports![1].g).toBeUndefined();
        });

        it('round-trips an empty payment request', () => {
            const params: CREQParams = {};
            const encoded = encodeCREQ(params);
            const decoded = decodeCREQ(encoded);

            expect(decoded.amount).toBeUndefined();
            expect(decoded.unit).toBeUndefined();
            expect(decoded.mints).toBeUndefined();
            expect(decoded.description).toBeUndefined();
            expect(decoded.transports).toBeUndefined();
        });
    });

    describe('decodeCREQ', () => {
        it('throws on invalid prefix', () => {
            expect(() => decodeCREQ('invalid')).toThrow(
                'Invalid CREQ: missing prefix'
            );
        });

        it('throws on malformed base64', () => {
            expect(() => decodeCREQ('creqA!!!invalid')).toThrow();
        });
    });

    describe('encodeCREQ output format', () => {
        it('produces url-safe base64 (no +, /, or =)', () => {
            const params: CREQParams = {
                amount: 999999,
                unit: 'sat',
                mints: ['https://mint.example.com/long/path/to/force/padding'],
                description:
                    'A longer description to produce more base64 output characters'
            };

            const encoded = encodeCREQ(params);
            const payload = encoded.slice(5); // strip "creqA"

            expect(payload).not.toMatch(/[+/=]/);
        });
    });
});
