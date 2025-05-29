import { action, observable } from 'mobx';
import { decode as wifDecode } from 'wif';
import * as bitcoin from 'bitcoinjs-lib';
import { getPublicKey } from '@noble/secp256k1';

import NodeInfoStore from './NodeInfoStore';
import { localeString } from '../utils/LocaleUtils';
import ecc from '../zeus_modules/noble_ecc';
import ECPairFactory from 'ecpair';
const ECPair = ECPairFactory(ecc);

export default class SweepStore {
    @observable loading: boolean = false;
    @observable sweepErrorMsg: string | null = null;
    @observable sweepError: boolean = false;
    @observable sweepTxHex: string | null = null;
    @observable onChainBalance: string;

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

    @action
    async sweepBtc(wif: string, destination: string) {
        try {
            const { nodeInfo } = this.nodeInfoStore;
            const network = nodeInfo?.isTestNet
                ? nodeInfo?.isRegTest
                    ? bitcoin.networks.regtest
                    : bitcoin.networks.testnet
                : bitcoin.networks.bitcoin;

            const networkStr = nodeInfo?.isTestNet ? 'testnet' : 'mainnet';

            const { privateKey } = wifDecode(wif);
            const keyPair = ECPair.fromPrivateKey(Buffer.from(privateKey), {
                network
            });

            const publicKey = getPublicKey(privateKey, true);
            const { address } = bitcoin.payments.p2wpkh({
                pubkey: Buffer.from(publicKey),
                network
            });

            if (!address) {
                throw new Error('Unable to derive address from WIF.');
            }

            const utxos = await this.getUtxosFromAddress(address, networkStr);

            if (!utxos || utxos.length === 0) {
                throw new Error(
                    localeString('views.UTXOs.CoinControl.noUTXOs')
                );
            }

            const psbt = new bitcoin.Psbt({ network });

            for (const utxo of utxos) {
                if (!utxo.rawTx) {
                    throw new Error('Missing rawTx for UTXO input.');
                }

                psbt.addInput({
                    hash: utxo.txid,
                    index: utxo.vout ?? utxo.index,
                    nonWitnessUtxo: Buffer.from(utxo.rawTx, 'hex')
                });
            }

            const totalValue = utxos.reduce(
                (total: number, utxo: any) => total + utxo.value,
                0
            );
            const fee = 1000;
            const sendValue = totalValue - fee;

            if (sendValue <= 0) {
                throw new Error(localeString('views.Wif.insufficientFunds'));
            }

            psbt.addOutput({
                address: destination,
                value: sendValue
            });

            utxos.forEach((_: any, index: number) => {
                psbt.signInput(index, keyPair);
            });

            psbt.finalizeAllInputs();

            const txHex = psbt.extractTransaction().toHex();

            this.sweepError = false;
            this.sweepErrorMsg = null;
            this.sweepTxHex = txHex;

            return txHex;
        } catch (err: any) {
            this.sweepError = true;
            this.sweepErrorMsg =
                err.message || localeString('views.Wif.sweepError');
            this.sweepTxHex = null;
            return null;
        }
    }

    async getUtxosFromAddress(address: string, network: string) {
        const baseUrl =
            network === 'mainnet'
                ? 'https://blockstream.info/api'
                : 'https://blockstream.info/testnet/api';

        const res = await fetch(`${baseUrl}/address/${address}/utxo`);
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

    @action
    async fetchOnChainBalance(wif: string) {
        try {
            const { nodeInfo } = this.nodeInfoStore;
            const networkObj = nodeInfo?.isTestNet
                ? nodeInfo?.isRegTest
                    ? bitcoin.networks.regtest
                    : bitcoin.networks.testnet
                : bitcoin.networks.bitcoin;

            const networkStr = nodeInfo?.isTestNet ? 'testnet' : 'mainnet';

            const { privateKey } = wifDecode(wif);
            const publicKey = getPublicKey(privateKey, true);

            const { address } = bitcoin.payments.p2wpkh({
                pubkey: Buffer.from(publicKey),
                network: networkObj
            });

            if (!address) {
                throw new Error('Unable to derive address from WIF.');
            }

            const utxos = await this.getUtxosFromAddress(address, networkStr);
            const totalSats = this.getOnChainBalanceFromUtxos(utxos);

            this.onChainBalance = totalSats.toString();
        } catch (err: any) {
            this.sweepError = true;
            this.sweepErrorMsg = err.message;
        }
    }
}
