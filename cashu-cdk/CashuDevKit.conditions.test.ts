jest.mock('react-native', () => ({
    NativeModules: {
        CashuDevKitModule: {
            mint: jest.fn(),
            prepareSend: jest.fn(),
            confirmSend: jest.fn()
        }
    }
}));

import { NativeModules } from 'react-native';
import CashuDevKit from './CashuDevKit';
import { CDKSpendingConditions } from './types';

const native = NativeModules.CashuDevKitModule as {
    mint: jest.Mock;
    prepareSend: jest.Mock;
    confirmSend: jest.Mock;
};

const MINT = 'https://mint.example.com';
const PUBKEY =
    '02a9acc1e48c25eeeb9289b5031cc57da9fe72f3fe2861d264bdc074209b107ba2';
const HASH = 'ec4916dd28fc4c10d78e287ca5d9cc51ee1ae73cbfde08c6b37324cbfaac8bc5';

// The native bridges only convert P2PK conditions. Anything they cannot
// convert must fail here instead of reaching CDK as "no conditions", which
// would mint or send an unlocked bearer token.
const unsupported: Array<[string, any]> = [
    ['an HTLC condition', { kind: 'HTLC', data: { hash: HASH } }],
    ['an unknown kind', { kind: 'P2SH', data: { pubkey: PUBKEY } }],
    ['a missing kind', { data: { pubkey: PUBKEY } }],
    ['P2PK without data', { kind: 'P2PK' }],
    ['P2PK with null data', { kind: 'P2PK', data: null }],
    ['P2PK without a pubkey', { kind: 'P2PK', data: {} }],
    ['P2PK with an empty pubkey', { kind: 'P2PK', data: { pubkey: '' } }],
    ['P2PK with a non-string pubkey', { kind: 'P2PK', data: { pubkey: 2 } }],
    ['a non-object', 'P2PK']
];

const p2pk: CDKSpendingConditions = {
    kind: 'P2PK',
    data: { pubkey: PUBKEY, locktime: 1900000000 }
};

const sentOptions = () => JSON.parse(native.prepareSend.mock.calls[0][2]);

beforeEach(() => {
    jest.clearAllMocks();
    native.mint.mockResolvedValue('[]');
    native.prepareSend.mockResolvedValue(
        JSON.stringify({ id: 'op1', amount: 1000, fee: 0 })
    );
    native.confirmSend.mockResolvedValue(
        JSON.stringify({ encoded: 'cashuBtoken' })
    );
});

describe('CashuDevKit.mint spending conditions', () => {
    it.each(unsupported)('rejects %s', async (_label, conditions) => {
        await expect(
            CashuDevKit.mint(MINT, 'quote1', conditions)
        ).rejects.toMatchObject({ message: expect.any(String) });
        expect(native.mint).not.toHaveBeenCalled();
    });

    it('names the unsupported kind', async () => {
        await expect(
            CashuDevKit.mint(MINT, 'quote1', {
                kind: 'HTLC',
                data: { hash: HASH }
            })
        ).rejects.toMatchObject({
            message: 'Unsupported spending condition kind: HTLC'
        });
    });

    it('forwards P2PK conditions unchanged', async () => {
        await CashuDevKit.mint(MINT, 'quote1', p2pk);

        expect(native.mint).toHaveBeenCalledWith(
            MINT,
            'quote1',
            JSON.stringify(p2pk)
        );
    });

    it('mints without conditions when none are given', async () => {
        await CashuDevKit.mint(MINT, 'quote1');

        expect(native.mint).toHaveBeenCalledWith(MINT, 'quote1', undefined);
    });
});

describe('CashuDevKit.send spending conditions', () => {
    it.each(unsupported)('rejects %s', async (_label, conditions) => {
        await expect(
            CashuDevKit.send(MINT, 1000, undefined, conditions)
        ).rejects.toMatchObject({ message: expect.any(String) });
        expect(native.prepareSend).not.toHaveBeenCalled();
        expect(native.confirmSend).not.toHaveBeenCalled();
    });

    it('forwards P2PK conditions unchanged', async () => {
        const token = await CashuDevKit.send(MINT, 1000, 'lunch', p2pk);

        expect(native.prepareSend).toHaveBeenCalledWith(
            MINT,
            1000,
            expect.any(String)
        );
        expect(sentOptions().conditions).toEqual(p2pk);
        expect(native.confirmSend).toHaveBeenCalledWith('op1', 'lunch');
        expect(token.encoded).toBe('cashuBtoken');
    });

    it('sends without conditions when none are given', async () => {
        await CashuDevKit.send(MINT, 1000);

        expect(sentOptions()).not.toHaveProperty('conditions');
        expect(native.confirmSend).toHaveBeenCalledWith('op1', undefined);
    });
});
