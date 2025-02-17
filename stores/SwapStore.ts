import { action, observable } from 'mobx';
import { address, Network, networks, Transaction } from 'bitcoinjs-lib';

import {
    RefundDetails,
    constructRefundTransaction,
    targetFee,
    detectSwap
} from 'boltz-core';

import ReactNativeBlobUtil from 'react-native-blob-util';

import { themeColor } from '../utils/ThemeUtils';
import ECPairFactory, { ECPairInterface } from 'ecpair';

import ecc from '@bitcoinerlab/secp256k1';
import { initEccLib } from 'bitcoinjs-lib';

export const HOST = 'https://api.testnet.boltz.exchange/v2';

export default class SwapStore {
    @observable public subInfo = {};
    @observable public reverseInfo = {};
    @observable public loading = true;

    @action
    public statusColor = (status: string) => {
        let stateColor;
        switch (status) {
            case 'transaction.claimed':
            case 'invoice.settled':
                stateColor = 'green';
                break;
            case 'invoice.failedToPay':
            case 'swap.expired':
            case 'invoice.expired':
            case 'transaction.lockupFailed':
                stateColor = themeColor('error');
                break;
            default:
                stateColor = 'orange';
                break;
        }

        return stateColor;
    };

    @action
    public formatStatus = (status: string): string => {
        if (!status) return 'No updates found!';

        return status
            .replace(/\./g, ' ') // Replace dots with spaces
            .replace(/([a-z])([A-Z])/g, '$1 $2') // Add space between camelCase
            .toLowerCase() // Convert to lowercase
            .replace(/\b[a-z]/g, (char) => char.toUpperCase()); // Capitalize first letter of each word
    };

    @action
    public getSwapFees = async () => {
        this.loading = true;
        console.log('fetching fees from', HOST);
        try {
            const response = await ReactNativeBlobUtil.fetch(
                'GET',
                `${HOST}/swap/submarine`
            );
            const status = response.info().status;
            if (status == 200) {
                this.subInfo = response.json().BTC.BTC;
                console.log('a', this.subInfo);
            }
        } catch {}

        try {
            const response = await ReactNativeBlobUtil.fetch(
                'GET',
                `${HOST}/swap/reverse`
            );
            const status = response.info().status;
            if (status == 200) {
                this.reverseInfo = response.json().BTC.BTC;
                console.log('b', this.reverseInfo);
            }
        } catch {}
        this.loading = false;
    };

    public getAddress = () => {
        return address;
    };

    public getNetwork = () => {
        return networks['testnet'] as Network;
    };

    public decodeAddress = (asset: string, addr: string): any => {
        const address = this.getAddress();

        const script = address.toOutputScript(addr, this.getNetwork());

        return {
            script
        };
    };

    public getTransaction = () => {
        return Transaction;
    };

    public parsePrivateKey = (privateKey: string): ECPairInterface => {
        initEccLib(ecc);
        const ECPair = ECPairFactory(ecc);
        try {
            return ECPair.fromPrivateKey(Buffer.from(privateKey, 'hex'));

            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (e) {
            // When the private key is not HEX, we try to decode it as WIF
            return ECPair.fromWIF(privateKey);
        }
    };
    @action
    public handleRefund = async (id: string, keys?: any) => {
        try {
            // Example keys object (replace with actual keys)
            const keys = {
                __D: [
                    96, 18, 194, 163, 254, 209, 111, 184, 52, 59, 71, 141, 87,
                    217, 183, 213, 45, 104, 161, 220, 40, 62, 234, 98, 213, 224,
                    75, 215, 129, 82, 243, 34
                ],
                __Q: null,
                compressed: true,
                lowR: false,
                network: {
                    bech32: 'bc',
                    bip32: {
                        private: 76066276,
                        public: 76067358
                    },
                    messagePrefix: 'Bitcoin Signed Message:\n',
                    pubKeyHash: 0,
                    scriptHash: 5,
                    wif: 128
                }
            };

            // Example transaction to refund (replace with actual transaction)
            // ${HOST}/swap/submarine/:swap_id/transaction
            const transactionToRefund = {
                hex: '0200000000010100d88636d7de184be537a9687bb26a61d4494a16fbcf18a7029823f335c666020100000000fdffffff02baee2300000000002251206a67e8c4d7e379bc83be5b3d6ea6683b8ac39cefef697b1c30a5c1418aa738aef86e4a1d000000002251209dafeb8160f4e101622c1f8707d9430b92b39702e06ffdd31ed10fcc08c4e8eb0140057b8e0e50c47ebb01ea67ccd479e9071837c6850a434b4e7374b8f904c06e342c1eba59236b03ff33b73ceabfc1f5d3f67a4972581337b80d86feac6b31eac228423500',
                timeoutBlockHeight: 3491352
            };

            const swap_id = id; // Swap ID (replace with actual ID)
            const refundAddress = 'tb1qjx90tvnddx4p4c3sm03y3akzjkrx6e8rdy5cx8'; // Refund address

            // Decode the refund address
            const output = this.decodeAddress('BTC', refundAddress);
            if (!output) {
                throw new Error('Failed to decode refund address');
            }
            console.log('Decoded refund address:', output?.script);

            // Get fee per vbyte (replace with actual fee estimation logic)
            // ${HOST}/chain/fees
            const feePerVbyte = 738;

            // Parse the lockup transaction
            const lockupTransaction = this.getTransaction().fromHex(
                transactionToRefund.hex
            );
            console.log('Lockup transaction parsed:', lockupTransaction);

            // Define the swap object with redeemScript
            // Can't figure out how to get redeemScript
            const swap = {
                redeemScript: 'redeem_script_here' // Replace with actual redeemScript
            };

            // Convert redeemScript to a Buffer
            const redeemScript = Buffer.from(
                (swap as unknown as { redeemScript: string }).redeemScript,
                'hex'
            );

            // Detect the swap output in the lockup transaction
            const swapOutput = detectSwap(redeemScript, lockupTransaction);
            if (!swapOutput) {
                throw new Error(
                    'Failed to detect swap output in the lockup transaction'
                );
            }

            const constructRefundTransaction =
                this.getConstructRefundTransaction();
            const refundTransaction = {
                transaction: constructRefundTransaction(
                    [
                        {
                            ...swapOutput,
                            txHash: lockupTransaction.getHash(),
                            redeemScript: redeemScript,
                            keys
                            // blindingPrivateKey: parseBlindingKey(swap, true) // probably private key from keys object
                        } as unknown as RefundDetails
                    ],
                    output.script,
                    transactionToRefund.timeoutBlockHeight,
                    feePerVbyte,
                    true // isRbf
                )
            };

            console.log('Refund transaction constructed:', refundTransaction);
        } catch (error) {
            console.error('Refund initiation failed:', error);
            throw error;
        }
    };

    // Helper function to construct refund transaction
    getConstructRefundTransaction = () => {
        const fn = constructRefundTransaction;
        return (
            refundDetails: RefundDetails[],
            outputScript: Buffer,
            timeoutBlockHeight: number,
            feePerVbyte: number,
            isRbf: boolean
        ) =>
            targetFee(
                feePerVbyte,
                (fee) =>
                    fn(
                        refundDetails as never[],
                        outputScript,
                        timeoutBlockHeight,
                        fee,
                        isRbf
                    ),
                true
            );
    };
}
