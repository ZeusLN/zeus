import { action, observable, computed, runInAction, reaction } from 'mobx';
import ReactNativeBlobUtil from 'react-native-blob-util';
import BigNumber from 'bignumber.js';
import { ECPairAPI, ECPairFactory } from 'ecpair';
import ecc from '@bitcoinerlab/secp256k1';
import { crypto, initEccLib, Transaction } from 'bitcoinjs-lib';
import { HDKey } from '@scure/bip32';
import { mnemonicToSeedSync, generateMnemonic } from '@scure/bip39';

import { themeColor } from '../utils/ThemeUtils';
import { localeString } from '../utils/LocaleUtils';
import { networkFetch } from '../utils/NetworkUtils';
import { BIP39_WORD_LIST } from '../utils/Bip39Utils';
import UrlUtils from '../utils/UrlUtils';
import {
    isPlausibleSatPerVbyte,
    reverseClaimMinerFee
} from '../utils/FeeUtils';
import {
    SWAPS_KEY,
    REVERSE_SWAPS_KEY,
    SWAPS_RESCUE_KEY,
    SWAPS_LAST_USED_KEY,
    isValidRescueKey,
    verifyReverseSwapInvoice,
    verifyReverseSwapResponse,
    verifySubmarineSwapResponse,
    checkLockupOutput,
    MIN_REVERSE_SWAP_CLAIM_BLOCKS,
    MAX_SUBMARINE_SWAP_TIMEOUT_BLOCKS,
    bigCeil,
    calculateReceiveAmount,
    calculateSendAmount,
    deriveSwapPreimage,
    rescuedLockupFloor,
    isAlreadyBroadcastError
} from '../utils/SwapUtils';
import AddressUtils from '../utils/AddressUtils';
import BackendUtils from '../utils/BackendUtils';
import Bolt11Utils from '../utils/Bolt11Utils';

import NodeInfoStore from './NodeInfoStore';
import SettingsStore, {
    DEFAULT_SWAP_HOST_MAINNET,
    DEFAULT_SWAP_HOST_TESTNET,
    SWAP_HOST_KEYS_TESTNET,
    SWAP_HOST_KEYS_MAINNET
} from './SettingsStore';

import Storage from '../storage';

import Swap, { SwapState, SwapType } from '../models/Swap';
import {
    privateKeyFromKeys,
    preimageHexFrom
} from '../models/ClaimTransaction';

export type ReverseLockupFetch =
    | { status: 'found'; hex: string }
    | { status: 'none' }
    | { status: 'unavailable' };

export type SwapCheck = {
    // 'confirm-amount': every check passed, but nothing trusted says how
    // much the lockup should hold; ask the user before claiming
    status: 'ok' | 'unconfirmed' | 'invalid' | 'unavailable' | 'confirm-amount';
    reason?: string;
    // the lockup output's value in sats, with 'confirm-amount'
    amount?: number;
    // this wallet's own payment for the swap in sats, with 'confirm-amount'
    // when the lockup falls short of the floor for it
    paidAmount?: number;
    // the transaction spending the lockup, with 'lockup-spent'
    spendingTxid?: string;
    // whose spend that is, with 'lockup-spent'; unset when it could not
    // be looked up
    spentBy?: LockupSpender;
};

export type ReverseLockupCheck = SwapCheck;

export type LockupSpender = 'claim' | 'refund';

interface SubmarineSwapInfo {
    // the quote's pair hash, sent back so the host refuses a changed quote
    hash?: string;
    fees?: {
        percentage?: number;
        minerFees?: number;
    };
    limits?: {
        minimal?: number;
        maximal?: number;
    };
}

interface ReverseSwapInfo {
    // identifies the quote; sent back on creation so the provider refuses
    // a swap priced with fees other than the ones the user saw
    hash?: string;
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

// Error the provider returns when the pair hash sent on creation no
// longer matches its current quote
const INVALID_PAIR_HASH_ERROR = 'invalid pair hash';

// Boltz computes the service fee as Math.ceil(percentage / 100 * amount)
// in floating point, which can land just above a whole number and charge
// one sat more than the exact fee (0.07% of 1,000,000 sats gives 701).
// The lockup minimum allows for that one sat.
const REVERSE_LOCKUP_ROUNDING_SLACK = 1;

// The fields a rescued swap takes from the host's /swap/restore response,
// at the top level and inside claimDetails/refundDetails
const RESCUE_SWAP_FIELDS = ['id', 'status', 'createdAt'];
const RESCUE_DETAIL_FIELDS = [
    'tree',
    'keyIndex',
    'lockupAddress',
    'serverPublicKey',
    'timeoutBlockHeight',
    'amount',
    'preimageHash'
];

const pickFields = (source: any, fields: string[]): { [key: string]: any } => {
    const picked: { [key: string]: any } = {};
    if (!source || typeof source !== 'object') return picked;
    for (const field of fields) {
        if (source[field] !== undefined) picked[field] = source[field];
    }
    return picked;
};

const hasPreimage = (swap: any) => !!preimageHexFrom(swap?.preimage);

// The amount in sats of a stored swap's invoice, or undefined when there is
// none or it can't be decoded
const invoiceAmountSats = (invoice?: string): number | undefined => {
    if (!invoice) return undefined;
    try {
        const sats = Number(Bolt11Utils.decode(invoice)?.satoshis);
        return sats > 0 ? sats : undefined;
    } catch (e) {
        return undefined;
    }
};

/**
 * Keeps one stored entry per swap ID. Running the rescue again used to
 * append a second copy of a reverse swap already re-filed under
 * REVERSE_SWAPS_KEY; keep the copy with a preimage, else the first.
 */
const dedupeStoredSwaps = (submarineSwaps: any[], reverseSwaps: any[]) => {
    const kept = new Map<string, any>();
    for (const swap of [...reverseSwaps, ...submarineSwaps]) {
        if (!swap?.id) continue;
        const current = kept.get(swap.id);
        if (!current || (!hasPreimage(current) && hasPreimage(swap))) {
            kept.set(swap.id, swap);
        }
    }
    const isKept = (swap: any) => !swap?.id || kept.get(swap.id) === swap;
    return {
        submarineSwaps: submarineSwaps.filter(isKept),
        reverseSwaps: reverseSwaps.filter(isKept)
    };
};

/**
 * Gives a stored reverse swap the preimage it lacks. Swaps rescued before
 * the preimage was re-derived were stored without one, so their claims
 * fail. The preimage is only attached if it comes from the key the stored
 * swap already uses and matches any preimage hash on record.
 */
const repairRescuedPreimage = (stored: any, rescued: any) => {
    if (hasPreimage(stored)) return;

    const rescuedKey = privateKeyFromKeys(rescued.keys);
    if (stored.keys && privateKeyFromKeys(stored.keys) !== rescuedKey) {
        console.error(
            `Not repairing rescued swap ${stored.id}: its stored key is not the one at the restored key index`
        );
        return;
    }
    if (
        stored.preimageHash !== undefined &&
        String(stored.preimageHash).toLowerCase() !==
            crypto.sha256(rescued.preimage).toString('hex')
    ) {
        console.error(
            `Not repairing rescued swap ${stored.id}: preimage hash does not match`
        );
        return;
    }

    stored.preimage = rescued.preimage;
    if (!stored.keys) stored.keys = rescued.keys;
};

export default class SwapStore {
    @observable public subInfo: SubmarineSwapInfo = {};
    @observable public reverseInfo: ReverseSwapInfo = {};
    @observable public loading = true;
    @observable public apiError = '';
    @observable public swaps: any = [];
    @observable public swapsLoading = false;
    @observable public DERIVATION_PATH = 'm/44/0/0/0';
    @observable ECPair: ECPairAPI;
    // host the swap rates were last fetched from; rates are only
    // fetched from the Swaps view, never on startup
    @observable public fetchedRatesHost: string | undefined;

    nodeInfoStore: NodeInfoStore;
    settingsStore: SettingsStore;

    // Every read-modify-write of SWAPS_KEY or REVERSE_SWAPS_KEY runs
    // through withSwapStorage, one at a time. Without it, a write that read
    // the list before another write landed puts its stale copy back, which
    // can drop a stored claim or its txid.
    private swapStorageQueue: Promise<unknown> = Promise.resolve();

    private withSwapStorage = <T>(update: () => Promise<T>): Promise<T> => {
        const run = this.swapStorageQueue.then(update, update);
        this.swapStorageQueue = run.catch(() => undefined);
        return run;
    };

    constructor(nodeInfoStore: NodeInfoStore, settingsStore: SettingsStore) {
        this.nodeInfoStore = nodeInfoStore;
        this.settingsStore = settingsStore;
        initEccLib(ecc);
        this.ECPair = ECPairFactory(ecc);

        reaction(
            () => this.getHost,
            (host) => {
                // only refetch when rates were already fetched this
                // session; getHost also changes on startup as settings
                // load and node info resolves, and rates must not be
                // fetched on startup. Never on testnet: swaps are mainnet
                // only, and switching to a testnet wallet after loading
                // mainnet rates would otherwise fetch from a dead host
                if (
                    this.fetchedRatesHost &&
                    this.fetchedRatesHost !== host &&
                    !this.nodeInfoStore?.nodeInfo?.isTestNet
                ) {
                    this.getSwapFees();
                }
            }
        );
    }

    @computed get claimMinerFee(): number {
        return this.reverseInfo?.fees?.minerFees?.claim || 0;
    }

    // The claim fee a reverse swap started now at this rate would store
    // and pay, or undefined if it must not start (see reverseClaimMinerFee)
    getReverseClaimMinerFee = (feeRate: unknown): number | undefined =>
        reverseClaimMinerFee(this.reverseInfo?.fees?.minerFees?.claim, feeRate);

    getReverseSwapReceiveAmount = (
        onchainAmount: number | undefined,
        swapClaimMinerFee?: number
    ): number => {
        const fee = swapClaimMinerFee ?? this.claimMinerFee;
        return (onchainAmount || 0) - fee;
    };

    @action
    public clearError = () => {
        this.loading = true;
        this.apiError = '';
    };

    /**
     * Whether the selected provider has a Pro tier. `proEnabled` is a single
     * flag shared across both networks while `pro` is a per-host property, so
     * the two can disagree whenever the host changes without going through the
     * picker — a migration, or switching to a network whose selected host
     * differs. views/Swaps/Settings.tsx only renders the Pro switch for `pro`
     * hosts, so a stale flag would otherwise keep sending `Referral: pro` to a
     * provider that has no Pro tier with no way to turn it off. Resolved from
     * the stored selection rather than getHost, so a custom host matches the
     * `Custom` entry instead of its URL.
     */
    @computed get isProHost(): boolean {
        const isTestnet = this.nodeInfoStore?.nodeInfo?.isTestNet;
        const settings = this.settingsStore.settings;

        const selected = isTestnet
            ? settings.swaps?.hostTestnet || DEFAULT_SWAP_HOST_TESTNET
            : settings.swaps?.hostMainnet || DEFAULT_SWAP_HOST_MAINNET;

        const hostKeys = isTestnet
            ? SWAP_HOST_KEYS_TESTNET
            : SWAP_HOST_KEYS_MAINNET;

        return (
            hostKeys.find((host: any) => host.value === selected)?.pro === true
        );
    }

    @computed get getHeaders() {
        const settings = this.settingsStore.settings;
        return settings.swaps?.proEnabled && this.isProHost
            ? {
                  'Content-Type': 'application/json',
                  Referral: 'pro'
              }
            : undefined;
    }

    @computed get referralId() {
        const settings = this.settingsStore.settings;
        return settings.swaps?.proEnabled && this.isProHost ? 'pro' : undefined;
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

    // Number of the latest getSwapFees call. An older call that finishes
    // later must not replace the quote the Swaps screen shows.
    private swapFeesRequest = 0;

    @action
    public getSwapFees = async () => {
        const request = ++this.swapFeesRequest;
        const superseded = () => request !== this.swapFeesRequest;
        this.loading = true;
        this.apiError = '';
        const host = this.getHost;
        console.log(`Fetching fees from: ${host}`);
        try {
            const response = await networkFetch({
                method: 'GET',
                url: `${host}/swap/submarine`,
                headers: this.getHeaders,
                enableTor: this.settingsStore.enableTor
            });
            if (superseded()) return;
            const status = response.info().status;
            if (status == 200) {
                const data = response.json();
                const subInfo = data?.BTC?.BTC;
                if (subInfo) {
                    this.subInfo = subInfo;
                    console.log('Submarine rates', this.subInfo);
                } else {
                    console.warn(
                        'Unexpected submarine swap fee response:',
                        JSON.stringify(data)
                    );
                    this.apiError = localeString('views.Swaps.fetchFeesFailed');
                }
            } else if (status == 403) {
                const data = response.json();
                this.apiError = data?.error || data?.message;
                this.loading = false;
                return;
            }
        } catch (e) {
            if (superseded()) return;
            console.error('Error fetching submarine swap fees:', e);
            this.apiError = localeString('views.Swaps.fetchFeesFailed');
        }

        try {
            const response = await networkFetch({
                method: 'GET',
                url: `${host}/swap/reverse`,
                headers: this.getHeaders,
                enableTor: this.settingsStore.enableTor
            });
            if (superseded()) return;
            const status = response.info().status;
            if (status == 200) {
                const data = response.json();
                const reverseInfo = data?.BTC?.BTC;
                if (reverseInfo) {
                    this.reverseInfo = reverseInfo;
                    console.log('Reverse rates', this.reverseInfo);
                } else {
                    console.warn(
                        'Unexpected reverse swap fee response:',
                        JSON.stringify(data)
                    );
                    this.apiError = localeString('views.Swaps.fetchFeesFailed');
                }
            } else if (status == 403) {
                const data = response.json();
                this.apiError = data?.error || data?.message;
                this.loading = false;
                return;
            }
        } catch (e) {
            if (superseded()) return;
            console.error('Error fetching reverse swap fees:', e);
            this.apiError = localeString('views.Swaps.fetchFeesFailed');
        }
        // only record the host once both fetches succeed, so a failed
        // fetch is retried the next time the Swaps view gains focus
        if (!this.apiError) this.fetchedRatesHost = host;
        this.loading = false;
    };

    @action
    public getLockupTransaction = async (id: string, endpoint?: string) => {
        try {
            const host = endpoint || this.getHost;
            const response = await networkFetch({
                method: 'GET',
                url: `${host}/swap/submarine/${id}/transaction`,
                headers: this.getHeaders,
                enableTor: this.settingsStore.enableTor
            });

            // named httpStatus, not status: spreading a local called
            // `status` into a swap is what overwrote the swap's own
            // SwapState here
            const httpStatus = response.info().status;
            const data = response.json();
            if (httpStatus == 200) {
                const lockupTransaction = {
                    id: data.id,
                    hex: data.hex,
                    timeoutBlockHeight: data.timeoutBlockHeight,
                    timeoutEta: data.timeoutEta
                };
                await this.withSwapStorage(async () => {
                    const storedSwaps = await Storage.getItem(SWAPS_KEY);
                    const swaps = storedSwaps ? JSON.parse(storedSwaps) : [];
                    const updatedSwaps = swaps.map((swap: any) =>
                        swap.id === id
                            ? {
                                  ...swap,
                                  lockupTransaction
                              }
                            : swap
                    );

                    await Storage.setItem(
                        SWAPS_KEY,
                        JSON.stringify(updatedSwaps)
                    );
                });
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
        // the quote the Swaps screen showed when the user started the swap
        const fees = this.subInfo?.fees;
        const pairHash = this.subInfo?.hash;
        const apiUrl = UrlUtils.getMempoolApiUrl(nodeInfo);
        try {
            // Run the checks that don't need the host's answer before the
            // host creates the swap: the Swaps screen retries with the same
            // invoice, and the host refuses a second swap for its payment
            // hash.
            if (!fees) {
                runInAction(() => {
                    this.apiError = localeString('views.Swaps.fetchFeesFailed');
                    this.loading = false;
                });
                return;
            }
            const tip = await this.fetchTipHeight(apiUrl);
            if (tip.status !== 'ok') {
                runInAction(() => {
                    this.apiError = localeString(
                        'views.Swaps.tipHeightUnavailable'
                    );
                    this.loading = false;
                });
                console.error(
                    'Submarine swap tip height unavailable:',
                    tip.reason
                );
                return;
            }

            console.log('Creating submarine swap using rescue key...');

            const { keys } = await this.generateNewKey();
            const refundPrivateKey = Buffer.from(keys.privateKey!).toString(
                'hex'
            );
            const refundPublicKey = Buffer.from(keys.publicKey).toString('hex');

            const response = await networkFetch({
                method: 'POST',
                url: `${this.getHost}/swap/submarine`,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    invoice,
                    to: 'BTC',
                    from: 'BTC',
                    refundPublicKey,
                    ...(pairHash && { pairHash }),
                    ...(this.referralId && { referralId: this.referralId })
                }),
                enableTor: this.settingsStore.enableTor
            });

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

            // Verify the response before saving it or showing an address to
            // fund: the swap tree must pay the host only against our
            // invoice's payment hash and refund our key, the address must be
            // that tree's taproot output, and the host must not ask for more
            // than the amount the Swaps screen showed, as for a reverse swap.
            const decodedInvoice = Bolt11Utils.decode(invoice);
            // the provider rounds msat to the nearest sat, so round up here
            const invoiceSats = bigCeil(
                new BigNumber(decodedInvoice.num_msat).div(1000)
            );
            const responseCheck = verifySubmarineSwapResponse({
                swapTree: responseData.swapTree,
                address: responseData.address,
                serverPubKey: responseData.claimPublicKey,
                timeoutBlockHeight: responseData.timeoutBlockHeight,
                expectedAmount: responseData.expectedAmount,
                ourPubKey: Buffer.from(keys.publicKey),
                preimageHash: Buffer.from(
                    decodedInvoice.payment_hash || '',
                    'hex'
                ),
                maxExpectedAmount: calculateSendAmount(
                    invoiceSats,
                    fees.percentage || 0,
                    fees.minerFees || 0,
                    false
                ).toNumber(),
                bech32Prefix:
                    AddressUtils.bitcoinNetworkForNode(nodeInfo).bech32
            });
            if (!responseCheck.valid) {
                runInAction(() => {
                    // the text does not name a swap direction, so the
                    // reverse swap's key is reused here
                    this.apiError = localeString(
                        'views.Swaps.invalidReverseSwapResponse'
                    );
                    this.loading = false;
                });
                console.error(
                    'Submarine swap response verification failed:',
                    responseCheck.reason
                );
                return;
            }

            const timeout = this.checkSubmarineSwapTimeout(
                responseData.timeoutBlockHeight,
                tip.height
            );
            if (timeout.status !== 'ok') {
                runInAction(() => {
                    this.apiError = localeString(
                        'views.Swaps.invalidReverseSwapResponse'
                    );
                    this.loading = false;
                });
                console.error(
                    'Submarine swap timeout verification failed:',
                    timeout.reason
                );
                return;
            }

            // The pay button and QR code use the BIP21 URI. Build it from the
            // verified address and amount instead of using the host's.
            responseData.bip21 = `bitcoin:${
                responseData.address
            }?amount=${new BigNumber(responseData.expectedAmount)
                .shiftedBy(-8)
                .toFixed()}`;

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

            await this.withSwapStorage(async () => {
                // Retrieve existing swaps
                const storedSwaps = await Storage.getItem(SWAPS_KEY);
                const swaps = storedSwaps ? JSON.parse(storedSwaps) : [];

                // Add the enriched swap to the beginning of array
                swaps.unshift(enrichedSwap);

                // Save the updated swaps array back to Encrypted Storage
                await Storage.setItem(SWAPS_KEY, JSON.stringify(swaps));
            });
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
        // Read the quote the Swaps screen showed before the first await:
        // a getSwapFees call that finishes during creation replaces
        // reverseInfo, and the checks below must use the quote the user saw
        const fees = this.reverseInfo?.fees;
        const pairHash = this.reverseInfo?.hash;

        // Decided once, before the invoice exists, and stored with the
        // swap: the Swaps screen showed this fee, and the claim pays it
        const claimMinerFee = this.getReverseClaimMinerFee(fee);
        if (claimMinerFee === undefined) {
            // without a usable rate the problem is ours, not the host's
            runInAction(() => {
                this.apiError = localeString(
                    isPlausibleSatPerVbyte(fee)
                        ? 'views.Swaps.invalidReverseSwapResponse'
                        : 'views.Swaps.reverseClaimFeeRateRequired'
                );
                this.loading = false;
            });
            return;
        }
        // the host locks up the amount less its service and lockup fees,
        // and the claim pays its fee from that
        const expectedLockup = calculateReceiveAmount(
            new BigNumber(invoiceAmount || 0),
            fees?.percentage || 0,
            Number(fees?.minerFees?.lockup) || 0,
            true
        );
        if (expectedLockup.isLessThanOrEqualTo(claimMinerFee)) {
            runInAction(() => {
                this.apiError = localeString(
                    'views.Swaps.reverseClaimFeeExceedsAmount'
                );
                this.loading = false;
            });
            return;
        }

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
                ...(this.referralId && { referralId: this.referralId }),
                ...(typeof pairHash === 'string' && { pairHash })
            });

            console.log('Data before sending to API:', data);

            const response = await networkFetch({
                method: 'POST',
                url: `${this.getHost}/swap/reverse`,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: data,
                enableTor: this.settingsStore.enableTor
            });

            const responseData = JSON.parse(response.data);
            console.log('Created reverse swap:', responseData);

            // The provider's fees changed since the quote: fetch the new
            // quote and ask the user to retry. The caller must recompute
            // the amounts it shows, since the Swaps screen keeps them in
            // its own state.
            if (responseData?.error === INVALID_PAIR_HASH_ERROR) {
                await this.getSwapFees();
                runInAction(() => {
                    if (!this.apiError) {
                        this.apiError = localeString(
                            'views.Swaps.swapFeesChanged'
                        );
                    }
                    this.loading = false;
                });
                return 'fees-changed';
            }

            // Handle API errors
            if (responseData?.error) {
                runInAction(() => {
                    this.apiError = responseData.error;
                    this.loading = false;
                });
                console.error('Error in API response:', responseData.error);
                return;
            }

            // Verify the host-supplied invoice before it can be paid: its
            // payment hash must equal sha256(our preimage) and its amount
            // must match what we requested. Without this a malicious or
            // compromised host could return an invoice paying itself with
            // an unrelated hash, breaking swap atomicity and losing the
            // user's lightning funds.
            const invoiceCheck = verifyReverseSwapInvoice(
                responseData.invoice,
                crypto.sha256(preimage).toString('hex'),
                Number(invoiceAmount)
            );
            if (!invoiceCheck.valid) {
                runInAction(() => {
                    this.apiError = localeString(
                        'views.Swaps.invalidReverseSwapInvoice'
                    );
                    this.loading = false;
                });
                console.error(
                    'Reverse swap invoice verification failed:',
                    invoiceCheck.reason
                );
                return;
            }

            // Verify the rest of the response before saving or paying: the
            // swap tree must pay our key against our preimage hash, and the
            // lockup address must be that tree's taproot output. Otherwise
            // a host could point the claim at an output it controls and
            // still learn the preimage when we claim. The provider must
            // also lock up at least the amount the Swaps screen showed
            // plus the claim fee, which the claim pays out of the lockup,
            // less REVERSE_LOCKUP_ROUNDING_SLACK.
            const minOnchainAmount = calculateReceiveAmount(
                new BigNumber(invoiceAmount),
                fees?.percentage || 0,
                new BigNumber(claimMinerFee)
                    .plus(fees?.minerFees?.lockup || 0)
                    .toNumber(),
                true
            )
                // neither the slack nor a negative claim quote may lower
                // the minimum below the amount shown
                .plus(
                    Math.max(claimMinerFee - REVERSE_LOCKUP_ROUNDING_SLACK, 0)
                )
                .toNumber();
            const responseCheck = verifyReverseSwapResponse({
                swapTree: responseData.swapTree,
                lockupAddress: responseData.lockupAddress,
                serverPubKey: responseData.refundPublicKey,
                timeoutBlockHeight: responseData.timeoutBlockHeight,
                onchainAmount: responseData.onchainAmount,
                ourPubKey: Buffer.from(keys.publicKey),
                preimageHash: crypto.sha256(preimage),
                minOnchainAmount
            });
            if (!responseCheck.valid) {
                runInAction(() => {
                    this.apiError = localeString(
                        'views.Swaps.invalidReverseSwapResponse'
                    );
                    this.loading = false;
                });
                console.error(
                    'Reverse swap response verification failed:',
                    responseCheck.reason
                );
                return;
            }

            // the claim pays claimMinerFee from the lockup, so a lockup no
            // larger than it leaves nothing to receive
            if (!(Number(responseData.onchainAmount) > claimMinerFee)) {
                runInAction(() => {
                    this.apiError = localeString(
                        'views.Swaps.invalidReverseSwapResponse'
                    );
                    this.loading = false;
                });
                console.error(
                    'Reverse swap response verification failed:',
                    'lockup-below-claim-fee'
                );
                return;
            }

            const deadline = await this.verifyReverseSwapDeadline(
                responseCheck.timeoutBlockHeight,
                UrlUtils.getMempoolApiUrl(this.nodeInfoStore.nodeInfo)
            );
            if (deadline.status !== 'ok') {
                runInAction(() => {
                    this.apiError = localeString(
                        deadline.status === 'unavailable'
                            ? 'views.Swaps.tipHeightUnavailable'
                            : 'views.Swaps.invalidReverseSwapResponse'
                    );
                    this.loading = false;
                });
                return;
            }

            // Add the creation date
            const createdAt = new Date().toISOString();
            responseData.createdAt = createdAt;

            // Add the swap type
            responseData.type = SwapType.Reverse;
            responseData.preimage = preimage;
            responseData.destinationAddress = destinationAddress;
            responseData.claimMinerFee = claimMinerFee;
            // kept so a swap reopened later claims at the rate chosen here
            responseData.claimFeeRate = Number(fee);
            // onchainAmount passed the check above, so the claim can use it
            // as the lockup floor
            responseData.onchainAmountVerified = true;

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

    // Fetch a fresh tip from the same independent observer used for the
    // lockup. The wallet's cached height may be stale or absent (LndHub/NWC).
    private fetchTipHeight = async (
        apiUrl: string
    ): Promise<
        | { status: 'ok'; height: number }
        | { status: 'unavailable'; reason: string }
    > => {
        try {
            const response = await networkFetch({
                method: 'GET',
                url: `${apiUrl}/blocks/tip/height`,
                enableTor: this.settingsStore.enableTor
            });
            if (response.info().status !== 200) {
                return { status: 'unavailable', reason: 'tip-unavailable' };
            }
            const text = (await response.text()).trim();
            const height = /^\d+$/.test(text) ? Number(text) : NaN;
            if (!Number.isSafeInteger(height) || height <= 0) {
                return { status: 'unavailable', reason: 'invalid-tip' };
            }
            return { status: 'ok', height };
        } catch {
            return { status: 'unavailable', reason: 'tip-unavailable' };
        }
    };

    private verifyReverseSwapDeadline = async (
        timeoutBlockHeight: number,
        apiUrl: string
    ): Promise<ReverseLockupCheck> => {
        const tip = await this.fetchTipHeight(apiUrl);
        if (tip.status !== 'ok') return tip;
        if (timeoutBlockHeight - tip.height < MIN_REVERSE_SWAP_CLAIM_BLOCKS) {
            return { status: 'invalid', reason: 'refund-deadline' };
        }
        return { status: 'ok' };
    };

    // Until its timeout a submarine swap's coins only come back if the
    // provider co-signs the refund, so the timeout must be ahead of the tip
    // and no further than MAX_SUBMARINE_SWAP_TIMEOUT_BLOCKS.
    private checkSubmarineSwapTimeout = (
        timeoutBlockHeight: number,
        tipHeight: number
    ): SwapCheck => {
        const blocksLeft = timeoutBlockHeight - tipHeight;
        if (blocksLeft <= 0 || blocksLeft > MAX_SUBMARINE_SWAP_TIMEOUT_BLOCKS) {
            return { status: 'invalid', reason: 'refund-timeout' };
        }
        return { status: 'ok' };
    };

    /**
     * Checks a reverse swap's lockup before the claim reveals the
     * preimage. The provider's swap update only supplies the transaction
     * hex; the transaction itself is looked up by txid on the user's
     * mempool instance, and it must be confirmed and pay the swap's
     * taproot output at least the swap's on-chain amount. That output must
     * still be unspent, with at least six blocks before its refund deadline.
     * The swap tree and lockup address are re-checked here too, covering swaps
     * saved or rescued before creation-time verification existed.
     *
     * 'unconfirmed' (including not yet seen) and 'unavailable' are
     * retryable; 'invalid' means the claim must not be attempted.
     */
    public verifyReverseLockup = async (
        swap: Swap,
        providerTxHex: string,
        { confirmedLockupAmount }: { confirmedLockupAmount?: number } = {}
    ): Promise<ReverseLockupCheck> => {
        const privateKeyHex = privateKeyFromKeys(swap.keys);
        const preimageHex = preimageHexFrom(swap.preimage as any);
        if (!privateKeyHex || !preimageHex) {
            return { status: 'invalid', reason: 'missing-keys' };
        }
        // fromPrivateKey throws on a key that is not 32 bytes or out of
        // range; the caller has no catch, so an exception here would leave
        // the swap screen loading with no error
        let ourPubKey: Uint8Array;
        try {
            ourPubKey = this.ECPair.fromPrivateKey(
                Buffer.from(privateKeyHex, 'hex')
            ).publicKey;
        } catch (e) {
            return { status: 'invalid', reason: 'invalid-key' };
        }

        const responseCheck = verifyReverseSwapResponse({
            swapTree: swap.swapTreeDetails,
            lockupAddress: swap.effectiveLockupAddress,
            serverPubKey: swap.refundPubKey,
            timeoutBlockHeight: swap.timeoutBlockHeight,
            onchainAmount: swap.onchainAmount,
            ourPubKey: Buffer.from(ourPubKey),
            preimageHash: crypto.sha256(Buffer.from(preimageHex, 'hex'))
        });
        if (!responseCheck.valid) {
            return { status: 'invalid', reason: responseCheck.reason };
        }

        let lockup: Transaction;
        try {
            lockup = Transaction.fromHex(providerTxHex);
        } catch (e) {
            return { status: 'invalid', reason: 'undecodable-lockup' };
        }

        const txid = lockup.getId();
        const apiUrl = UrlUtils.getMempoolApiUrl(this.nodeInfoStore.nodeInfo);
        let tx: any;
        try {
            const response = await networkFetch({
                method: 'GET',
                url: `${apiUrl}/tx/${txid}`,
                enableTor: this.settingsStore.enableTor
            });
            const httpStatus = response.info().status;
            // not seen yet is retryable: an honest lockup may not have
            // reached this instance, and one that never appears is
            // never claimed
            if (httpStatus === 404) {
                return { status: 'unconfirmed', reason: 'lockup-not-found' };
            }
            if (httpStatus !== 200) {
                return {
                    status: 'unavailable',
                    reason: `http-${httpStatus}`
                };
            }
            tx = response.json();
        } catch (e) {
            return { status: 'unavailable', reason: 'request-failed' };
        }

        // A rescued swap's on-chain amount could only come from the host,
        // so none is stored. Compare the lockup with this wallet's own
        // payment for the swap instead. With no such payment, or a lockup
        // short of the floor for it, the user has to confirm the amount
        // before the preimage is revealed.
        //
        // A swap created here before the creation check marked it (v13.2.2,
        // which never checked onchainAmount, and v13.2.3) can't trust its
        // stored figure as a low floor. A lockup below it still fails, as
        // the host's own figure, and its invoice, which is what this wallet
        // pays, adds the same floor a rescued swap's payment does.
        const amountUnchecked = !swap.imported && !swap.onchainAmountVerified;
        let minAmount: number | undefined = swap.onchainAmount ?? undefined;
        let paidAmount: number | undefined;
        let needsConfirmation = false;
        if (minAmount == null || amountUnchecked) {
            const invoiceAmount =
                confirmedLockupAmount == null && amountUnchecked
                    ? invoiceAmountSats(swap.invoice)
                    : undefined;
            if (confirmedLockupAmount != null) {
                minAmount = Math.max(minAmount ?? 0, confirmedLockupAmount);
            } else if (invoiceAmount) {
                paidAmount = invoiceAmount;
            } else {
                const paid = await this.findOwnPaymentAmount(
                    crypto
                        .sha256(Buffer.from(preimageHex, 'hex'))
                        .toString('hex')
                );
                if (paid === undefined) {
                    return {
                        status: 'unavailable',
                        reason: 'payment-lookup-failed'
                    };
                }
                if (paid === null) {
                    needsConfirmation = true;
                } else {
                    paidAmount = paid;
                }
            }
        }
        const outputStatus = checkLockupOutput(
            tx,
            responseCheck.outputScript,
            minAmount
        );
        if (outputStatus === 'unconfirmed') return { status: 'unconfirmed' };
        if (outputStatus !== 'ok')
            return { status: 'invalid', reason: outputStatus };

        // Match the native FindVout on the exact transaction it will spend.
        // The outspend lookup must not accidentally check a second output
        // to the same address while the first has already been refunded.
        const program = responseCheck.outputScript.toString('hex').slice(4);
        const vout = lockup.outs.findIndex(
            (output) => output.script.toString('hex').slice(4) === program
        );
        if (
            vout < 0 ||
            !lockup.outs[vout].script.equals(responseCheck.outputScript)
        ) {
            return { status: 'invalid', reason: 'missing-output' };
        }
        try {
            const response = await networkFetch({
                method: 'GET',
                url: `${apiUrl}/tx/${txid}/outspend/${vout}`,
                enableTor: this.settingsStore.enableTor
            });
            if (response.info().status !== 200) {
                return {
                    status: 'unavailable',
                    reason: 'outspend-unavailable'
                };
            }
            const outspend = response.json();
            if (outspend?.spent === true) {
                const spendingTxid =
                    typeof outspend.txid === 'string'
                        ? outspend.txid
                        : undefined;
                return {
                    status: 'invalid',
                    reason: 'lockup-spent',
                    spendingTxid,
                    spentBy: spendingTxid
                        ? await this.lockupSpentBy(
                              spendingTxid,
                              txid,
                              vout,
                              preimageHex
                          )
                        : undefined
                };
            }
            if (outspend?.spent !== false) {
                return { status: 'unavailable', reason: 'invalid-outspend' };
            }
        } catch {
            return { status: 'unavailable', reason: 'outspend-unavailable' };
        }
        // Read the tip last so the other lookups cannot age the height check.
        const deadline = await this.verifyReverseSwapDeadline(
            responseCheck.timeoutBlockHeight,
            apiUrl
        );
        if (deadline.status !== 'ok') return deadline;
        if (!needsConfirmation && paidAmount == null) return deadline;

        const scriptHex = responseCheck.outputScript.toString('hex');
        const amount = Number(
            (tx?.vout || []).find(
                (output: any) =>
                    (output?.scriptpubkey || '').toLowerCase() === scriptHex
            )?.value
        );
        if (needsConfirmation) return { status: 'confirm-amount', amount };
        if (amount >= rescuedLockupFloor(paidAmount!)) return deadline;
        return { status: 'confirm-amount', amount, paidAmount };
    };

    /**
     * Whose spend of a reverse swap lockup output a transaction is, read
     * from the witness of its input for that output. A key-path spend
     * needs this wallet's key share and a claim-leaf spend reveals the
     * preimage, so both are a claim, whichever device sent it. Any other
     * spend is the host's refund. undefined when it could not be looked up.
     */
    public lockupSpentBy = async (
        spendingTxid: string,
        lockupTxid: string,
        vout: number,
        preimageHex: string
    ): Promise<LockupSpender | undefined> => {
        // the txid comes from the mempool instance and goes into a URL
        if (!/^[0-9a-f]{64}$/i.test(spendingTxid)) return undefined;
        const apiUrl = UrlUtils.getMempoolApiUrl(this.nodeInfoStore.nodeInfo);
        try {
            const response = await ReactNativeBlobUtil.fetch(
                'GET',
                `${apiUrl}/tx/${spendingTxid}`
            );
            if (response.info().status !== 200) return undefined;
            const vin = response.json()?.vin;
            if (!Array.isArray(vin)) return undefined;
            const input = vin.find(
                (i: any) =>
                    typeof i?.txid === 'string' &&
                    i.txid.toLowerCase() === lockupTxid.toLowerCase() &&
                    i.vout === vout
            );
            if (!input || !Array.isArray(input.witness)) return undefined;
            const witness: string[] = input.witness.map((item: any) =>
                String(item).toLowerCase()
            );
            if (witness.length === 1) return 'claim';
            if (preimageHex && witness.includes(preimageHex.toLowerCase())) {
                return 'claim';
            }
            return 'refund';
        } catch {
            return undefined;
        }
    };

    /**
     * Whether a stored reverse claim is still worth broadcasting. 'ok'
     * while the lockup it spends is unspent or spent by this claim,
     * 'unavailable' when the lockup could not be looked up, and 'invalid'
     * with 'lockup-spent' once another transaction spent it, such as the
     * host's refund after the timeout.
     */
    public checkStoredClaim = async (
        claimHex: string,
        preimage: any
    ): Promise<ReverseLockupCheck> => {
        let claim: Transaction;
        try {
            claim = Transaction.fromHex(claimHex);
        } catch (e) {
            return { status: 'invalid', reason: 'undecodable-claim' };
        }
        const input = claim.ins[0];
        if (!input) return { status: 'invalid', reason: 'undecodable-claim' };
        const lockupTxid = Buffer.from(input.hash).reverse().toString('hex');
        const apiUrl = UrlUtils.getMempoolApiUrl(this.nodeInfoStore.nodeInfo);
        let outspend: any;
        try {
            const response = await ReactNativeBlobUtil.fetch(
                'GET',
                `${apiUrl}/tx/${lockupTxid}/outspend/${input.index}`
            );
            if (response.info().status !== 200) {
                return {
                    status: 'unavailable',
                    reason: 'outspend-unavailable'
                };
            }
            outspend = response.json();
        } catch {
            return { status: 'unavailable', reason: 'outspend-unavailable' };
        }
        if (outspend?.spent === false) return { status: 'ok' };
        if (outspend?.spent !== true) {
            return { status: 'unavailable', reason: 'invalid-outspend' };
        }
        const spendingTxid =
            typeof outspend.txid === 'string' ? outspend.txid : undefined;
        if (spendingTxid?.toLowerCase() === claim.getId()) {
            return { status: 'ok' };
        }
        return {
            status: 'invalid',
            reason: 'lockup-spent',
            spendingTxid,
            spentBy: spendingTxid
                ? await this.lockupSpentBy(
                      spendingTxid,
                      lockupTxid,
                      input.index,
                      preimageHexFrom(preimage) || ''
                  )
                : undefined
        };
    };

    /**
     * The amount in sats of this wallet's own Lightning payment with the
     * given hash. null when the wallet has no such payment, or it records
     * no amount; undefined when the payments could not be listed.
     */
    public findOwnPaymentAmount = async (
        paymentHash: string
    ): Promise<number | null | undefined> => {
        let payments: any[];
        try {
            const response = await BackendUtils.getPayments();
            payments = response?.payments || [];
        } catch (e) {
            console.error('Could not list payments for a swap', e);
            return undefined;
        }

        // Read the fields directly rather than through the Payment model,
        // which would pull the store graph into SwapStore's imports
        const decode = (paymentRequest?: string) => {
            if (!paymentRequest) return undefined;
            try {
                return Bolt11Utils.decode(paymentRequest);
            } catch (e) {
                return undefined;
            }
        };
        const paymentRequestOf = (p: any) => p?.payment_request || p?.bolt11;
        const hash = paymentHash.toLowerCase();
        const payment = payments.find((p: any) => {
            const ownHash =
                typeof p?.payment_hash === 'string'
                    ? p.payment_hash
                    : decode(paymentRequestOf(p))?.payment_hash;
            return ownHash?.toLowerCase() === hash;
        });
        if (!payment) return null;

        let amount = Number(payment.value_sat);
        if (!(amount > 0)) {
            amount =
                Number(String(payment.amount_msat ?? '').replace('msat', '')) /
                1000;
        }
        // CLN reports no amount for a payment that hasn't completed
        if (!(amount > 0)) {
            amount = Number(decode(paymentRequestOf(payment))?.satoshis);
        }
        return amount > 0 ? amount : null;
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

            await this.withSwapStorage(async () => {
                // Retrieve existing swaps
                const storedSwaps = await Storage.getItem(REVERSE_SWAPS_KEY);
                const swaps = storedSwaps ? JSON.parse(storedSwaps) : [];

                // Add the enriched swap to the beginning of array
                swaps.unshift(enrichedSwap);

                // Save the updated swaps array back to Encrypted Storage
                await Storage.setItem(REVERSE_SWAPS_KEY, JSON.stringify(swaps));
            });
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

            // Statuses are fetched against this snapshot, then merged into
            // a fresh read below: other fields may be written to the stored
            // swaps while the requests are out
            const statuses = new Map<string, SwapState>();

            for (const swap of [...submarineSwaps, ...reverseSwaps]) {
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

                // poll the server the swap was created on; the currently
                // selected provider may differ (e.g. after the ZEUS ->
                // Boltz host migration) and won't know this swap's ID
                const host = swap.endpoint || this.getHost;

                try {
                    const response = await networkFetch({
                        method: 'GET',
                        url: `${host}/swap/${swap.id}`,
                        headers: this.getHeaders,
                        enableTor: this.settingsStore.enableTor
                    });

                    const result = await response.json();
                    if (result?.status) {
                        statuses.set(swap.id, result.status);
                    }
                } catch (err: any) {
                    console.warn(
                        `Failed to fetch status for swap ${swap.id}`,
                        err
                    );
                }
            }

            const allSwaps: any[] = await this.withSwapStorage(async () => {
                const latestSubmarineSwaps = await Storage.getItem(SWAPS_KEY);
                const latestReverseSwaps = await Storage.getItem(
                    REVERSE_SWAPS_KEY
                );
                const merged = [
                    ...(latestSubmarineSwaps
                        ? JSON.parse(latestSubmarineSwaps)
                        : []),
                    ...(latestReverseSwaps
                        ? JSON.parse(latestReverseSwaps)
                        : [])
                ].map((swap: any) =>
                    swap?.id && statuses.has(swap.id)
                        ? { ...swap, status: statuses.get(swap.id) }
                        : swap
                );

                await Storage.setItem(
                    SWAPS_KEY,
                    JSON.stringify(
                        merged.filter((s) => s.type === SwapType.Submarine)
                    )
                );
                await Storage.setItem(
                    REVERSE_SWAPS_KEY,
                    JSON.stringify(
                        merged.filter((s) => s.type === SwapType.Reverse)
                    )
                );
                return merged;
            });

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
            const key = isSubmarineSwap ? SWAPS_KEY : REVERSE_SWAPS_KEY;
            await this.withSwapStorage(async () => {
                const storedSwaps = await Storage.getItem(key);
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
            });
            console.log(
                `Updated ${
                    isSubmarineSwap ? `swap` : `reverse swap`
                } status for swap ID ${swapId} to "${status}"`
            );
        } catch (error) {
            console.error('Error updating swap status in storage:', error);
        }
    };

    /**
     * Records the address a swap's claim should pay out to.
     *
     * A rescued reverse swap has none: the destination is attached
     * client-side at creation and never sent to the host, so it cannot come
     * back from /swap/restore. The claim path resolves one lazily and
     * persists it here, so that a later attempt at the same swap pays out
     * to the address already chosen rather than burning a fresh one.
     *
     * Rescued swaps are written to SWAPS_KEY whatever their type and only
     * moved to REVERSE_SWAPS_KEY by the next fetchAndUpdateSwaps, so both
     * lists are searched.
     */
    @action
    public updateSwapDestinationAddress = async (
        swapId: string,
        destinationAddress: string
    ): Promise<boolean> => {
        try {
            const updated = await this.updateStoredSwap(swapId, {
                destinationAddress,
                claimAddressFromWallet: true
            });
            if (updated) {
                console.log(
                    `Updated destination address for swap ID ${swapId}`
                );
            }
            return updated;
        } catch (error) {
            console.error(
                'Error updating swap destination address in storage:',
                error
            );
            return false;
        }
    };

    /**
     * Writes fields onto a stored swap, wherever it is filed. Rescued swaps
     * stay in SWAPS_KEY until the next fetchAndUpdateSwaps, so both lists
     * are searched.
     */
    private updateStoredSwap = async (
        swapId: string,
        fields: { [key: string]: any }
    ): Promise<boolean> =>
        this.withSwapStorage(async () => {
            for (const key of [REVERSE_SWAPS_KEY, SWAPS_KEY]) {
                const storedSwaps = await Storage.getItem(key);
                const swaps = storedSwaps ? JSON.parse(storedSwaps) : [];
                if (!swaps.some((swap: any) => swap?.id === swapId)) continue;

                await Storage.setItem(
                    key,
                    JSON.stringify(
                        swaps.map((swap: any) =>
                            swap?.id === swapId ? { ...swap, ...fields } : swap
                        )
                    )
                );
                return true;
            }
            console.error(`No stored swap found for swap ID ${swapId}`);
            return false;
        });

    /**
     * Stores a reverse swap's signed claim before it is first broadcast.
     * The claim may already have handed the preimage to the host, so if
     * the broadcast fails it has to be retried with this transaction.
     */
    public saveClaimTransaction = (
        swapId: string,
        claimTransactionHex: string
    ) => this.updateStoredSwap(swapId, { claimTransactionHex });

    public saveClaimTxid = (swapId: string, claimTxid: string) =>
        this.updateStoredSwap(swapId, { claimTxid });

    /**
     * Broadcasts a swap claim or refund: first to the user's mempool
     * instance, then to the swap host if that fails. A transaction that is
     * already in the mempool or a block counts as broadcast, including one
     * whose outputs are spent, which bitcoind rejects as missing inputs.
     * The mempool instance is skipped when it is not on the node's network.
     * Returns the txid, or throws with every error.
     */
    public broadcastSwapTransaction = async (
        txHex: string,
        endpoint?: string
    ): Promise<string> => {
        const txid = Transaction.fromHex(txHex).getId();
        const errors: string[] = [];

        const { nodeInfo } = this.nodeInfoStore;
        const apiUrl = UrlUtils.mempoolServesNetwork(nodeInfo)
            ? UrlUtils.getMempoolApiUrl(nodeInfo)
            : undefined;

        if (
            apiUrl &&
            (await this.postTransaction(
                `${apiUrl}/tx`,
                { 'Content-Type': 'text/plain' },
                txHex,
                [200],
                errors
            ))
        ) {
            return txid;
        }

        if (
            endpoint &&
            (await this.postTransaction(
                `${endpoint}/chain/BTC/transaction`,
                { 'Content-Type': 'application/json' },
                JSON.stringify({ hex: txHex }),
                [200, 201],
                errors
            ))
        ) {
            return txid;
        }

        if (apiUrl && (await this.isTransactionKnown(apiUrl, txid))) {
            return txid;
        }

        if (!errors.length) {
            errors.push('no broadcast endpoint for this network');
        }
        throw new Error(errors.join('; '));
    };

    // Whether a broadcast endpoint took the transaction or already has it.
    // Anything else is added to errors with the response text.
    private postTransaction = async (
        url: string,
        headers: { [key: string]: string },
        body: string,
        okStatuses: number[],
        errors: string[]
    ): Promise<boolean> => {
        try {
            const response = await ReactNativeBlobUtil.fetch(
                'POST',
                url,
                headers,
                body
            );
            const httpStatus = response.info().status;
            const text = String((await response.text()) || '');
            if (
                okStatuses.includes(httpStatus) ||
                isAlreadyBroadcastError(text)
            )
                return true;
            errors.push(`${url}: ${httpStatus} ${text}`);
        } catch (e: any) {
            errors.push(`${url}: ${e?.message ?? e}`);
        }
        return false;
    };

    // Whether the mempool instance has the transaction in its mempool or
    // a block. Lookup errors count as unknown.
    private isTransactionKnown = async (
        apiUrl: string,
        txid: string
    ): Promise<boolean> => {
        try {
            const response = await ReactNativeBlobUtil.fetch(
                'GET',
                `${apiUrl}/tx/${txid}`
            );
            if (response.info().status !== 200) return false;
            return JSON.parse(String(await response.text()))?.txid === txid;
        } catch (e) {
            return false;
        }
    };

    /**
     * The lockup transaction of a reverse swap, from its host. Used to
     * claim a swap whose invoice was settled before the claim was
     * broadcast; the invoice.settled update carries no transaction.
     *
     * 'none' is the host answering that it has no lockup for the swap.
     * A failed request, a server error or an answer without a hex is
     * 'unavailable', and worth asking again.
     */
    public getReverseLockupTransactionHex = async (
        id: string,
        endpoint: string
    ): Promise<ReverseLockupFetch> => {
        try {
            const response = await ReactNativeBlobUtil.fetch(
                'GET',
                `${endpoint}/swap/reverse/${id}/transaction`
            );
            const httpStatus = response.info().status;
            if (
                httpStatus >= 400 &&
                httpStatus < 500 &&
                httpStatus !== 408 &&
                httpStatus !== 429
            ) {
                return { status: 'none' };
            }
            if (httpStatus !== 200) return { status: 'unavailable' };
            const hex = response.json()?.hex;
            return typeof hex === 'string' && hex
                ? { status: 'found', hex }
                : { status: 'unavailable' };
        } catch (e) {
            console.error('Could not fetch the reverse swap lockup', e);
            return { status: 'unavailable' };
        }
    };

    /**
     * Resolves the address a reverse swap's claim should pay out to.
     *
     * A swap created on this device carries the destination the user picked.
     * A rescued one does not, so fall back to a fresh address from the wallet
     * in use and persist it, so a later attempt claims to the same address
     * instead of generating another. Returns '' when there is nowhere to
     * claim to.
     */
    public resolveClaimAddress = async ({
        swapId,
        destinationAddress,
        canReceiveOnchain,
        getNewAddress
    }: {
        swapId: string;
        destinationAddress?: string;
        canReceiveOnchain: boolean;
        getNewAddress: () => Promise<string | undefined>;
    }): Promise<string> => {
        if (destinationAddress) return destinationAddress;

        if (!canReceiveOnchain) {
            console.error(
                'Cannot claim swap: this wallet cannot generate an on-chain address'
            );
            return '';
        }

        try {
            const address = await getNewAddress();
            if (!address) return '';

            await this.updateSwapDestinationAddress(swapId, address);
            return address;
        } catch (e) {
            console.error('Error generating an address to claim swap to', e);
            return '';
        }
    };

    @action
    public updateSwapOnRefund = async (swapId: string, txid: string) => {
        try {
            await this.withSwapStorage(async () => {
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

                console.log(
                    `Swap ${swapId} updated in storage: status=${swaps[swapIndex].status}`
                );
            });
        } catch (error) {
            console.error('Error updating swap in storage:', error);
            throw error;
        }
    };

    @action
    public getPath = (index: number) => `${this.DERIVATION_PATH}/${index}`;

    @action
    public mnemonicToHDKey = (mnemonic: string) => {
        const seed = mnemonicToSeedSync(mnemonic);
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

        return deriveSwapPreimage(childKey.privateKey);
    };

    @action
    public generateRescueKey = async () => {
        console.log('GENERATING RESCUE FILE...');
        // Always generate an independent rescue key. Never reuse the wallet's
        // BIP-39 mnemonic (e.g. an LDK Node seed): the swap master xpub is
        // shared with the swap provider, so a rescue key derived from the
        // wallet seed would expose the wallet's own key tree.
        const mnemonic = generateMnemonic(BIP39_WORD_LIST);
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

    /**
     * Builds the stored form of one swap from a /swap/restore response, or
     * returns null for an entry without an ID or key details, and for a
     * reverse swap whose preimage hash doesn't match the key at its keyIndex.
     */
    private buildRescuedSwap = (
        swap: any,
        mnemonic: string,
        {
            implementation,
            nodePubkey,
            host
        }: { implementation: string; nodePubkey: string; host: string }
    ): any | null => {
        const isReverseSwap = swap.type === 'reverse';
        const details = isReverseSwap ? swap.claimDetails : swap.refundDetails;
        if (!swap?.id || !details) return null;

        // Only fields describing the host's side of the swap are taken from
        // the response. The claim address, keys and preimage are ours to set:
        // a host that could set the claim address would be paid the lockup
        // and get the preimage to settle the hold invoice.
        const swapDetails = pickFields(swap, RESCUE_SWAP_FIELDS);
        const hostDetails = pickFields(details, RESCUE_DETAIL_FIELDS);

        const { keyIndex } = details;

        const hdKey = this.mnemonicToHDKey(mnemonic);
        const childKey = hdKey.derive(this.getPath(keyIndex));

        if (!childKey.privateKey) {
            throw new Error(`No private key at index ${keyIndex}`);
        }

        const ecPair = this.ECPair.fromPrivateKey(
            Buffer.from(childKey.privateKey)
        );

        const refundPrivateKey = Buffer.from(ecPair.privateKey!).toString(
            'hex'
        );
        const refundPublicKey = Buffer.from(ecPair.publicKey).toString('hex');

        const rescuedSwapBase = {
            ...swapDetails,
            ...hostDetails,
            imported: true,
            implementation,
            nodePubkey,
            endpoint: host,
            serviceProvider: this.getServiceProvider,
            keys: ecPair
        };

        if (isReverseSwap) {
            // Re-derive the preimage. Only reverse swaps have one of ours: the
            // host knows just its hash, so without this the rescued claim is
            // built with an empty preimage, fails every retry, and the host
            // reclaims the lockup at timeout.
            const preimage = deriveSwapPreimage(childKey.privateKey);

            // A hash that doesn't match means the host sent the wrong
            // keyIndex; claiming would reveal the preimage of another swap's
            // hold invoice
            if (
                hostDetails.preimageHash !== undefined &&
                String(hostDetails.preimageHash).toLowerCase() !==
                    crypto.sha256(preimage).toString('hex')
            ) {
                console.error(
                    `Skipping rescued swap ${swap.id}: preimage hash does not match key index ${keyIndex}`
                );
                return null;
            }

            return {
                ...rescuedSwapBase,
                type: SwapType.Reverse,
                preimage
            };
        } else {
            return {
                ...rescuedSwapBase,
                type: SwapType.Submarine,
                refundPrivateKey,
                refundPublicKey
            };
        }
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

        if (!isValidRescueKey(mnemonic)) {
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
                const response = await networkFetch({
                    method: 'POST',
                    url: `${host}/swap/restore`,
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        xpub
                    }),
                    enableTor: this.settingsStore.enableTor
                });

                const importedSwaps = JSON.parse(response.data || '[]');

                if (importedSwaps.length > 0) {
                    await this.withSwapStorage(async () => {
                        // Rescued swaps are written to SWAPS_KEY whatever
                        // their type and only re-filed by the next
                        // fetchAndUpdateSwaps, so a swap rescued before can
                        // be under either key
                        const storedSubmarineSwaps = await Storage.getItem(
                            SWAPS_KEY
                        );
                        const storedReverseSwaps = await Storage.getItem(
                            REVERSE_SWAPS_KEY
                        );
                        const { submarineSwaps, reverseSwaps } =
                            dedupeStoredSwaps(
                                storedSubmarineSwaps
                                    ? JSON.parse(storedSubmarineSwaps)
                                    : [],
                                storedReverseSwaps
                                    ? JSON.parse(storedReverseSwaps)
                                    : []
                            );
                        const existingSwaps = [
                            ...submarineSwaps,
                            ...reverseSwaps
                        ];

                        const newSwaps: any[] = [];
                        for (const swap of importedSwaps) {
                            const rescued = this.buildRescuedSwap(
                                swap,
                                mnemonic,
                                {
                                    implementation,
                                    nodePubkey,
                                    host
                                }
                            );
                            if (!rescued) continue;

                            const existing = existingSwaps.find(
                                (s: any) => s?.id === rescued.id
                            );
                            if (!existing) {
                                newSwaps.push(rescued);
                                existingSwaps.push(rescued);
                            } else if (rescued.type === SwapType.Reverse) {
                                repairRescuedPreimage(existing, rescued);
                            }
                        }

                        await Storage.setItem(
                            SWAPS_KEY,
                            JSON.stringify([...submarineSwaps, ...newSwaps])
                        );
                        await Storage.setItem(
                            REVERSE_SWAPS_KEY,
                            JSON.stringify(reverseSwaps)
                        );
                    });
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
