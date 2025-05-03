import { action, observable } from 'mobx';
import NodeInfoStore from './NodeInfoStore';
import * as bitcoin from 'bitcoinjs-lib';
import { localeString } from '../utils/LocaleUtils';
const EC = require('elliptic').ec;
const ec = new EC('secp256k1');

export default class SweepStore {
    @observable loading: boolean = false;
    @observable sweepErrorMsg: string | null = null;
    @observable sweepError: boolean = false;
    @observable sweepTxHex: string | null = null;

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
    isValidWif(wif: string): boolean {
        try {
            if (!['K', 'L', '5'].includes(wif[0])) {
                throw new Error(localeString('views.Wif.invalidPrefix'));
            }

            if (wif.length !== 51 && wif.length !== 52) {
                throw new Error(localeString('views.Wif.invalidLength'));
            }

            const checksum = wif.slice(-4);
            if (checksum.length !== 4) {
                throw new Error(localeString('views.Wif.invalidChecksum'));
            }

            this.sweepError = false;
            this.sweepErrorMsg = null;
            return true;
        } catch (err: any) {
            console.error('Error validating WIF:', err);
            this.sweepError = true;
            this.sweepErrorMsg =
                err.message || localeString('views.Wif.invalidWif');
            return false;
        }
    }

    @action
    async sweepBtc(wif: string, destination: string) {
        const { nodeInfo } = this.nodeInfoStore;
        const network = nodeInfo?.isTestNet
            ? nodeInfo?.isRegTest
                ? bitcoin.networks.regtest
                : bitcoin.networks.testnet
            : bitcoin.networks.bitcoin;

        try {
            const keyPair = ec.fromWIF(wif);
            const { address } = bitcoin.payments.p2pkh({
                pubkey: keyPair.publicKey
            });

            if (!address) {
                throw new Error(
                    localeString('views.Wif.addressFromPrivKeyError')
                );
            }

            const utxos = await this.getUTXOs(address);

            if (!utxos || utxos.length === 0) {
                throw new Error(
                    localeString('views.UTXOs.CoinControl.noUTXOs')
                );
            }

            const psbt = new bitcoin.Psbt({ network });

            utxos.forEach((utxo: any) => {
                psbt.addInput({
                    hash: utxo.txid,
                    index: utxo.index,
                    nonWitnessUtxo: Buffer.from(utxo.rawTx, 'hex')
                });
            });

            const totalValue = utxos.reduce(
                (total: any, utxo: any) => total + utxo.value,
                0
            );
            const fee = 1000; // change this to a dynamic fee calculation
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

    private async getUTXOs(address: string) {
        try {
            const res = await fetch(
                `https://blockstream.info/api/address/${address}/utxo`
            );
            if (!res.ok) {
                throw new Error(`HTTP error! Status: ${res.status}`);
            }

            const data = await res.json();
            return data;
        } catch (err) {
            console.error('Error fetching UTXOs:', err);
            throw new Error('Failed to fetch UTXOs');
        }
    }
}
