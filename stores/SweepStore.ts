import { action, observable } from 'mobx';
import { decode as wifDecode } from 'wif';
import * as bitcoin from 'bitcoinjs-lib';
import { getPublicKey } from '@noble/secp256k1';

import NodeInfoStore from './NodeInfoStore';
import { localeString } from '../utils/LocaleUtils';
import { AddressType } from '../utils/WIFUtils';

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
    async fetchOnChainBalance(wif: string) {
        try {
            const { nodeInfo } = this.nodeInfoStore;
            const network = nodeInfo?.isTestNet
                ? nodeInfo?.isRegTest
                    ? bitcoin.networks.regtest
                    : bitcoin.networks.testnet
                : bitcoin.networks.bitcoin;

            const networkStr = nodeInfo?.isTestNet ? 'testnet' : 'mainnet';

            const { privateKey } = wifDecode(wif);
            const publicKey = Buffer.from(getPublicKey(privateKey, true));

            const result = await this.detectAddressWithUtxos(
                publicKey,
                network,
                networkStr,
                this.getUtxosFromAddress
            );

            const totalSats = this.getOnChainBalanceFromUtxos(result.utxos);
            this.onChainBalance = totalSats.toString();
        } catch (err: any) {
            this.sweepError = true;
            this.sweepErrorMsg = err.message;
        }
    }
}
