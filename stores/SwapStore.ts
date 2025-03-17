import { action, observable, runInAction } from 'mobx';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { ECPairFactory } from 'ecpair';
import ecc from '@bitcoinerlab/secp256k1';
import { randomBytes } from 'crypto';
import { crypto, initEccLib } from 'bitcoinjs-lib';

import { themeColor } from '../utils/ThemeUtils';
import EncryptedStorage from 'react-native-encrypted-storage';

// wss://api.testnet.boltz.exchange/v2/ws
export const HOST = 'https://api.testnet.boltz.exchange/v2';

export default class SwapStore {
    @observable public subInfo = {};
    @observable public reverseInfo = {};
    @observable public loading = true;
    @observable public apiError = '';
    @observable public swapInfo = {};
    @observable public reverseSwapInfo = {};
    @observable public host = HOST;

    @action
    public setHost = (newHost: string) => {
        this.host = newHost;
    };

    @action
    public statusColor = (status: string) => {
        let stateColor;
        switch (status) {
            case 'transaction.claimed':
            case 'invoice.settled':
            case 'transaction.refunded':
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

    public getLockupTransaction = async (id: string) => {
        try {
            const response = await ReactNativeBlobUtil.fetch(
                'GET',
                `${HOST}/swap/submarine/${id}/transaction`
            );

            const status = response.info().status;
            if (status == 200) {
                const data = response.json();
                return {
                    id: data.id,
                    hex: data.hex,
                    timeoutBlockHeight: data.timeoutBlockHeight,
                    timeoutEta: data.timeoutEta
                };
            }
        } catch (error) {
            console.error('Error in getLockupTransaction:', error);
        }
    };

    @action
    public createSubmarineSwap = async (invoice: any, navigation: any) => {
        try {
            console.log('Creating submarine swap...');
            let refundPublicKey: any;
            let refundPrivateKey: any;
            const keys: any = ECPairFactory(ecc).makeRandom();

            refundPrivateKey = Buffer.from(keys.privateKey).toString('hex');
            refundPublicKey = Buffer.from(keys.publicKey).toString('hex');
            console.log(
                'keys private key:',
                Buffer.from(keys.privateKey).toString('hex')
            );
            console.log(
                'Keys public key:',
                Buffer.from(keys.publicKey).toString('hex')
            );

            const response = await ReactNativeBlobUtil.fetch(
                'POST',
                `${HOST}/swap/submarine`,
                {
                    'Content-Type': 'application/json'
                },
                JSON.stringify({
                    invoice,
                    to: 'BTC',
                    from: 'BTC',
                    refundPublicKey
                })
            );

            const responseData = JSON.parse(response.data);
            console.log('Parsed Response Data:', responseData);

            // Check for errors in the response
            if (responseData?.error) {
                runInAction(() => {
                    this.apiError = responseData.error;
                    this.loading = false;
                });
                console.error('Error in API response:', responseData.error);
                return;
            }

            // Add the creation date to the response
            const createdAt = new Date().toISOString();
            responseData.createdAt = createdAt;

            // Add the swap type
            responseData.type = 'Submarine';
            responseData.refundPrivateKey = refundPrivateKey;
            responseData.refundPublicKey = refundPublicKey;

            await this.saveSwapToStorage(responseData, keys, invoice);

            runInAction(() => {
                this.swapInfo = responseData;
                this.loading = false;
            });

            console.log('Navigating to SwapDetails...');
            navigation.navigate('SwapDetails', {
                swapData: responseData,
                keys,
                endpoint: HOST,
                invoice
            });
        } catch (error: any) {
            runInAction(() => {
                this.apiError = error.message || 'An unknown error occurred';
                this.loading = false;
            });
            console.error('Error creating Submarine Swap:', error);
        }
    };

    private saveSwapToStorage = async (
        newSwap: any,
        keys: any,
        invoice: any
    ) => {
        try {
            // Retrieve existing swaps
            const storedSwaps = await EncryptedStorage.getItem('swaps');
            const swaps = storedSwaps ? JSON.parse(storedSwaps) : [];

            // Adding the new properties to the swap
            const enrichedSwap = {
                ...newSwap,
                keys,
                invoice
            };

            // Add the enriched swap to the beginning of array
            swaps.unshift(enrichedSwap);

            // Save the updated swaps array back to Encrypted Storage
            await EncryptedStorage.setItem('swaps', JSON.stringify(swaps));
            console.log('Swap saved successfully to Encrypted Storage.');
        } catch (error: any) {
            console.error('Error saving swap to storage:', error);
            throw error;
        }
    };

    @action
    public createReverseSwap = async (
        destinationAddress: string,
        invoiceAmount: any,
        fee: string,
        navigation: any
    ) => {
        try {
            initEccLib(ecc);
            console.log('Creating reverse swap...');

            const preimage = randomBytes(32);
            const keys: any = ECPairFactory(ecc).makeRandom();

            // Creating a reverse swap
            const data = JSON.stringify({
                invoiceAmount,
                to: 'BTC',
                from: 'BTC',
                claimPublicKey: Buffer.from(keys.publicKey).toString('hex'),
                preimageHash: crypto.sha256(preimage).toString('hex')
            });

            console.log('Data before sending to API:', data);

            const response = await ReactNativeBlobUtil.fetch(
                'POST',
                `${HOST}/swap/reverse`,
                {
                    'Content-Type': 'application/json'
                },
                data
            );

            const responseData = JSON.parse(response.data);
            console.log('Created reverse swap:', responseData);

            // Handle API errors
            if (responseData?.error) {
                runInAction(() => {
                    this.apiError = responseData.error;
                    this.loading = false;
                });
                console.error('Error in API response:', responseData.error);
                return;
            }

            // Add the creation date
            const createdAt = new Date().toISOString();
            responseData.createdAt = createdAt;

            // Add the swap type
            responseData.type = 'Reverse';
            responseData.preimage = preimage;

            await this.saveReverseSwaps(
                responseData,
                keys,
                destinationAddress,
                preimage
            );

            runInAction(() => {
                this.reverseSwapInfo = responseData;
                this.loading = false;
            });

            console.log('Navigating to SwapDetails...');
            navigation.navigate('SwapDetails', {
                swapData: responseData,
                keys,
                endpoint: HOST,
                invoice: destinationAddress,
                fee
            });
        } catch (error: any) {
            runInAction(() => {
                this.apiError = error.message || 'An unknown error occurred';
                this.loading = false;
            });
            console.error('Error creating reverse swap:', error);
        }
    };

    private saveReverseSwaps = async (
        newSwap: any,
        keys: any,
        destinationAddress: string,
        preimage: any
    ) => {
        try {
            // Retrieve existing swaps
            const storedSwaps = await EncryptedStorage.getItem('reverse-swaps');
            const swaps = storedSwaps ? JSON.parse(storedSwaps) : [];

            // Adding the new properties to the swap
            const enrichedSwap = {
                ...newSwap,
                keys,
                destinationAddress,
                preimage
            };

            // Add the enriched swap to the beginning of array
            swaps.unshift(enrichedSwap);

            // Save the updated swaps array back to Encrypted Storage
            await EncryptedStorage.setItem(
                'reverse-swaps',
                JSON.stringify(swaps)
            );
            console.log(
                'Reverse swap saved successfully to Encrypted Storage.'
            );
        } catch (error: any) {
            console.error('Error saving reverse swap to storage:', error);
            throw error;
        }
    };
}
