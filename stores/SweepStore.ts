import { action, observable } from 'mobx';
import * as bitcoin from 'bitcoinjs-lib';
import { toXOnly } from 'bitcoinjs-lib/src/psbt/bip371';
import { getPublicKey } from '@noble/secp256k1';
// @ts-ignore:next-line
import { decode as wifDecode } from 'wif';

import NodeInfoStore from './NodeInfoStore';

import { AddressType } from '../utils/WIFUtils';
import { localeString } from '../utils/LocaleUtils';
import UrlUtils from '../utils/UrlUtils';
import ecc from '../zeus_modules/noble_ecc';

bitcoin.initEccLib(ecc);

export default class SweepStore {
    @observable sweepErrorMsg: string | null = null;
    @observable sweepError: boolean = false;
    @observable onChainBalance: number;
    @observable destination: string;
    @observable txHex: string | null = null;
    @observable txId: string | null = null;
    @observable fee: number = 0;
    @observable feeRate: string = '';
    @observable sweptAddressTypes: AddressType[] = [];
    @observable unsweptTaprootSats: number = 0;
    @observable utxos: any[] = [];
    @observable psbt: bitcoin.Psbt;
    @observable privateKey: string;
    @observable wif: string;
    @observable network: bitcoin.Network;
    @observable vBytes: number;
    @observable bytes: number;
    @observable valueToSend: number;
    nodeInfoStore: NodeInfoStore;

    constructor(nodeInfoStore: NodeInfoStore) {
        this.nodeInfoStore = nodeInfoStore;
    }

    @action
    resetSweepError() {
        this.sweepError = false;
        this.sweepErrorMsg = '';
    }

    async getUtxosFromAddress(address: string) {
        const res = await fetch(
            `${UrlUtils.getMempoolApiUrl(
                this.nodeInfoStore.nodeInfo
            )}/address/${address}/utxo`
        );
        if (!res.ok) {
            throw new Error(localeString('views.Wif.errorFetchingUtxos'));
        }

        const utxos = await res.json();
        return utxos;
    }

    async detectAddressesWithUtxos(
        publicKey: Buffer,
        network: bitcoin.Network
    ): Promise<{ address: string; type: AddressType; utxos: any[] }[]> {
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

        // A key may have received funds on multiple script types over its
        // lifetime, so collect them all to avoid leaving funds behind
        const detected: { address: string; type: AddressType; utxos: any[] }[] =
            [];
        for (const { type, address } of addresses) {
            const utxos = await this.getUtxosFromAddress(address);
            if (utxos && utxos.length > 0) {
                detected.push({ type, address, utxos });
            }
        }

        if (detected.length === 0) {
            throw new Error(localeString('views.Wif.noUtxosFound'));
        }

        return detected;
    }

    async addInputsForType(
        type: AddressType,
        utxos: any[],
        publicKey: Buffer
    ): Promise<number> {
        let totalSats = 0;

        if (type === 'p2pkh') {
            for (const utxo of utxos) {
                const { txid, vout } = utxo;
                totalSats += utxo.value;
                const res = await fetch(
                    `${UrlUtils.getMempoolApiUrl(
                        this.nodeInfoStore.nodeInfo
                    )}/tx/${txid}/hex`
                );

                if (!res.ok)
                    throw new Error(
                        localeString('views.Wif.failedToFetchTxHex', {
                            txid
                        })
                    );

                const rawTxHex = await res.text();

                this.psbt.addInput({
                    hash: txid,
                    index: vout,
                    nonWitnessUtxo: Buffer.from(rawTxHex, 'hex')
                });
            }
        } else if (type === 'p2wpkh') {
            for (const utxo of utxos) {
                const { txid, vout } = utxo;

                const res = await fetch(
                    `${UrlUtils.getMempoolApiUrl(
                        this.nodeInfoStore.nodeInfo
                    )}/tx/${txid}`
                );
                if (!res.ok)
                    throw new Error(
                        localeString('views.Wif.failedToFetchTxDetails', {
                            txid
                        })
                    );

                const tx = await res.json();
                const output = tx.vout[vout];

                if (!output)
                    throw new Error(
                        localeString('views.Sweep.outputIndexNotFound', {
                            vout,
                            txid
                        })
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
        } else if (type === 'p2sh-p2wpkh') {
            for (const utxo of utxos) {
                const { txid, vout } = utxo;

                const value = utxo.value;
                totalSats += value;
                const res = await fetch(
                    `${UrlUtils.getMempoolApiUrl(
                        this.nodeInfoStore.nodeInfo
                    )}/tx/${txid}`
                );
                if (!res.ok)
                    throw new Error(
                        localeString('views.Wif.failedToFetchTxDetails', {
                            txid
                        })
                    );

                const tx = await res.json();
                const output = tx.vout[vout];

                if (!output)
                    throw new Error(
                        localeString('views.Wif.outputNotFound', {
                            vout,
                            txid
                        })
                    );
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
                        pubkey: publicKey,
                        network: this.network
                    }).output
                });
            }
        }

        return totalSats;
    }

    @action
    async prepareSweepInputs(wif: string) {
        this.wif = wif;
        this.onChainBalance = 0;
        this.unsweptTaprootSats = 0;
        this.sweptAddressTypes = [];
        this.utxos = [];
        const { nodeInfo } = this.nodeInfoStore;
        const network = nodeInfo?.isTestNet
            ? nodeInfo?.isRegTest
                ? bitcoin.networks.regtest
                : bitcoin.networks.testnet
            : bitcoin.networks.bitcoin;
        this.network = network;

        try {
            const { privateKey } = wifDecode(this.wif);
            this.privateKey = Buffer.from(privateKey).toString('hex');
            const publicKey = Buffer.from(getPublicKey(privateKey, true));

            const detected = await this.detectAddressesWithUtxos(
                publicKey,
                this.network
            );

            // P2TR sweeps are not yet supported — ZEUS-3276
            const taproot = detected.find(({ type }) => type === 'p2tr');
            const supported = detected.filter(({ type }) => type !== 'p2tr');

            this.unsweptTaprootSats = taproot
                ? taproot.utxos.reduce(
                      (sum: number, utxo: any) => sum + utxo.value,
                      0
                  )
                : 0;

            if (supported.length === 0) {
                this.sweepError = true;
                this.sweepErrorMsg = localeString(
                    'views.Wif.addressTypeNotSupported'
                );
                return;
            }

            this.sweptAddressTypes = supported.map(({ type }) => type);
            this.utxos = supported.flatMap(({ utxos }) => utxos);
            let totalSats = 0;

            this.psbt = new bitcoin.Psbt({ network: this.network });

            for (const { type, utxos } of supported) {
                totalSats += await this.addInputsForType(
                    type,
                    utxos,
                    publicKey
                );
            }
            this.onChainBalance = totalSats;
        } catch (err: any) {
            console.error(err);
            this.sweepError = true;
            this.sweepErrorMsg = err.message;
        }
    }

    @action
    async finalizeSweepTransaction(feeRate: string) {
        try {
            this.feeRate = feeRate;
            const privateKey = Buffer.from(this.privateKey, 'hex');

            const fullPub = ecc.pointFromScalar(privateKey, true);
            if (!fullPub)
                throw new Error(localeString('views.Wif.failedToDerivePubkey'));

            const signer: bitcoin.Signer = {
                publicKey: Buffer.from(fullPub),
                sign: (hash: Buffer) => Buffer.from(ecc.sign(hash, privateKey))
            };

            this.psbt.setLocktime(0);

            const dummyPsbt = bitcoin.Psbt.fromBuffer(this.psbt.toBuffer(), {
                network: this.network
            });

            dummyPsbt.addOutput({
                address: this.destination,
                value: this.onChainBalance
            });

            for (let i = 0; i < dummyPsbt.inputCount; i++) {
                dummyPsbt.signInput(i, signer);
            }

            dummyPsbt.finalizeAllInputs();
            const dummyTx = dummyPsbt.extractTransaction();
            const vbytes = dummyTx.virtualSize();

            this.vBytes = vbytes;
            this.fee = Math.ceil(vbytes * Number(feeRate));
            this.valueToSend = this.onChainBalance - this.fee;

            if (this.valueToSend <= 0)
                throw new Error(
                    localeString('views.Wif.insufficientFundsAfterFees')
                );

            this.psbt.addOutput({
                address: this.destination,
                value: this.valueToSend
            });

            for (let i = 0; i < this.psbt.inputCount; i++) {
                this.psbt.signInput(i, signer);
            }

            this.psbt.finalizeAllInputs();
            const tx = this.psbt.extractTransaction();

            this.txHex = tx.toHex();
            this.bytes = this.txHex.length / 2;
            this.txId = tx.getId();
        } catch (err: any) {
            console.error('Sweep error:', err);
            this.sweepError = true;
            this.sweepErrorMsg = err.message;
        }
    }
}
