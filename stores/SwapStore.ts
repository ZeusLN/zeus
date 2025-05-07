import { action, observable, computed, runInAction, reaction } from 'mobx';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { ECPairFactory } from 'ecpair';
import ecc from '@bitcoinerlab/secp256k1';
import { randomBytes } from 'crypto';
import { crypto, initEccLib } from 'bitcoinjs-lib';

import { themeColor } from '../utils/ThemeUtils';

import NodeInfoStore from './NodeInfoStore';
import SettingsStore, {
    DEFAULT_SWAP_HOST_MAINNET,
    DEFAULT_SWAP_HOST_TESTNET
} from './SettingsStore';

import Storage from '../storage';

export default class SwapStore {
    @observable public subInfo = {};
    @observable public reverseInfo = {};
    @observable public loading = true;
    @observable public apiError = '';
    @observable public swapInfo = {};
    @observable public reverseSwapInfo = {};

    nodeInfoStore: NodeInfoStore;
    settingsStore: SettingsStore;

    constructor(nodeInfoStore: NodeInfoStore, settingsStore: SettingsStore) {
        this.nodeInfoStore = nodeInfoStore;
        this.settingsStore = settingsStore;

        reaction(
            () => this.getHost,
            () => this.getSwapFees()
        );
    }

    @computed get getHeaders() {
        const settings = this.settingsStore.settings;
        return settings.proEnabled
            ? {
                  'Content-Type': 'application/json',
                  Referral: 'pro'
              }
            : undefined;
    }

    @computed get referralId() {
        const settings = this.settingsStore.settings;
        return settings.proEnabled ? 'pro' : undefined;
    }

    /** Returns the API host based on network type */
    @computed
    public get getHost() {
        const isTestnet = this.nodeInfoStore?.nodeInfo?.isTestNet;
        const settings = this.settingsStore.settings;

        if (
            settings.customSwapHost &&
            (settings.swapHostTestnet === 'Custom' ||
                settings.swapHostMainnet === 'Custom')
        ) {
            return settings.customSwapHost;
        }

        return isTestnet
            ? settings.swapHostTestnet || DEFAULT_SWAP_HOST_TESTNET
            : settings.swapHostMainnet || DEFAULT_SWAP_HOST_MAINNET;
    }

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
            case 'invoice could not be paid':
            case 'invoice expired':
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
        console.log(`Fetching fees from: ${this.getHost}`);
        try {
            const response = await ReactNativeBlobUtil.fetch(
                'GET',
                `${this.getHost}/swap/submarine`,
                this.getHeaders
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
                `${this.getHost}/swap/reverse`,
                this.getHeaders
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
                `${this.getHost}/swap/submarine/${id}/transaction`,
                this.getHeaders
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
        const { implementation } = this.settingsStore;
        const { nodeInfo } = this.nodeInfoStore;
        const nodePubkey = nodeInfo.nodeId;
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
                `${this.getHost}/swap/submarine`,
                {
                    'Content-Type': 'application/json'
                },
                JSON.stringify({
                    invoice,
                    to: 'BTC',
                    from: 'BTC',
                    refundPublicKey,
                    ...(this.referralId && { referralId: this.referralId })
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

            await this.saveSubmarineSwap(
                responseData,
                keys,
                invoice,
                this.getHost,
                implementation,
                nodePubkey
            );

            runInAction(() => {
                this.swapInfo = responseData;
                this.loading = false;
            });

            console.log('Navigating to SwapDetails...');
            navigation.navigate('SwapDetails', {
                swapData: responseData,
                keys,
                endpoint: this.getHost,
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

    private saveSubmarineSwap = async (
        newSwap: any,
        keys: any,
        invoice: any,
        endpoint: string,
        implementation: any,
        nodePubkey: string
    ) => {
        try {
            // Retrieve existing swaps
            const storedSwaps = await Storage.getItem('swaps');
            const swaps = storedSwaps ? JSON.parse(storedSwaps) : [];

            // Adding the new properties to the swap
            const enrichedSwap = {
                ...newSwap,
                keys,
                invoice,
                endpoint,
                implementation,
                nodePubkey
            };

            // Add the enriched swap to the beginning of array
            swaps.unshift(enrichedSwap);

            // Save the updated swaps array back to Encrypted Storage
            await Storage.setItem('swaps', JSON.stringify(swaps));
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
        const { implementation } = this.settingsStore;
        const { nodeInfo } = this.nodeInfoStore;
        const nodePubkey = nodeInfo.nodeId;
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
                preimageHash: crypto.sha256(preimage).toString('hex'),
                ...(this.referralId && { referralId: this.referralId })
            });

            console.log('Data before sending to API:', data);

            const response = await ReactNativeBlobUtil.fetch(
                'POST',
                `${this.getHost}/swap/reverse`,
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
                preimage,
                this.getHost,
                implementation,
                nodePubkey
            );

            runInAction(() => {
                this.reverseSwapInfo = responseData;
                this.loading = false;
            });

            console.log('Navigating to SwapDetails...');
            navigation.navigate('SwapDetails', {
                swapData: responseData,
                keys,
                endpoint: this.getHost,
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

    @action
    public updateSwapStatuses = async () => {
        console.log('Updating swap statuses...');
        try {
            const storedSubmarineSwaps = await Storage.getItem('swaps');
            const storedReverseSwaps = await Storage.getItem('reverse-swaps');

            const submarineSwaps = storedSubmarineSwaps
                ? JSON.parse(storedSubmarineSwaps)
                : [];
            const reverseSwaps = storedReverseSwaps
                ? JSON.parse(storedReverseSwaps)
                : [];

            const allSwaps = [...submarineSwaps, ...reverseSwaps];

            for (const swap of allSwaps) {
                if (!swap?.id) continue;

                try {
                    const response = await ReactNativeBlobUtil.fetch(
                        'GET',
                        `${this.getHost}/swap/${swap.id}`,
                        this.getHeaders
                    );

                    const result = await response.json();
                    if (result?.status) {
                        swap.status = result.status;
                    }
                } catch (err: any) {
                    console.warn(
                        `Failed to fetch status for swap ${swap.id}`,
                        err
                    );
                }
            }

            const updatedSubmarineSwaps = allSwaps.filter(
                (s) => s.type === 'Submarine'
            );
            const updatedReverseSwaps = allSwaps.filter(
                (s) => s.type === 'Reverse'
            );

            await Storage.setItem(
                'swaps',
                JSON.stringify(updatedSubmarineSwaps)
            );
            await Storage.setItem(
                'reverse-swaps',
                JSON.stringify(updatedReverseSwaps)
            );
        } catch (error) {
            console.error('Updating swap statuses failed:', error);
        }
    };

    private saveReverseSwaps = async (
        newSwap: any,
        keys: any,
        destinationAddress: string,
        preimage: any,
        endpoint: string,
        implementation: any,
        nodePubkey: string
    ) => {
        try {
            // Retrieve existing swaps
            const storedSwaps = await Storage.getItem('reverse-swaps');
            const swaps = storedSwaps ? JSON.parse(storedSwaps) : [];

            // Adding the new properties to the swap
            const enrichedSwap = {
                ...newSwap,
                keys,
                destinationAddress,
                preimage,
                endpoint,
                implementation,
                nodePubkey
            };

            // Add the enriched swap to the beginning of array
            swaps.unshift(enrichedSwap);

            // Save the updated swaps array back to Encrypted Storage
            await Storage.setItem('reverse-swaps', JSON.stringify(swaps));
            console.log(
                'Reverse swap saved successfully to Encrypted Storage.'
            );
        } catch (error: any) {
            console.error('Error saving reverse swap to storage:', error);
            throw error;
        }
    };
}
