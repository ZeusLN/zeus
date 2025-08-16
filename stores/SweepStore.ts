import { action, observable } from 'mobx';
// @ts-ignore:next-line
import { decode as wifDecode } from 'wif';
import * as bitcoin from 'bitcoinjs-lib';
import { toXOnly } from 'bitcoinjs-lib/src/psbt/bip371';

import { getPublicKey } from '@noble/secp256k1';
import ecc from '../zeus_modules/noble_ecc';

import NodeInfoStore from './NodeInfoStore';
import wifUtils, { AddressType } from '../utils/WIFUtils';

export default class SweepStore {
    @observable loading: boolean = false;
    @observable sweepErrorMsg: string | null = null;
    @observable sweepError: boolean = false;
    @observable sweepTxHex: string | null = null;
    @observable onChainBalance: number;
    @observable destination: string;
    @observable txHex: string | null = null;
    @observable txId: string | null = null;
    @observable fee: number = 0;
    @observable feeRate: string = '';
    @observable addressType: AddressType = 'p2wpkh';
    @observable utxos: any[] = [];
    @observable psbt: bitcoin.Psbt;
    @observable privateKey: string;
    @observable wif: string;
    @observable network: bitcoin.Network;
    @observable vBytes: number;
    @observable bytes: number;
    @observable valueToSend: number;
    @observable tapInternalKey: Buffer | null = null;
    nodeInfoStore: NodeInfoStore;

    constructor(nodeInfoStore: NodeInfoStore) {
        this.nodeInfoStore = nodeInfoStore;
    }

    @action
    setLoading(loading: boolean) {
        this.loading = loading;
    }

    @action
    resetSweepError() {
        this.sweepError = false;
        this.sweepErrorMsg = '';
    }

    async getUtxosFromAddress(address: string, network: string) {
        console.log('address: ', address);
        const res = await fetch(
            `${wifUtils.baseUrl(network)}/address/${address}/utxo`
        );
        if (!res.ok) {
            throw new Error(`Error fetching UTXOs`);
        }

        const utxos = await res.json();
        console.log('utxos: ', utxos);
        return utxos;
    }

    async detectAddressWithUtxos(
        publicKey: Buffer,
        network: bitcoin.Network,
        networkStr: string,
        getUtxosFromAddress: (addr: string, net: string) => Promise<any[]>
    ): Promise<{ address: string; type: AddressType; utxos: any[] }> {
        const addresses: { type: AddressType; address: string }[] = [];

        addresses.push({
            type: 'p2pkh',
            address: bitcoin.payments.p2pkh({ pubkey: publicKey, network })
                .address!
        });

        addresses.push({
            type: 'p2sh-p2wpkh',
            address: bitcoin.payments.p2sh({
                redeem: bitcoin.payments.p2wpkh({ pubkey: publicKey, network }),
                network
            }).address!
        });

        addresses.push({
            type: 'p2wpkh',
            address: bitcoin.payments.p2wpkh({ pubkey: publicKey, network })
                .address!
        });

        // For taproot, use the x-only public key
        const internalPubkey = toXOnly(publicKey);
        addresses.push({
            type: 'p2tr',
            address: bitcoin.payments.p2tr({
                internalPubkey,
                network
            }).address!
        });

        for (const { type, address } of addresses) {
            const utxos = await getUtxosFromAddress(address, networkStr);
            if (utxos && utxos.length > 0) {
                return { type, address, utxos };
            }
        }

        throw new Error('No UTXOs found for the given private key.');
    }

    @action
    async prepareSweepInputs(wif: string) {
        this.wif = wif;
        const { nodeInfo } = this.nodeInfoStore;
        const network = nodeInfo?.isTestNet
            ? nodeInfo?.isRegTest
                ? bitcoin.networks.regtest
                : bitcoin.networks.testnet
            : bitcoin.networks.bitcoin;
        this.network = network;

        const networkStr = nodeInfo?.isTestNet ? 'testnet' : 'mainnet';

        try {
            const { privateKey } = wifDecode(this.wif);
            this.privateKey = Buffer.from(privateKey).toString('hex');
            const publicKey = Buffer.from(getPublicKey(privateKey, true));

            const result = await this.detectAddressWithUtxos(
                publicKey,
                this.network,
                networkStr,
                this.getUtxosFromAddress
            );

            this.addressType = result.type;
            this.utxos = result.utxos;
            let totalSats = 0;

            this.psbt = new bitcoin.Psbt({ network: this.network });

            if (this.addressType === 'p2pkh') {
                for (const utxo of this.utxos) {
                    const { txid, vout } = utxo;
                    totalSats += utxo.value;
                    const res = await fetch(
                        `${wifUtils.baseUrl(networkStr)}/tx/${txid}/hex`
                    );
                    if (!res.ok)
                        throw new Error(`Failed to fetch tx hex for ${txid}`);

                    const rawTxHex = await res.text();

                    this.psbt.addInput({
                        hash: txid,
                        index: vout,
                        nonWitnessUtxo: Buffer.from(rawTxHex, 'hex')
                    });
                }
            } else if (this.addressType === 'p2sh-p2wpkh') {
                for (const utxo of this.utxos) {
                    const { txid, vout } = utxo;

                    const value = utxo.value;
                    totalSats += value;
                    const res = await fetch(
                        `${wifUtils.baseUrl(networkStr)}/tx/${txid}`
                    );
                    if (!res.ok)
                        throw new Error(
                            `Failed to fetch tx details for ${txid}`
                        );

                    const tx = await res.json();
                    console.log(tx);
                    const output = tx.vout[vout];

                    if (!output)
                        throw new Error(
                            `Output ${vout} not found in tx ${txid}`
                        );

                    const scriptPubKeyHex = output.scriptpubkey;
                    const script = Buffer.from(scriptPubKeyHex, 'hex');

                    const privKeyBuf = Buffer.from(this.privateKey, 'hex');
                    const fullPub = ecc.pointFromScalar(privKeyBuf, true);
                    if (!fullPub) {
                        throw new Error('Failed to derive public key');
                    }
                    const pubkey = Buffer.from(fullPub);

                    this.psbt.addInput({
                        hash: txid,
                        index: vout,
                        witnessUtxo: {
                            script,
                            value
                        },
                        redeemScript: bitcoin.payments.p2wpkh({
                            pubkey,
                            network: this.network
                        }).output
                    });
                }
            } else if (this.addressType === 'p2wpkh') {
                for (const utxo of this.utxos) {
                    const { txid, vout } = utxo;

                    const res = await fetch(
                        `${wifUtils.baseUrl(networkStr)}/tx/${txid}`
                    );
                    if (!res.ok)
                        throw new Error(
                            `Failed to fetch tx details for ${txid}`
                        );

                    const tx = await res.json();
                    const output = tx.vout[vout];

                    if (!output)
                        throw new Error(
                            `Output index ${vout} not found in tx ${txid}`
                        );

                    const value = Math.round(output.value);
                    totalSats += value;

                    const scriptPubKeyHex = output.scriptpubkey;
                    const script = Buffer.from(scriptPubKeyHex, 'hex');

                    this.psbt.addInput({
                        hash: txid,
                        index: vout,
                        witnessUtxo: {
                            script,
                            value
                        }
                    });
                }
            } else if (this.addressType === 'p2tr') {
                const privKeyBuf = Buffer.from(this.privateKey, 'hex');
                const fullPub = ecc.pointFromScalar(privKeyBuf, true);
                if (!fullPub)
                    throw new Error('Failed to derive Taproot pubkey');

                const tapInternalKey = toXOnly(Buffer.from(fullPub));
                this.tapInternalKey = tapInternalKey;

                for (const utxo of this.utxos) {
                    const { txid, vout, value } = utxo;
                    totalSats += value;

                    const res = await fetch(
                        `${wifUtils.baseUrl(networkStr)}/tx/${txid}`
                    );
                    if (!res.ok) throw new Error(`Failed to fetch tx ${txid}`);
                    const tx = await res.json();

                    const output = tx.vout[vout];
                    if (!output)
                        throw new Error(
                            `Output ${vout} not found in tx ${txid}`
                        );

                    const script = Buffer.from(output.scriptpubkey, 'hex');

                    this.psbt.addInput({
                        hash: txid,
                        index: vout,
                        witnessUtxo: {
                            script,
                            value: Number(output.value)
                        },
                        tapInternalKey
                    });
                }
            }
            this.onChainBalance = totalSats;
            console.log('onChainBalance', this.onChainBalance);
        } catch (err: any) {
            console.log(err);
            this.sweepError = true;
            this.sweepErrorMsg = err.message;
        }
    }

    @action
    async finalizeSweepTransaction(feeRate: string) {
        try {
            this.feeRate = feeRate;
            const isTaproot = this.addressType === 'p2tr';
            const privateKey = Buffer.from(this.privateKey, 'hex');

            let pubkey: Buffer;
            let signer: any;

            if (isTaproot) {
                const fullPub = ecc.pointFromScalar(privateKey, true);
                if (!fullPub) throw new Error('Failed to derive pubkey');
                pubkey = toXOnly(Buffer.from(fullPub));

                signer = {
                    publicKey: pubkey,
                    sign: (hash: Buffer, _lowR?: boolean) => {
                        const signature = ecc.signSchnorr(hash, privateKey);
                        return Buffer.from(signature);
                    },
                    signSchnorr: (hash: Buffer) => {
                        const signature = ecc.signSchnorr(hash, privateKey);
                        return Buffer.from(signature);
                    }
                };
            } else {
                const fullPub = ecc.pointFromScalar(privateKey, true);
                if (!fullPub) throw new Error('Failed to derive pubkey');
                pubkey = Buffer.from(fullPub);

                signer = {
                    publicKey: pubkey,
                    sign: (hash: Buffer) => {
                        const signature = ecc.sign(hash, privateKey);
                        return Buffer.from(signature);
                    }
                };
            }

            const base = 10_000_000;
            const txBuildCounter = Date.now() % 10_000;
            this.psbt.setLocktime(base + txBuildCounter);

            const dummyPsbt = bitcoin.Psbt.fromBuffer(this.psbt.toBuffer(), {
                network: this.network
            });

            dummyPsbt.addOutput({
                address: this.destination,
                value: this.onChainBalance
            });

            if (isTaproot) {
                for (let i = 0; i < dummyPsbt.inputCount; i++) {
                    try {
                        dummyPsbt.signTaprootInput(i, signer);
                    } catch (err) {
                        console.error(`Error signing taproot input ${i}:`, err);
                        throw err;
                    }
                }
            } else {
                dummyPsbt.signAllInputs(signer);
            }

            dummyPsbt.finalizeAllInputs();
            const dummyTx = dummyPsbt.extractTransaction();
            const vbytes = dummyTx.virtualSize();

            this.vBytes = vbytes;
            this.fee = Math.ceil(vbytes * Number(feeRate));
            this.valueToSend = this.onChainBalance - this.fee;

            if (this.valueToSend <= 0)
                throw new Error('Insufficient funds after fees');

            this.psbt.addOutput({
                address: this.destination,
                value: this.valueToSend
            });

            if (isTaproot) {
                for (let i = 0; i < this.psbt.inputCount; i++) {
                    try {
                        this.psbt.signTaprootInput(i, signer);
                    } catch (err) {
                        console.error(`Error signing taproot input ${i}:`, err);
                        throw err;
                    }
                }
            } else {
                this.psbt.signAllInputs(signer);
            }

            this.psbt.finalizeAllInputs();
            const tx = this.psbt.extractTransaction();

            this.txHex = tx.toHex();
            this.bytes = this.txHex.length / 2;
            this.txId = tx.getId();

            console.log('Final txHex:', this.txHex);
        } catch (err: any) {
            console.error('Sweep error:', err);
            this.sweepError = true;
            this.sweepErrorMsg = err.message;
        }
    }
}
