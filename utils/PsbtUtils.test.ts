import * as bitcoin from 'bitcoinjs-lib';

import PsbtUtils from './PsbtUtils';

// valid secp256k1 point (2G)
const pubkey = Buffer.from(
    '02c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5',
    'hex'
);

const prevTxid =
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

const makePrevTx = (script: Buffer, value: number) => {
    const tx = new bitcoin.Transaction();
    tx.addInput(Buffer.alloc(32, 1), 0);
    tx.addOutput(script, value);
    return tx;
};

describe('PsbtUtils', () => {
    describe('decodePsbtSummary', () => {
        it('decodes outputs, input values, and fee when all inputs have UTXO data', () => {
            const network = bitcoin.networks.bitcoin;
            const p2wpkh = bitcoin.payments.p2wpkh({ pubkey, network });
            const prevTx = makePrevTx(p2wpkh.output!, 50000);

            const psbt = new bitcoin.Psbt({ network });
            psbt.addInput({
                hash: prevTxid,
                index: 1,
                witnessUtxo: { script: p2wpkh.output!, value: 60000 }
            });
            psbt.addInput({
                hash: prevTx.getHash(),
                index: 0,
                nonWitnessUtxo: prevTx.toBuffer()
            });
            psbt.addOutput({ address: p2wpkh.address!, value: 100000 });

            const summary = PsbtUtils.decodePsbtSummary(
                psbt.toBase64(),
                network
            );

            expect(summary).toBeDefined();
            expect(summary!.outputs).toHaveLength(1);
            expect(summary!.outputs[0].address).toEqual(p2wpkh.address);
            expect(summary!.outputs[0].value).toEqual(100000);
            expect(summary!.inputs).toHaveLength(2);
            expect(summary!.inputs[0].outpoint).toEqual(`${prevTxid}:1`);
            expect(summary!.inputs[0].value).toEqual(60000);
            expect(summary!.inputs[1].outpoint).toEqual(`${prevTx.getId()}:0`);
            expect(summary!.inputs[1].value).toEqual(50000);
            expect(summary!.fee).toEqual(10000);
        });

        it('leaves fee undefined when any input lacks UTXO data', () => {
            const network = bitcoin.networks.bitcoin;
            const p2wpkh = bitcoin.payments.p2wpkh({ pubkey, network });

            const psbt = new bitcoin.Psbt({ network });
            psbt.addInput({
                hash: prevTxid,
                index: 0,
                witnessUtxo: { script: p2wpkh.output!, value: 60000 }
            });
            // no witnessUtxo or nonWitnessUtxo
            psbt.addInput({ hash: prevTxid, index: 1 });
            psbt.addOutput({ address: p2wpkh.address!, value: 40000 });

            const summary = PsbtUtils.decodePsbtSummary(
                psbt.toBase64(),
                network
            );

            expect(summary).toBeDefined();
            expect(summary!.outputs).toHaveLength(1);
            expect(summary!.outputs[0].value).toEqual(40000);
            expect(summary!.inputs[1].value).toBeUndefined();
            expect(summary!.fee).toBeUndefined();
        });

        it('derives addresses with the provided network', () => {
            const network = bitcoin.networks.testnet;
            const p2wpkh = bitcoin.payments.p2wpkh({ pubkey, network });

            const psbt = new bitcoin.Psbt({ network });
            psbt.addInput({
                hash: prevTxid,
                index: 0,
                witnessUtxo: { script: p2wpkh.output!, value: 60000 }
            });
            psbt.addOutput({ address: p2wpkh.address!, value: 50000 });

            const summary = PsbtUtils.decodePsbtSummary(
                psbt.toBase64(),
                network
            );

            expect(summary!.outputs[0].address).toEqual(p2wpkh.address);
            expect(summary!.outputs[0].address!.startsWith('tb1')).toBe(true);
        });

        it('leaves address undefined for non-standard outputs', () => {
            const network = bitcoin.networks.bitcoin;
            const p2wpkh = bitcoin.payments.p2wpkh({ pubkey, network });
            const opReturn = bitcoin.script.compile([
                bitcoin.opcodes.OP_RETURN,
                Buffer.from('zeus')
            ]);

            const psbt = new bitcoin.Psbt({ network });
            psbt.addInput({
                hash: prevTxid,
                index: 0,
                witnessUtxo: { script: p2wpkh.output!, value: 60000 }
            });
            psbt.addOutput({ script: opReturn, value: 0 });

            const summary = PsbtUtils.decodePsbtSummary(
                psbt.toBase64(),
                network
            );

            expect(summary!.outputs[0].address).toBeUndefined();
            expect(summary!.outputs[0].scriptHex).toEqual(
                opReturn.toString('hex')
            );
        });

        it('returns undefined for invalid input', () => {
            expect(PsbtUtils.decodePsbtSummary('')).toBeUndefined();
            expect(PsbtUtils.decodePsbtSummary('not a psbt')).toBeUndefined();
            expect(
                PsbtUtils.decodePsbtSummary('aGVsbG8gd29ybGQ=')
            ).toBeUndefined();
        });
    });
});
