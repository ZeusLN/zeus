jest.mock('../cashu-cdk', () => ({
    __esModule: true,
    default: { decodePaymentRequest: jest.fn() }
}));

import { decode as cborDecode } from 'cborg';
import CashuDevKit from '../cashu-cdk';
import Base64Utils from './Base64Utils';
import {
    isCREQ,
    encodeCREQ,
    decodeCREQ,
    creqPaymentError,
    mintUrlKey,
    findCompatibleMint,
    tokenRequestMismatch
} from './CREQUtils';
import type { CREQParams } from './CREQUtils';

const decodePaymentRequest = CashuDevKit.decodePaymentRequest as jest.Mock;

const cborOf = (creq: string) =>
    cborDecode(
        Base64Utils.base64ToBytes(Base64Utils.base64UrlToBase64(creq.slice(5)))
    );

// Example from NUT-18
const NUT18_EXAMPLE =
    'creqApWF0gaNhdGVub3N0cmFheKlucHJvZmlsZTFxeTI4d3VtbjhnaGo3dW45ZDNzaGp0bnl2OWtoMnVld2Q5aHN6OW1od2RlbjV0ZTB3ZmprY2N0ZTljdXJ4dmVuOWVlaHFjdHJ2NWhzenJ0aHdkZW41dGUwZGVoaHh0bnZkYWtxcWd5ZGFxeTdjdXJrNDM5eWtwdGt5c3Y3dWRoZGh1NjhzdWNtMjk1YWtxZWZkZWhrZjBkNDk1Y3d1bmw1YWeBgmFuYjE3YWloYjdhOTAxNzZhYQphdWNzYXRhbYF4Imh0dHBzOi8vbm9mZWVzLnRlc3RudXQuY2FzaHUuc3BhY2U=';

describe('CREQUtils', () => {
    describe('isCREQ', () => {
        it('accepts NUT-18 creqA requests', () => {
            expect(isCREQ('creqAoWFhZA')).toBe(true);
        });

        it('accepts NUT-26 creqb requests in either case', () => {
            expect(isCREQ('creqb1qyqqse3cv93kydenvgpq')).toBe(true);
            expect(isCREQ('CREQB1QYQQSE3CV93KYDENVGPQ')).toBe(true);
        });

        it('rejects other strings', () => {
            expect(isCREQ('lnbc1234')).toBe(false);
            expect(isCREQ('cashuA')).toBe(false);
            // base64url is case-sensitive, so the A must be uppercase
            expect(isCREQ('creqaoWFhZA')).toBe(false);
            expect(isCREQ('creqB')).toBe(false);
            expect(isCREQ('')).toBe(false);
        });
    });

    describe('encodeCREQ', () => {
        it('encodes the NUT-18 example to the same CBOR map', () => {
            const encoded = encodeCREQ({
                id: 'b7a90176',
                amount: 10,
                unit: 'sat',
                mints: ['https://nofees.testnut.cashu.space'],
                transports: [
                    {
                        t: 'nostr',
                        a: 'nprofile1qy28wumn8ghj7un9d3shjtnyv9kh2uewd9hsz9mhwden5te0wfjkccte9curxven9eehqctrv5hszrthwden5te0dehhxtnvdakqqgydaqy7curk439ykptkysv7udhdhu68sucm295akqefdehkf0d495cwunl5',
                        g: [['n', '17']]
                    }
                ]
            });

            expect(encoded.startsWith('creqA')).toBe(true);
            expect(cborOf(encoded)).toEqual(cborOf(NUT18_EXAMPLE));
        });

        it('leaves out unset fields', () => {
            expect(cborOf(encodeCREQ({ amount: 100, unit: 'sat' }))).toEqual({
                a: 100,
                u: 'sat'
            });
            expect(cborOf(encodeCREQ({}))).toEqual({});
        });

        it('produces url-safe base64 (no +, /, or =)', () => {
            const encoded = encodeCREQ({
                amount: 999999,
                unit: 'sat',
                mints: ['https://mint.example.com/long/path/to/force/padding'],
                description:
                    'A longer description to produce more base64 output characters'
            });

            expect(encoded.slice(5)).not.toMatch(/[+/=]/);
        });
    });

    describe('decodeCREQ', () => {
        beforeEach(() => decodePaymentRequest.mockReset());

        it('maps the CDK request to CREQ params', async () => {
            decodePaymentRequest.mockResolvedValue({
                payment_id: 'b7a90176',
                amount: 10,
                unit: 'sat',
                single_use: true,
                description: 'Coffee',
                mints: ['https://mint.example.com'],
                transports: [
                    {
                        type: 'nostr',
                        target: 'nprofile1abc',
                        tags: [['n', '17']]
                    },
                    { type: 'post', target: 'https://example.com', tags: [] }
                ]
            });

            await expect(decodeCREQ('CREQB1QYQQ')).resolves.toEqual({
                id: 'b7a90176',
                amount: 10,
                unit: 'sat',
                singleUse: true,
                description: 'Coffee',
                mints: ['https://mint.example.com'],
                transports: [
                    { t: 'nostr', a: 'nprofile1abc', g: [['n', '17']] },
                    { t: 'post', a: 'https://example.com' }
                ]
            });
            expect(decodePaymentRequest).toHaveBeenCalledWith('CREQB1QYQQ');
        });

        it('leaves empty mint and transport lists out', async () => {
            decodePaymentRequest.mockResolvedValue({
                amount: 21,
                unit: 'sat',
                mints: [],
                transports: []
            });

            await expect(decodeCREQ('creqAoWFhZA')).resolves.toEqual({
                amount: 21,
                unit: 'sat'
            });
        });

        it('rejects strings without a CREQ prefix before calling CDK', async () => {
            await expect(decodeCREQ('invalid')).rejects.toThrow(
                'Invalid CREQ: missing prefix'
            );
            expect(decodePaymentRequest).not.toHaveBeenCalled();
        });

        it('passes on CDK decode errors', async () => {
            decodePaymentRequest.mockRejectedValue(new Error('Invalid prefix'));
            await expect(decodeCREQ('creqA!!!')).rejects.toThrow(
                'Invalid prefix'
            );
        });
    });

    describe('creqPaymentError', () => {
        it.each([
            [{ unit: 'sat' }],
            [{ amount: 0, unit: 'sat' }],
            [{ amount: -5, unit: 'sat' }],
            [{ amount: 1.5, unit: 'sat' }]
        ])('needs a positive whole amount: %j', (params: CREQParams) => {
            expect(creqPaymentError(params)).toBe(
                'views.Cashu.CREQPayment.noAmount'
            );
        });

        it.each(['msat', 'usd', undefined])(
            'refuses requests in %s, which would be paid as sats',
            (unit) => {
                expect(creqPaymentError({ amount: 21000, unit })).toBe(
                    'views.Cashu.CREQPayment.unsupportedUnit'
                );
            }
        );

        it.each(['sat', 'SAT'])('accepts %s requests', (unit) => {
            expect(creqPaymentError({ amount: 21, unit })).toBeUndefined();
        });
    });

    describe('mintUrlKey', () => {
        it('drops trailing slashes and lowercases scheme and host', () => {
            expect(mintUrlKey('HTTPS://Mint.Example.com/')).toBe(
                'https://mint.example.com'
            );
        });

        it('keeps the path case', () => {
            expect(mintUrlKey('https://mint.example.com/Cashu/')).toBe(
                'https://mint.example.com/Cashu'
            );
        });
    });

    describe('findCompatibleMint', () => {
        const mintUrls = ['https://a.example.com', 'https://b.example.com'];
        const mintBalances = {
            'https://a.example.com': 10,
            'https://b.example.com': 500
        };

        it('matches listed mints spelled differently and returns the wallet URL', () => {
            expect(
                findCompatibleMint(
                    { amount: 100, mints: ['HTTPS://B.example.com/'] },
                    mintUrls,
                    mintBalances,
                    'https://a.example.com'
                )
            ).toBe('https://b.example.com');
        });

        it('uses only listed mints', () => {
            expect(
                findCompatibleMint(
                    { amount: 100, mints: ['https://a.example.com'] },
                    mintUrls,
                    mintBalances,
                    'https://b.example.com'
                )
            ).toBeUndefined();
        });

        it('prefers the selected mint when the request lists none', () => {
            expect(
                findCompatibleMint(
                    { amount: 5 },
                    mintUrls,
                    mintBalances,
                    'https://a.example.com'
                )
            ).toBe('https://a.example.com');
        });

        it('falls back to any mint with enough balance', () => {
            expect(
                findCompatibleMint(
                    { amount: 100 },
                    mintUrls,
                    mintBalances,
                    'https://a.example.com'
                )
            ).toBe('https://b.example.com');
        });
    });

    describe('tokenRequestMismatch', () => {
        const request = { amount: 21, mintUrl: 'https://mint.example.com' };

        it('accepts a sat token from the requested mint for at least the amount', () => {
            expect(
                tokenRequestMismatch(
                    {
                        value: 21,
                        mint_url: 'https://Mint.example.com/',
                        unit: 'sat'
                    },
                    request
                )
            ).toBeUndefined();
        });

        it('refuses a token from another mint', () => {
            expect(
                tokenRequestMismatch(
                    { value: 21, mint_url: 'https://other.example.com' },
                    request
                )
            ).toBe('views.Cashu.ReceiveEcash.creqWrongMint');
        });

        it('refuses a token for less than the amount', () => {
            expect(
                tokenRequestMismatch(
                    { value: 20, mint_url: 'https://mint.example.com' },
                    request
                )
            ).toBe('views.Cashu.ReceiveEcash.creqUnderpaid');
        });

        it('refuses a token in another unit', () => {
            expect(
                tokenRequestMismatch(
                    {
                        value: 21000,
                        mint_url: 'https://mint.example.com',
                        unit: 'msat'
                    },
                    request
                )
            ).toBe('views.Cashu.CREQPayment.unsupportedUnit');
        });
    });
});
