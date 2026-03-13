import { action, observable, computed, runInAction, reaction } from 'mobx';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { ECPairAPI, ECPairFactory } from 'ecpair';
import ecc from '@bitcoinerlab/secp256k1';
import { crypto, initEccLib } from 'bitcoinjs-lib';
import { HDKey } from '@scure/bip32';
import { validateMnemonic } from '@scure/bip39';

const bip39 = require('bip39');

import { themeColor } from '../utils/ThemeUtils';
import { localeString } from '../utils/LocaleUtils';
import { BIP39_WORD_LIST } from '../utils/Bip39Utils';
import {
    SWAPS_KEY,
    REVERSE_SWAPS_KEY,
    SWAPS_RESCUE_KEY,
    SWAPS_LAST_USED_KEY
} from '../utils/SwapUtils';

import NodeInfoStore from './NodeInfoStore';
import SettingsStore, {
    DEFAULT_SWAP_HOST_MAINNET,
    DEFAULT_SWAP_HOST_TESTNET,
    SWAP_HOST_KEYS_TESTNET,
    SWAP_HOST_KEYS_MAINNET
} from './SettingsStore';

import Storage from '../storage';

import Swap, { SwapState, SwapType } from '../models/Swap';

interface ReverseSwapInfo {
    fees?: {
        percentage?: number;
        minerFees?: {
            claim?: number;
            lockup?: number;
        };
    };
    limits?: {
        minimal?: number;
        maximal?: number;
    };
}

export default class SwapStore {
    @observable public subInfo = {};
    @observable public reverseInfo: ReverseSwapInfo = {};
    @observable public loading = true;
    @observable public apiError = '';
    @observable public swaps: any = [];
    @observable public swapsLoading = false;
    @observable public DERIVATION_PATH = 'm/44/0/0/0';
    @observable ECPair: ECPairAPI;

    nodeInfoStore: NodeInfoStore;
    settingsStore: SettingsStore;

    constructor(nodeInfoStore: NodeInfoStore, settingsStore: SettingsStore) {
        this.nodeInfoStore = nodeInfoStore;
        this.settingsStore = settingsStore;
        initEccLib(ecc);
        this.ECPair = ECPairFactory(ecc);

        reaction(
            () => this.getHost,
            () => this.getSwapFees()
        );
    }

    @action
    public clearError = () => {
        this.loading = true;
        this.apiError = '';
    };

    @computed get getHeaders() {
        const settings = this.settingsStore.settings;
        return settings.swaps?.proEnabled
            ? {
                  'Content-Type': 'application/json',
                  Referral: 'pro'
              }
            : undefined;
    }

    @computed get reverseSwapClaimFee(): number {
        return this.reverseInfo?.fees?.minerFees?.claim || 0;
    }

    @computed get referralId() {
        const settings = this.settingsStore.settings;
        return settings.swaps?.proEnabled ? 'pro' : undefined;
    }

    /** Returns the API host based on network type */
    @computed
    public get getHost() {
        const isTestnet = this.nodeInfoStore?.nodeInfo?.isTestNet;
        const settings = this.settingsStore.settings;

        if (
            settings.swaps?.customHost &&
            (settings.swaps?.hostTestnet === 'Custom' ||
                settings.swaps?.hostMainnet === 'Custom')
        ) {
            return settings.swaps?.customHost;
        }

        return isTestnet
            ? settings.swaps?.hostTestnet || DEFAULT_SWAP_HOST_TESTNET
            : settings.swaps?.hostMainnet || DEFAULT_SWAP_HOST_MAINNET;
    }

    /** Returns the name of the swap service based on host and network */
    @computed
    public get getServiceProvider() {
        const isTestnet = this.nodeInfoStore?.nodeInfo?.isTestNet;
        const endpoint = this.getHost;

        const hostKeys = isTestnet
            ? SWAP_HOST_KEYS_TESTNET
            : SWAP_HOST_KEYS_MAINNET;
        const matchingHost = hostKeys.find(
            (host: any) => host.value === endpoint
        );

        return matchingHost ? matchingHost.key : endpoint;
    }

    @action
    public statusColor = (status: SwapState | string) => {
        let stateColor;
        switch (status) {
            case SwapState.TransactionClaimed:
            case SwapState.InvoiceSettled:
            case SwapState.TransactionRefunded:
                stateColor = 'green';
                break;
            case SwapState.InvoiceFailedToPay:
            case SwapState.SwapExpired:
            case SwapState.InvoiceExpired:
            case SwapState.TransactionLockupFailed:
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
        if (!status || typeof status !== 'string')
            return localeString('views.Swaps.noUpdates');

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

    @action
    public getLockupTransaction = async (id: string) => {
        try {
            const response = await ReactNativeBlobUtil.fetch(
                'GET',
                `${this.getHost}/swap/submarine/${id}/transaction`,
                this.getHeaders
            );

            const status = response.info().status;
            const data = response.json();
            if (status == 200) {
                const lockupTransaction = {
                    id: data.id,
                    hex: data.hex,
                    timeoutBlockHeight: data.timeoutBlockHeight,
                    timeoutEta: data.timeoutEta
                };
                const storedSwaps = await Storage.getItem(SWAPS_KEY);
                const swaps = storedSwaps ? JSON.parse(storedSwaps) : [];
                const updatedSwaps = swaps.map((swap: any) =>
                    swap.id === id
                        ? {
                              ...swap,
                              status,
                              lockupTransaction
                          }
                        : swap
                );

                await Storage.setItem(SWAPS_KEY, JSON.stringify(updatedSwaps));
                return lockupTransaction;
            } else {
                console.log('getLockupTransaction - not found', data);
            }
        } catch (error) {
            console.error('Error in getLockupTransaction:', error);
        }
    };

    @action
    public createSubmarineSwap = async (invoice: any, navigation: any) => {
        runInAction(() => {
            this.loading = true;
        });
        const { implementation } = this.settingsStore;
        const { nodeInfo } = this.nodeInfoStore;
        const nodePubkey = nodeInfo.nodeId;
        try {
            console.log('Creating submarine swap using rescue key...');

            const { keys } = await this.generateNewKey();
            const refundPrivateKey = Buffer.from(keys.privateKey!).toString(
                'hex'
            );
            const refundPublicKey = Buffer.from(keys.publicKey).toString('hex');

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
            responseData.type = SwapType.Submarine;
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
                this.loading = false;
            });

            console.log('Navigating to SwapDetails...');
            navigation.navigate('SwapDetails', {
                swapData: responseData,
                keys,
                endpoint: this.getHost,
                serviceProvider: this.getServiceProvider,
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
            const storedSwaps = await Storage.getItem(SWAPS_KEY);
            const swaps = storedSwaps ? JSON.parse(storedSwaps) : [];

            // Adding the new properties to the swap
            const enrichedSwap = {
                ...newSwap,
                keys,
                invoice,
                endpoint,
                implementation,
                nodePubkey,
                serviceProvider: this.getServiceProvider
            };

            // Add the enriched swap to the beginning of array
            swaps.unshift(enrichedSwap);

            // Save the updated swaps array back to Encrypted Storage
            await Storage.setItem(SWAPS_KEY, JSON.stringify(swaps));
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
        runInAction(() => {
            this.loading = true;
        });
        const { implementation } = this.settingsStore;
        const { nodeInfo } = this.nodeInfoStore;
        const nodePubkey = nodeInfo.nodeId;
        try {
            initEccLib(ecc);
            console.log('Creating reverse swap using rescue key...');
            const { keys, index } = await this.generateNewKey();

            const preimage = await this.derivePreimageFromRescueKey(index);

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
            responseData.type = SwapType.Reverse;
            responseData.preimage = preimage;
            responseData.destinationAddress = destinationAddress;

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
                this.loading = false;
            });

            console.log('Navigating to SwapDetails...');
            navigation.navigate('SwapDetails', {
                swapData: responseData,
                keys,
                endpoint: this.getHost,
                serviceProvider: this.getServiceProvider,
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
        preimage: any,
        endpoint: string,
        implementation: any,
        nodePubkey: string
    ) => {
        try {
            // Retrieve existing swaps
            const storedSwaps = await Storage.getItem(REVERSE_SWAPS_KEY);
            const swaps = storedSwaps ? JSON.parse(storedSwaps) : [];

            // Adding the new properties to the swap
            const enrichedSwap = {
                ...newSwap,
                keys,
                destinationAddress,
                preimage,
                endpoint,
                implementation,
                nodePubkey,
                serviceProvider: this.getServiceProvider
            };

            // Add the enriched swap to the beginning of array
            swaps.unshift(enrichedSwap);

            // Save the updated swaps array back to Encrypted Storage
            await Storage.setItem(REVERSE_SWAPS_KEY, JSON.stringify(swaps));
            console.log(
                'Reverse swap saved successfully to Encrypted Storage.'
            );
        } catch (error: any) {
            console.error('Error saving reverse swap to storage:', error);
            throw error;
        }
    };

    @action
    public fetchAndUpdateSwaps = async () => {
        const { implementation } = this.settingsStore;
        const { nodeInfo } = this.nodeInfoStore;
        const pubkey = nodeInfo?.nodeId;
        console.log('Fetching and updating swaps...');
        this.swapsLoading = true;
        try {
            const storedSubmarineSwaps = await Storage.getItem(SWAPS_KEY);
            const storedReverseSwaps = await Storage.getItem(REVERSE_SWAPS_KEY);

            const submarineSwaps = storedSubmarineSwaps
                ? JSON.parse(storedSubmarineSwaps)
                : [];
            const reverseSwaps = storedReverseSwaps
                ? JSON.parse(storedReverseSwaps)
                : [];

            const allSwaps = [...submarineSwaps, ...reverseSwaps];

            for (const swap of allSwaps) {
                if (!swap?.id) continue;

                const skipStatusesForSubmarineSwap = [
                    SwapState.InvoiceFailedToPay,
                    SwapState.TransactionRefunded,
                    SwapState.TransactionClaimed,
                    SwapState.SwapExpired
                ];

                const skipStatusesForReverseSwap = [
                    SwapState.TransactionRefunded
                ];

                const shouldSkip =
                    (swap.type === SwapType.Submarine &&
                        skipStatusesForSubmarineSwap.includes(swap.status)) ||
                    (swap.type === SwapType.Reverse &&
                        skipStatusesForReverseSwap.includes(swap.status));

                if (shouldSkip) continue;

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
                (s) => s.type === SwapType.Submarine
            );
            const updatedReverseSwaps = allSwaps.filter(
                (s) => s.type === SwapType.Reverse
            );

            await Storage.setItem(
                SWAPS_KEY,
                JSON.stringify(updatedSubmarineSwaps)
            );
            await Storage.setItem(
                REVERSE_SWAPS_KEY,
                JSON.stringify(updatedReverseSwaps)
            );

            // Filter swaps to current pubkey or implementation
            const swaps = allSwaps.filter((swap: any) => {
                return swap.nodePubkey
                    ? swap.nodePubkey === pubkey
                    : swap.implementation === implementation;
            });

            swaps.sort(
                (a, b) =>
                    new Date(b.createdAt).getTime() -
                    new Date(a.createdAt).getTime()
            );

            this.swaps = swaps.map((swap) => new Swap(swap));
            this.swapsLoading = false;
        } catch (error) {
            console.error('Failed to fetch and update swaps:', error);
        } finally {
            this.swapsLoading = false;
        }
    };

    @action
    updateSwapStatus = async (
        swapId: string,
        status: SwapState,
        isSubmarineSwap: boolean,
        failureReason?: string
    ) => {
        try {
            let storedSwaps: any;
            const key = isSubmarineSwap ? SWAPS_KEY : REVERSE_SWAPS_KEY;
            storedSwaps = await Storage.getItem(key);
            const swaps = storedSwaps ? JSON.parse(storedSwaps) : [];

            const updatedSwaps = swaps.map((swap: any) =>
                swap.id === swapId
                    ? {
                          ...swap,
                          status,
                          ...(isSubmarineSwap && failureReason
                              ? { failureReason }
                              : {})
                      }
                    : swap
            );

            await Storage.setItem(key, JSON.stringify(updatedSwaps));
            console.log(
                `Updated ${
                    isSubmarineSwap ? `swap` : `reverse swap`
                } status for swap ID ${swapId} to "${status}"`
            );
        } catch (error) {
            console.error('Error updating swap status in storage:', error);
        }
    };

    @action
    public updateSwapOnRefund = async (swapId: string, txid: string) => {
        try {
            // Retrieve the swaps from encrypted storage
            const storedSwaps = await Storage.getItem(SWAPS_KEY);
            if (!storedSwaps) {
                throw new Error('No swaps found in storage');
            }

            // Parse the swaps array
            const swaps = storedSwaps ? JSON.parse(storedSwaps) : [];

            // Find the swap by swapId
            const swapIndex = swaps.findIndex(
                (swap: any) => swap.id === swapId
            );
            if (swapIndex === -1) {
                throw new Error(`Swap with ID ${swapId} not found`);
            }

            // Update the swap
            swaps[swapIndex].status = SwapState.TransactionRefunded;
            swaps[swapIndex].txid = txid;

            // Save the updated swaps back to encrypted storage
            await Storage.setItem(SWAPS_KEY, JSON.stringify(swaps));

            console.log('Swap updated in storage:', swaps[swapIndex]);
        } catch (error) {
            console.error('Error updating swap in storage:', error);
            throw error;
        }
    };

    @action
    public getPath = (index: number) => `${this.DERIVATION_PATH}/${index}`;

    @action
    public mnemonicToHDKey = (mnemonic: string) => {
        const seed = bip39.mnemonicToSeedSync(mnemonic);
        const hdKey = HDKey.fromMasterSeed(seed);
        return hdKey;
    };

    @action
    public getXpub = (mnemonic: string) => {
        return this.mnemonicToHDKey(mnemonic).publicExtendedKey;
    };

    @action
    public deriveKey = async (index: number) => {
        const mnemonic = await Storage.getItem(SWAPS_RESCUE_KEY);
        if (!mnemonic) {
            throw new Error('Rescue mnemonic not found in storage.');
        }

        const hdKey = this.mnemonicToHDKey(mnemonic);
        const childKey = hdKey.derive(this.getPath(index));

        if (!childKey.privateKey) {
            throw new Error(`No private key at index ${index}`);
        }

        const ecPair = this.ECPair.fromPrivateKey(
            Buffer.from(childKey.privateKey)
        );

        return ecPair;
    };

    @action
    public derivePreimageFromRescueKey = async (index: number) => {
        const mnemonic = await Storage.getItem(SWAPS_RESCUE_KEY);
        if (!mnemonic) {
            throw new Error('Rescue mnemonic not found in storage.');
        }

        const hdKey = this.mnemonicToHDKey(mnemonic);
        const childKey = hdKey.derive(this.getPath(index));

        if (!childKey.privateKey) {
            throw new Error(`No private key at index ${index}`);
        }

        return crypto.sha256(Buffer.from(childKey.privateKey));
    };

    @action
    public generateRescueKey = async () => {
        console.log('GENERATING RESCUE FILE...');
        const mnemonic = bip39.generateMnemonic();
        await Storage.setItem(SWAPS_RESCUE_KEY, mnemonic);

        return mnemonic;
    };

    @action
    public getLastUsedKey = async (): Promise<number> => {
        const storedKey = await Storage.getItem(SWAPS_LAST_USED_KEY);
        const index = storedKey ? parseInt(storedKey, 10) : 0;

        return index;
    };

    @action
    public setLastUsedKey = async (val: number): Promise<void> => {
        await Storage.setItem(SWAPS_LAST_USED_KEY, val.toString());
    };

    @action
    public generateNewKey = async () => {
        const index = await this.getLastUsedKey();
        await this.setLastUsedKey(index + 1);
        const keys = await this.deriveKey(index);
        return { index, keys };
    };

    @action
    public getRescuableSwaps = async ({
        seedArray,
        host
    }: {
        seedArray: string[];
        host: string;
    }) => {
        const mnemonic = seedArray.join(' ');

        if (!validateMnemonic(mnemonic, BIP39_WORD_LIST)) {
            return {
                success: false,
                error: localeString('views.Swaps.rescueKey.invalid')
            };
        }

        const { implementation } = this.settingsStore;
        const { nodeInfo } = this.nodeInfoStore;
        const nodePubkey = nodeInfo.nodeId;

        if (mnemonic) {
            const xpub = this.getXpub(mnemonic);

            try {
                const response = await ReactNativeBlobUtil.fetch(
                    'POST',
                    `${host}/swap/restore`,
                    {
                        'Content-Type': 'application/json'
                    },
                    JSON.stringify({
                        xpub
                    })
                );

                const importedSwaps = JSON.parse(response.data || '[]');

                if (importedSwaps.length > 0) {
                    const storedSwaps = await Storage.getItem(SWAPS_KEY);
                    const existingSwaps = storedSwaps
                        ? JSON.parse(storedSwaps)
                        : [];
                    const existingSwapIds = existingSwaps.map((s: any) => s.id);

                    const rescuedSwaps = await Promise.all(
                        importedSwaps
                            .filter(
                                (swap: any) =>
                                    !existingSwapIds.includes(swap.id)
                            )
                            .map(async (swap: any) => {
                                const isReverseSwap = swap.type === 'reverse';
                                const details = isReverseSwap
                                    ? swap.claimDetails
                                    : swap.refundDetails;

                                const swapDetails: any = {};

                                for (const key in swap) {
                                    if (
                                        key !== 'claimDetails' &&
                                        key !== 'refundDetails'
                                    ) {
                                        swapDetails[key] = swap[key];
                                    }
                                }

                                const { keyIndex } = details;

                                const hdKey = this.mnemonicToHDKey(mnemonic);
                                const childKey = hdKey.derive(
                                    this.getPath(keyIndex)
                                );

                                if (!childKey.privateKey) {
                                    throw new Error(
                                        `No private key at index ${keyIndex}`
                                    );
                                }

                                const ecPair = this.ECPair.fromPrivateKey(
                                    Buffer.from(childKey.privateKey)
                                );

                                const refundPrivateKey = Buffer.from(
                                    ecPair.privateKey!
                                ).toString('hex');
                                const refundPublicKey = Buffer.from(
                                    ecPair.publicKey
                                ).toString('hex');

                                const rescuedSwapBase = {
                                    ...swapDetails,
                                    ...details,
                                    imported: true,
                                    implementation,
                                    nodePubkey,
                                    endpoint: host,
                                    serviceProvider: this.getServiceProvider,
                                    keys: ecPair
                                };

                                if (isReverseSwap) {
                                    return {
                                        ...rescuedSwapBase,
                                        type: SwapType.Reverse
                                    };
                                } else {
                                    return {
                                        ...rescuedSwapBase,
                                        type: SwapType.Submarine,
                                        refundPrivateKey,
                                        refundPublicKey
                                    };
                                }
                            })
                    );

                    const updatedSwaps = [...existingSwaps, ...rescuedSwaps];

                    await Storage.setItem(
                        SWAPS_KEY,
                        JSON.stringify(updatedSwaps)
                    );
                    console.log('Rescued swaps saved to storage');
                    return { success: true };
                } else {
                    return {
                        success: false,
                        error: localeString(
                            'views.Swaps.rescueKey.noSwapsFound'
                        )
                    };
                }
            } catch (error) {
                return {
                    success: false,
                    error: localeString('views.Swaps.rescueKey.incorrectHost')
                };
            }
        }
    };
}
