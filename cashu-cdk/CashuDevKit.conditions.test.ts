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
import { CDKErrorType, CDKSpendingConditions } from './types';

const native = NativeModules.CashuDevKitModule as {
    mint: jest.Mock;
    prepareSend: jest.Mock;
    confirmSend: jest.Mock;
};

const MINT = 'https://mint.example.com';
const PUBKEY =
    '02a9acc1e48c25eeeb9289b5031cc57da9fe72f3fe2861d264bdc074209b107ba2';
const HASH = 'ec4916dd28fc4c10d78e287ca5d9cc51ee1ae73cbfde08c6b37324cbfaac8bc5';

const NO_PUBKEY = 'P2PK spending conditions require a pubkey';
const kindError = (kind: string) =>
    `Unsupported spending condition kind: ${kind}`;

// The native bridges only convert P2PK conditions. Anything they cannot
// convert must fail here instead of reaching CDK as "no conditions", which
// would mint or send an unlocked bearer token. Each case names the message
// it must fail with, so a TypeError from a missing check cannot pass.
const unsupported: Array<[string, any, string]> = [
    [
        'an HTLC condition',
        { kind: 'HTLC', data: { hash: HASH } },
        kindError('HTLC')
    ],
    [
        'an unknown kind',
        { kind: 'P2SH', data: { pubkey: PUBKEY } },
        kindError('P2SH')
    ],
    ['a missing kind', { data: { pubkey: PUBKEY } }, kindError('undefined')],
    ['P2PK without data', { kind: 'P2PK' }, NO_PUBKEY],
    ['P2PK with null data', { kind: 'P2PK', data: null }, NO_PUBKEY],
    ['P2PK without a pubkey', { kind: 'P2PK', data: {} }, NO_PUBKEY],
    [
        'P2PK with an empty pubkey',
        { kind: 'P2PK', data: { pubkey: '' } },
        NO_PUBKEY
    ],
    [
        'P2PK with a non-string pubkey',
        { kind: 'P2PK', data: { pubkey: 2 } },
        NO_PUBKEY
    ],
    ['a non-object', 'P2PK', kindError('undefined')],
    ...invalidP2PKFields()
];

// Present but invalid optional P2PK fields, and unknown fields, must be
// refused, not dropped.
function invalidP2PKFields(): Array<[string, any, string]> {
    const withData = (extra: object) => ({
        kind: 'P2PK',
        data: { pubkey: PUBKEY, ...extra }
    });
    const entries = (key: string) => `${key} entries must be non-empty strings`;
    const notArray = (key: string) => `${key} must be an array`;
    const notInt = (key: string) => `${key} must be a non-negative integer`;
    return [
        [
            'a null pubkeys entry',
            withData({ pubkeys: [PUBKEY, null] }),
            entries('pubkeys')
        ],
        [
            'a numeric pubkeys entry',
            withData({ pubkeys: [2] }),
            entries('pubkeys')
        ],
        [
            'an empty pubkeys entry',
            withData({ pubkeys: [''] }),
            entries('pubkeys')
        ],
        [
            'pubkeys with holes',
            withData({ pubkeys: new Array(2) }),
            entries('pubkeys')
        ],
        [
            'pubkeys that are not an array',
            withData({ pubkeys: PUBKEY }),
            notArray('pubkeys')
        ],
        [
            'a null refund_keys entry',
            withData({ refund_keys: [null] }),
            entries('refund_keys')
        ],
        [
            'refund_keys with holes',
            withData({ refund_keys: new Array(2) }),
            entries('refund_keys')
        ],
        [
            'refund_keys that are not an array',
            withData({ refund_keys: {} }),
            notArray('refund_keys')
        ],
        ['a negative locktime', withData({ locktime: -1 }), notInt('locktime')],
        [
            'a fractional locktime',
            withData({ locktime: 1.5 }),
            notInt('locktime')
        ],
        [
            'a non-numeric locktime string',
            withData({ locktime: 'soon' }),
            notInt('locktime')
        ],
        [
            'a boolean num_sigs',
            withData({ num_sigs: true }),
            notInt('num_sigs')
        ],
        [
            'an object num_sigs_refund',
            withData({ num_sigs_refund: {} }),
            notInt('num_sigs_refund')
        ],
        [
            'an unknown sig_flag',
            withData({ sig_flag: 'SigNone' }),
            'Unsupported sig_flag: SigNone'
        ],
        [
            'a numeric sig_flag',
            withData({ sig_flag: 1 }),
            'Unsupported sig_flag: 1'
        ],
        [
            'a camelCase numSigs',
            withData({ pubkeys: [PUBKEY], numSigs: 2 }),
            'Unsupported P2PK field: numSigs'
        ],
        [
            'an unknown field set to null',
            withData({ refundKeys: null }),
            'Unsupported P2PK field: refundKeys'
        ]
    ];
}

// Thrown before the native call, outside mapCDKError, which would read
// "spending" as "pending"
const rejection = (message: string) => ({
    type: CDKErrorType.Generic,
    message
});

const p2pk: CDKSpendingConditions = {
    kind: 'P2PK',
    data: { pubkey: PUBKEY, locktime: 1900000000 }
};

// Every optional field set to a value the native parsers accept
const fullP2PK: any = {
    kind: 'P2PK',
    data: {
        pubkey: PUBKEY,
        locktime: '1900000000',
        pubkeys: [PUBKEY],
        refund_keys: [PUBKEY],
        num_sigs: 2,
        num_sigs_refund: 0,
        sig_flag: 'SigAll'
    }
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
    it.each(unsupported)('rejects %s', async (_label, conditions, message) => {
        await expect(
            CashuDevKit.mint(MINT, 'quote1', conditions)
        ).rejects.toEqual(rejection(message));
        expect(native.mint).not.toHaveBeenCalled();
    });

    it('forwards P2PK conditions unchanged', async () => {
        await CashuDevKit.mint(MINT, 'quote1', p2pk);

        expect(native.mint).toHaveBeenCalledWith(
            MINT,
            'quote1',
            JSON.stringify(p2pk)
        );
    });

    it('forwards P2PK conditions with every optional field set', async () => {
        await CashuDevKit.mint(MINT, 'quote1', fullP2PK);

        expect(native.mint).toHaveBeenCalledWith(
            MINT,
            'quote1',
            JSON.stringify(fullP2PK)
        );
    });

    it.each([null, undefined])(
        'ignores optional fields set to %s',
        async (value) => {
            const conditions: any = {
                kind: 'P2PK',
                data: {
                    pubkey: PUBKEY,
                    locktime: value,
                    pubkeys: value,
                    refund_keys: value,
                    num_sigs: value,
                    num_sigs_refund: value,
                    sig_flag: value
                }
            };

            await CashuDevKit.mint(MINT, 'quote1', conditions);

            expect(native.mint).toHaveBeenCalledTimes(1);
        }
    );

    it('mints without conditions when none are given', async () => {
        await CashuDevKit.mint(MINT, 'quote1');

        expect(native.mint).toHaveBeenCalledWith(MINT, 'quote1', undefined);
    });
});

describe('CashuDevKit.send spending conditions', () => {
    it.each(unsupported)('rejects %s', async (_label, conditions, message) => {
        await expect(
            CashuDevKit.send(MINT, 1000, undefined, conditions)
        ).rejects.toEqual(rejection(message));
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
