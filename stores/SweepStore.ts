import { action, observable } from 'mobx';
import { decode as wifDecode } from 'wif';
import * as bitcoin from 'bitcoinjs-lib';
import { getPublicKey } from '@noble/secp256k1';

import NodeInfoStore from './NodeInfoStore';
import { localeString } from '../utils/LocaleUtils';
import wifUtils, { AddressType } from '../utils/WIFUtils';
// import ECPairFactory from 'ecpair';
// import ecc from '../zeus_modules/noble_ecc';
// const ECPair = ECPairFactory(ecc);

export default class SweepStore {
    @observable loading: boolean = false;
    @observable sweepErrorMsg: string | null = null;
    @observable sweepError: boolean = false;
    @observable sweepTxHex: string | null = null;
    @observable onChainBalance: number;
    @observable destination: string;
    @observable txHex: string | null = null;
    @observable fee: number = 0;
    @observable feeRate: number = 0;
    @observable addressType: AddressType = 'p2wpkh';
    @observable utxos: any[] = [];
    @observable psbt: bitcoin.Psbt;

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
        const res = await fetch(
            `${wifUtils.baseUrl(network)}/address/${address}/utxo`
        );
        if (!res.ok) {
            throw new Error(`Error fetching UTXOs`);
        }

        const utxos = await res.json();
        return utxos;
    }

    getOnChainBalanceFromUtxos(utxos: any[]) {
        if (!utxos || utxos.length === 0) {
            throw new Error(localeString('views.UTXOs.CoinControl.noUTXOs'));
        }

        return utxos.reduce((sum, utxo) => sum + utxo.value, 0);
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

        addresses.push({
            type: 'p2tr',
            address: bitcoin.payments.p2tr({
                internalPubkey: Buffer.from(publicKey.subarray(1, 33)), // remove 0x02/0x03 prefix
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
        const { nodeInfo } = this.nodeInfoStore;
        const network = nodeInfo?.isTestNet
            ? nodeInfo?.isRegTest
                ? bitcoin.networks.regtest
                : bitcoin.networks.testnet
            : bitcoin.networks.bitcoin;

        const networkStr = nodeInfo?.isTestNet ? 'testnet' : 'mainnet';

        try {
            const { privateKey } = wifDecode(wif);
            const publicKey = Buffer.from(getPublicKey(privateKey, true));

            const result = await this.detectAddressWithUtxos(
                publicKey,
                network,
                networkStr,
                this.getUtxosFromAddress
            );

            this.addressType = result.type;
            this.utxos = result.utxos;
            let totalSats = 0;

            this.psbt = new bitcoin.Psbt({ network });

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
                            `Output ${vout} not found in tx ${txid}`
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
                        },
                        redeemScript: bitcoin.payments.p2wpkh({
                            pubkey: utxo.pubkey
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
                for (const utxo of this.utxos) {
                    const { txid, vout } = utxo;

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

                    const value = Math.round(output.value);
                    totalSats += value;

                    const script = Buffer.from(output.scriptpubkey, 'hex');

                    this.psbt.addInput({
                        hash: txid,
                        index: vout,
                        witnessUtxo: {
                            script,
                            value
                        },
                        tapInternalKey: utxo.internalPubkey
                    });
                }
            }
            this.onChainBalance = totalSats;
            console.log('onChainBalance', this.onChainBalance);
        } catch (err: any) {
            this.sweepError = true;
            this.sweepErrorMsg = err.message;
        }
    }

    @action
    async finalizeSweepTransaction() {
        try {
            console.log('finalizeSweepTransaction', this.psbt);
            // this.psbt.addOutput({
            //     address: this.destination,
            //     value: this.onChainBalance,
            // });

            // const keyPair = ECPair.fromPrivateKey(Buffer.from(privateKey));
            // const signer: bitcoin.Signer = {
            //     publicKey: Buffer.from(keyPair.publicKey),
            //     sign: (hash: Buffer, lowR?: boolean) => Buffer.from(keyPair.sign(hash, lowR)),
            // };
            // this.psbt.signAllInputs(signer);

            // this.psbt.finalizeAllInputs();

            // const txHex = psbt.extractTransaction().toHex();
            // this.txHex = txHex;
        } catch (err: any) {
            this.sweepError = true;
            this.sweepErrorMsg = err.message;
        }
    }
}
