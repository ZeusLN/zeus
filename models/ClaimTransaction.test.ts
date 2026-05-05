import {
    SubmarineClaimTransaction,
    ReverseClaimTransaction
} from './ClaimTransaction';
import type Swap from './Swap';

beforeAll(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
    jest.restoreAllMocks();
});

const submarineSwap = (overrides: Partial<Swap> = {}): Swap =>
    ({
        id: 'swap-id-123',
        keys: { __D: [1, 2, 3, 4] },
        swapTreeDetails: {
            claimLeaf: { output: 'claim-leaf' },
            refundLeaf: { output: 'refund-leaf' }
        },
        servicePubKey: 'service-pubkey',
        ...overrides
    } as unknown as Swap);

const reverseSwap = (overrides: Partial<Swap> = {}): Swap =>
    ({
        id: 'swap-id-456',
        keys: { __D: [10, 20, 30] },
        swapTreeDetails: {
            claimLeaf: { output: 'claim-leaf' },
            refundLeaf: { output: 'refund-leaf' }
        },
        refundPubKey: 'refund-pubkey',
        effectiveLockupAddress: 'lockup-address',
        destinationAddress: 'destination-address',
        preimage: { type: 'Buffer', data: [0xab, 0xcd] },
        ...overrides
    } as unknown as Swap);

const submarineDefaults = {
    endpoint: 'https://swaps.zeuslsp.com/api/v2',
    claimTxDetails: { transactionHash: 'tx-hash', pubNonce: 'nonce' }
};

const reverseDefaults = {
    endpoint: 'https://swaps.zeuslsp.com/api/v2',
    transactionHex: 'tx-hex',
    feeRate: 2,
    minerFee: 100,
    isTestnet: false
};

describe('SubmarineClaimTransaction.build', () => {
    it('builds a fully populated claim from a complete swap', () => {
        const claim = SubmarineClaimTransaction.build({
            swap: submarineSwap(),
            ...submarineDefaults
        });

        expect(claim).toBeInstanceOf(SubmarineClaimTransaction);
        expect(claim).toMatchObject({
            endpoint: 'https://swaps.zeuslsp.com/api/v2',
            swapId: 'swap-id-123',
            claimLeaf: 'claim-leaf',
            refundLeaf: 'refund-leaf',
            privateKey: '01020304',
            servicePubKey: 'service-pubkey',
            transactionHash: 'tx-hash',
            pubNonce: 'nonce'
        });
    });

    it.each([
        ['keys is null', { keys: null }],
        ['__D is missing', { keys: {} }],
        [
            'claim leaf is missing',
            { swapTreeDetails: { refundLeaf: { output: 'r' } } }
        ],
        [
            'refund leaf is missing',
            { swapTreeDetails: { claimLeaf: { output: 'c' } } }
        ],
        ['servicePubKey is unavailable', { servicePubKey: undefined }]
    ])('returns null when %s', (_, overrides) => {
        const claim = SubmarineClaimTransaction.build({
            swap: submarineSwap(overrides),
            ...submarineDefaults
        });
        expect(claim).toBeNull();
    });
});

describe('ReverseClaimTransaction.build', () => {
    it('builds a fully populated claim from a complete swap', () => {
        const claim = ReverseClaimTransaction.build({
            swap: reverseSwap(),
            ...reverseDefaults
        });

        expect(claim).toBeInstanceOf(ReverseClaimTransaction);
        expect(claim).toMatchObject({
            endpoint: 'https://swaps.zeuslsp.com/api/v2',
            swapId: 'swap-id-456',
            claimLeaf: 'claim-leaf',
            refundLeaf: 'refund-leaf',
            privateKey: '0a141e',
            servicePubKey: 'refund-pubkey',
            preimageHex: 'abcd',
            transactionHex: 'tx-hex',
            lockupAddress: 'lockup-address',
            destinationAddress: 'destination-address',
            feeRate: 2,
            minerFee: 100,
            isTestnet: false
        });
    });

    it.each([
        ['keys is null', { keys: null }],
        ['__D is missing', { keys: {} }],
        [
            'claim leaf is missing',
            { swapTreeDetails: { refundLeaf: { output: 'r' } } }
        ],
        [
            'refund leaf is missing',
            { swapTreeDetails: { claimLeaf: { output: 'c' } } }
        ],
        ['refundPubKey is unavailable', { refundPubKey: undefined }],
        ['lockupAddress is unavailable', { effectiveLockupAddress: undefined }],
        ['destinationAddress is missing', { destinationAddress: undefined }]
    ])('returns null when %s', (_, overrides) => {
        const claim = ReverseClaimTransaction.build({
            swap: reverseSwap(overrides),
            ...reverseDefaults
        });
        expect(claim).toBeNull();
    });
});

describe('private key deserialization (via SubmarineClaimTransaction.build)', () => {
    const buildWith = (keys: any) =>
        SubmarineClaimTransaction.build({
            swap: submarineSwap({ keys }),
            ...submarineDefaults
        });

    it('handles a plain number[] (fresh swap)', () => {
        expect(buildWith({ __D: [1, 2, 3, 4] })?.privateKey).toBe('01020304');
    });

    it('handles a { data: number[] } shape (rehydrated swap)', () => {
        expect(buildWith({ __D: { data: [1, 2, 3, 4] } })?.privateKey).toBe(
            '01020304'
        );
    });

    it('handles a JSON-round-tripped Buffer', () => {
        const rehydrated = JSON.parse(
            JSON.stringify(Buffer.from([0x0a, 0x0b, 0x0c, 0x0d]))
        );
        expect(buildWith({ __D: rehydrated })?.privateKey).toBe('0a0b0c0d');
    });

    it.each([
        ['null', null],
        ['undefined', undefined],
        ['no __D', {}],
        ['__D as a string', { __D: 'oops' }],
        ['__D as a number', { __D: 42 }],
        ['__D object without data', { __D: { something: 'else' } }]
    ])('returns null for %s keys', (_, keys) => {
        expect(buildWith(keys)).toBeNull();
    });
});

describe('preimage deserialization (via ReverseClaimTransaction.build)', () => {
    const buildWith = (preimage: any) =>
        ReverseClaimTransaction.build({
            swap: reverseSwap({ preimage }),
            ...reverseDefaults
        });

    it('passes a hex string through unchanged', () => {
        expect(buildWith('0a0b0c0d')?.preimageHex).toBe('0a0b0c0d');
    });

    it('converts a Buffer to hex', () => {
        expect(
            buildWith(Buffer.from([0x0a, 0x0b, 0x0c, 0x0d]))?.preimageHex
        ).toBe('0a0b0c0d');
    });

    it('converts a { data: number[] } shape to hex', () => {
        expect(buildWith({ data: [0x0a, 0x0b, 0x0c, 0x0d] })?.preimageHex).toBe(
            '0a0b0c0d'
        );
    });

    it('converts a JSON-round-tripped Buffer to hex', () => {
        const rehydrated = JSON.parse(
            JSON.stringify(Buffer.from([0x0a, 0x0b, 0x0c, 0x0d]))
        );
        expect(buildWith(rehydrated)?.preimageHex).toBe('0a0b0c0d');
    });

    it.each([
        ['null', null],
        ['undefined', undefined]
    ])('falls back to empty string for %s preimage', (_, preimage) => {
        expect(buildWith(preimage)?.preimageHex).toBe('');
    });
});
