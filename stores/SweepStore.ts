import { action, observable } from 'mobx';
import { decode as wifDecode } from 'wif';
import * as bitcoin from 'bitcoinjs-lib';
import { getPublicKey } from '@noble/secp256k1';

import NodeInfoStore from './NodeInfoStore';

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

    // @action
    // async sweepBtc(wif: string, destination: string) {
    //     const { nodeInfo } = this.nodeInfoStore;
    //     const network = nodeInfo?.isTestNet
    //         ? nodeInfo?.isRegTest
    //             ? bitcoin.networks.regtest
    //             : bitcoin.networks.testnet
    //         : bitcoin.networks.bitcoin;

    //     try {
    //         const keyPair = ec.fromWIF(wif);
    //         const { address } = bitcoin.payments.p2pkh({
    //             pubkey: keyPair.publicKey
    //         });

    //         if (!address) {
    //             throw new Error(
    //                 localeString('views.Wif.addressFromPrivKeyError')
    //             );
    //         }

    //         const utxos = await this.getUTXOs(address);

    //         if (!utxos || utxos.length === 0) {
    //             throw new Error(
    //                 localeString('views.UTXOs.CoinControl.noUTXOs')
    //             );
    //         }

    //         const psbt = new bitcoin.Psbt({ network });

    //         utxos.forEach((utxo: any) => {
    //             psbt.addInput({
    //                 hash: utxo.txid,
    //                 index: utxo.index,
    //                 nonWitnessUtxo: Buffer.from(utxo.rawTx, 'hex')
    //             });
    //         });

    //         const totalValue = utxos.reduce(
    //             (total: any, utxo: any) => total + utxo.value,
    //             0
    //         );
    //         const fee = 1000; // change this to a dynamic fee calculation
    //         const sendValue = totalValue - fee;

    //         if (sendValue <= 0) {
    //             throw new Error(localeString('views.Wif.insufficientFunds'));
    //         }

    //         psbt.addOutput({
    //             address: destination,
    //             value: sendValue
    //         });

    //         utxos.forEach((_: any, index: number) => {
    //             psbt.signInput(index, keyPair);
    //         });

    //         psbt.finalizeAllInputs();
    //         const txHex = psbt.extractTransaction().toHex();

    //         this.sweepError = false;
    //         this.sweepErrorMsg = null;
    //         this.sweepTxHex = txHex;

    //         return txHex;
    //     } catch (err: any) {
    //         this.sweepError = true;
    //         this.sweepErrorMsg =
    //             err.message || localeString('views.Wif.sweepError');
    //         this.sweepTxHex = null;
    //         return null;
    //     }
    // }

    @action
    async fetchOnChainBalance(wif: string) {
        try {
            const { privateKey } = wifDecode(wif);
            const publicKey = getPublicKey(privateKey, true);
            const { address } = bitcoin.payments.p2pkh({
                pubkey: Buffer.from(publicKey)
            });

            console.log(address);

            if (!address) {
                throw new Error('Unable to derive address from WIF.');
            }

            const res = await fetch(
                `https://blockstream.info/api/address/${address}/utxo`
            );
            if (!res.ok) {
                throw new Error(`HTTP error! Status: ${res.status}`);
            }

            const utxos = await res.json();
            console.log(utxos);

            const totalSats = utxos.reduce(
                (sum: any, utxo: any) => sum + utxo.value,
                0
            );
            this.onChainBalance = totalSats.toString();
        } catch (err: any) {
            console.log(err);
            this.sweepError = true;
            console.log(err);
            this.sweepErrorMsg = 'error fetching balance';
            console.error('Error fetching UTXOs:', err);
        }
    }
}
