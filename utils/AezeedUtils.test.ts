// Golden vectors generated with lnd v0.19.2-beta Go code:
// aezeed.CipherSeed.ToMnemonic / Mnemonic.ToCipherSeed for the entropy, and
// hdkeychain.NewMaster(entropy) derived along m/1017'/coinType'/6'/0/0 (lnd's
// node identity key, keychain.KeyFamilyNodeKey) for the node ids. This pins
// the exact derivation DataClearUtils relies on to locate the legacy
// '<pubkey>-extended-private-keys' keychain entry from a wallet's seed.

import {
    decodeAezeedEntropy,
    deriveEmbeddedNodeId,
    deriveNodeIdFromEntropy
} from './AezeedUtils';

const MNEMONIC = (
    'absorb spawn orbit course shock genuine fitness speak horn entry ' +
    'bean narrow leader amateur fatigue utility hard cactus abandon ' +
    'abandon abandon feature hurdle rate'
).split(' ');

const ENTROPY_HEX = '00070e151c232a31383f464d545b6269';
const NODE_ID_MAINNET =
    '020b4e17f82873d40c1abff7a9140b6a56c04a845e1abe6ab71ef3269836d47abd';
const NODE_ID_TESTNET =
    '03b3447cd5aadff1b93dc1eec5124738e22378dc9eb5ab9f5378477534d1acb037';

// scrypt (N=32768) runs for real in these tests
jest.setTimeout(30000);

describe('decodeAezeedEntropy', () => {
    it('decrypts an lnd-generated aezeed mnemonic to its entropy', async () => {
        const entropy = await decodeAezeedEntropy(MNEMONIC);
        expect(entropy.toString('hex')).toBe(ENTROPY_HEX);
    });

    it('rejects a mnemonic with a bad checksum', async () => {
        const tampered = [...MNEMONIC];
        tampered[0] = 'ability';
        await expect(decodeAezeedEntropy(tampered)).rejects.toThrow(
            'Invalid seed checksum!'
        );
    });
});

describe('deriveNodeIdFromEntropy', () => {
    const entropy = Buffer.from(ENTROPY_HEX, 'hex');

    it('derives the mainnet node identity pubkey (coin type 0)', () => {
        expect(deriveNodeIdFromEntropy(entropy, false)).toBe(NODE_ID_MAINNET);
    });

    it('derives the testnet node identity pubkey (coin type 1)', () => {
        expect(deriveNodeIdFromEntropy(entropy, true)).toBe(NODE_ID_TESTNET);
    });
});

describe('deriveEmbeddedNodeId', () => {
    it('derives the node id straight from the mnemonic', async () => {
        const nodeId = await deriveEmbeddedNodeId(MNEMONIC, false);
        expect(nodeId).toBe(NODE_ID_MAINNET);
    });
});
