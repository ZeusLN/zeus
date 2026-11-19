jest.mock('react-native-randombytes', () => ({
    randomBytes: (size: number) => Buffer.alloc(size, 0)
}));
jest.mock('react-native-blob-util', () => ({ fetch: jest.fn() }));
jest.mock('../utils/UrlUtils', () => ({ getMempoolApiUrl: jest.fn() }));
jest.mock('../utils/ErrorUtils', () => ({
    errorToUserFriendly: (e: any) => e?.message ?? String(e)
}));
jest.mock('../stores/Stores', () => ({ alertStore: {} }));
// TransactionsStore imports BackendUtils, which pulls in LND → TorUtils →
// react-native-nitro-tor (ESM). Mock BackendUtils so Jest never loads it.
jest.mock('../utils/BackendUtils', () => ({ __esModule: true, default: {} }));

// The real bitcoinjs-lib, so these cases pin how its PSBT finalizer and
// extractor treat the UTXO data of an externally signed PSBT.
import * as bitcoin from 'bitcoinjs-lib';

import TransactionsStore from './TransactionsStore';
import ecc from '../zeus_modules/noble_ecc';

const network = bitcoin.networks.regtest;

const keyFor = (n: number) => {
    const privateKey = Buffer.alloc(32, 0);
    privateKey[31] = n;
    const publicKey = Buffer.from(ecc.pointFromScalar(privateKey, true)!);
    return {
        publicKey,
        sign: (hash: Buffer) => Buffer.from(ecc.sign(hash, privateKey))
    };
};

const signer = keyFor(1);
const inputScript = bitcoin.payments.p2wpkh({
    pubkey: signer.publicKey,
    network
}).output!;
const destination = bitcoin.payments.p2wpkh({
    pubkey: keyFor(2).publicKey,
    network
}).address!;

const fundingTx = (value: number, prevoutByte = 1) => {
    const tx = new bitcoin.Transaction();
    tx.version = 2;
    tx.addInput(Buffer.alloc(32, prevoutByte), 0);
    tx.addOutput(inputScript, value);
    return tx;
};

// Spends output 0 of a funding tx worth `inputValue` to `destination`,
// signed but not finalized, the way an external signer hands it back.
// Choose the UTXO fields up front: addInput turns nonWitnessUtxo into a
// cached accessor, so deleting it afterwards does not remove it.
const signedPsbt = (
    inputValue: number,
    outputValue: number,
    { witnessUtxo = true, nonWitnessUtxo = true } = {}
) => {
    const funding = fundingTx(inputValue);
    const psbt = new bitcoin.Psbt({ network });
    psbt.addInput({
        hash: funding.getId(),
        index: 0,
        ...(witnessUtxo && {
            witnessUtxo: { script: inputScript, value: inputValue }
        }),
        ...(nonWitnessUtxo && { nonWitnessUtxo: funding.toBuffer() })
    });
    psbt.addOutput({ address: destination, value: outputValue });
    psbt.signInput(0, signer);
    return { psbt, funding };
};

const newStore = () => {
    const stub = {
        onReconnect: jest.fn(),
        nodeInfo: {},
        settings: {},
        implementation: 'embedded-lnd'
    };
    const store = new TransactionsStore(
        { ...stub, onReconnect: jest.fn() } as any,
        { ...stub, onReconnect: jest.fn() } as any,
        { ...stub, onReconnect: jest.fn() } as any,
        { ...stub, onReconnect: jest.fn() } as any,
        { ...stub, onReconnect: jest.fn() } as any
    );
    const broadcast = jest
        .spyOn(store, 'broadcast')
        .mockResolvedValue(undefined as any);
    return { store, broadcast };
};

describe('TransactionsStore.finalizePsbtAndBroadcast (non-default account)', () => {
    afterEach(() => jest.restoreAllMocks());

    it('finalizes and broadcasts a PSBT with matching UTXO data', async () => {
        const { psbt, funding } = signedPsbt(100_000, 99_000);
        const { store, broadcast } = newStore();

        await store.finalizePsbtAndBroadcast(psbt.toBase64(), false);

        expect(store.error).toBe(false);
        expect(broadcast).toHaveBeenCalledTimes(1);
        const tx = bitcoin.Transaction.fromHex(broadcast.mock.calls[0][0]);
        expect(Buffer.from(tx.ins[0].hash).equals(funding.getHash())).toBe(
            true
        );
        expect(tx.ins[0].witness).toHaveLength(2);
        expect(tx.outs).toHaveLength(1);
        expect(tx.outs[0].value).toBe(99_000);
    });

    it('finalizes and broadcasts a PSBT that only carries witnessUtxo', async () => {
        const { psbt } = signedPsbt(100_000, 99_000, {
            nonWitnessUtxo: false
        });
        const { store, broadcast } = newStore();

        await store.finalizePsbtAndBroadcast(psbt.toBase64(), false);

        expect(store.error).toBe(false);
        expect(broadcast).toHaveBeenCalledTimes(1);
    });

    it('refuses a PSBT whose fee rate is above the extractor cap', async () => {
        // 10M sat input, 99k sat output: ~89k sat/vB
        const { psbt } = signedPsbt(10_000_000, 99_000);
        const { store, broadcast } = newStore();

        await store.finalizePsbtAndBroadcast(psbt.toBase64(), false);

        expect(broadcast).not.toHaveBeenCalled();
        expect(store.error).toBe(true);
        expect(store.error_msg).toMatch(/fees/);
        expect(store.loading).toBe(false);
    });

    it('refuses a witnessUtxo that understates the nonWitnessUtxo value', async () => {
        // A witnessUtxo claiming 100k sats would hide the ~9.9M sat fee
        // from the fee-rate cap (bitcoinjs-lib < 6.1.9 trusted it).
        const { psbt } = signedPsbt(10_000_000, 99_000);
        psbt.data.inputs[0].witnessUtxo = {
            script: inputScript,
            value: 100_000
        };
        const { store, broadcast } = newStore();

        await store.finalizePsbtAndBroadcast(psbt.toBase64(), false);

        expect(broadcast).not.toHaveBeenCalled();
        expect(store.error).toBe(true);
        expect(store.error_msg).toMatch(
            /Witness UTXO for input #0 doesn't match the non-witness UTXO/
        );
    });

    it('refuses a nonWitnessUtxo that is not the transaction being spent', async () => {
        // Same trick through a substitute funding tx worth 100k sats
        // (bitcoinjs-lib < 6.1.9 did not check its txid when extracting).
        const { psbt } = signedPsbt(10_000_000, 99_000, {
            witnessUtxo: false
        });
        psbt.data.inputs[0].nonWitnessUtxo = fundingTx(100_000, 2).toBuffer();
        const { store, broadcast } = newStore();

        await store.finalizePsbtAndBroadcast(psbt.toBase64(), false);

        expect(broadcast).not.toHaveBeenCalled();
        expect(store.error).toBe(true);
        expect(store.error_msg).toMatch(
            /Non-witness UTXO hash for input #0 doesn't match/
        );
    });

    it('refuses a PSBT input with no UTXO data', async () => {
        const { psbt } = signedPsbt(100_000, 99_000, {
            nonWitnessUtxo: false
        });
        delete psbt.data.inputs[0].witnessUtxo;
        const { store, broadcast } = newStore();

        await store.finalizePsbtAndBroadcast(psbt.toBase64(), false);

        expect(broadcast).not.toHaveBeenCalled();
        expect(store.error).toBe(true);
        expect(store.error_msg).toMatch(/No script found for input #0/);
        expect(store.loading).toBe(false);
    });
});
