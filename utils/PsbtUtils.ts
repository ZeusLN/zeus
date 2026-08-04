import * as bitcoin from 'bitcoinjs-lib';
import ecc from '../zeus_modules/noble_ecc';

bitcoin.initEccLib(ecc);

export interface PsbtSummaryOutput {
    address?: string;
    value: number;
    scriptHex: string;
}

export interface PsbtSummaryInput {
    outpoint: string;
    value?: number;
}

export interface PsbtSummary {
    outputs: PsbtSummaryOutput[];
    inputs: PsbtSummaryInput[];
    fee?: number;
}

class PsbtUtils {
    decodePsbtSummary = (
        psbtBase64: string,
        network?: bitcoin.Network
    ): PsbtSummary | undefined => {
        try {
            const psbt = bitcoin.Psbt.fromBase64(psbtBase64, {
                network: network || bitcoin.networks.bitcoin
            });

            const outputs: PsbtSummaryOutput[] = psbt.txOutputs.map(
                (output) => ({
                    address: output.address,
                    value: output.value,
                    scriptHex: output.script.toString('hex')
                })
            );

            const inputs: PsbtSummaryInput[] = psbt.txInputs.map(
                (input, index) => {
                    const hash = Buffer.from(input.hash).reverse();
                    const outpoint = `${hash.toString('hex')}:${input.index}`;

                    let value: number | undefined;
                    const inputData = psbt.data.inputs[index];
                    try {
                        if (inputData?.witnessUtxo) {
                            value = inputData.witnessUtxo.value;
                        } else if (inputData?.nonWitnessUtxo) {
                            const utxoTx = bitcoin.Transaction.fromBuffer(
                                inputData.nonWitnessUtxo
                            );
                            value = utxoTx.outs[input.index]?.value;
                        }
                    } catch (e) {}

                    return { outpoint, value };
                }
            );

            // psbt.getFee() requires finalized inputs and silently
            // undercounts inputs that lack UTXO data, so compute the fee
            // from the extracted values, and only when every input's
            // value is known
            let fee: number | undefined;
            if (inputs.every((input) => input.value !== undefined)) {
                const inputTotal = inputs.reduce(
                    (total, input) => total + (input.value || 0),
                    0
                );
                const outputTotal = outputs.reduce(
                    (total, output) => total + output.value,
                    0
                );
                if (inputTotal >= outputTotal) {
                    fee = inputTotal - outputTotal;
                }
            }

            return { outputs, inputs, fee };
        } catch (e) {
            return undefined;
        }
    };
}

const psbtUtils = new PsbtUtils();
export default psbtUtils;
