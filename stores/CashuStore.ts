import { action, observable, runInAction } from 'mobx';
import { Alert, InteractionManager } from 'react-native';
import bolt11 from 'bolt11';
import url from 'url';
import querystring from 'querystring-es3';
import {
    CashuMint,
    CashuWallet,
    MeltQuoteResponse,
    MeltQuoteState,
    MintQuoteResponse,
    GetInfoResponse,
    Proof,
    getEncodedToken
} from '@cashu/cashu-ts';
import { LNURLWithdrawParams } from 'js-lnurl';
import ReactNativeBlobUtil from 'react-native-blob-util';
import BigNumber from 'bignumber.js';
import reject from 'lodash/reject';
import { schnorr } from '@noble/curves/secp256k1';
import { bytesToHex } from '@noble/hashes/utils';
import NDK, { NDKFilter, NDKKind } from '@nostr-dev-kit/ndk';

import Invoice from '../models/Invoice';
import CashuInvoice from '../models/CashuInvoice';
import CashuPayment from '../models/CashuPayment';
import CashuToken from '../models/CashuToken';

import Storage from '../storage';

import stores from './Stores';
import InvoicesStore from './InvoicesStore';
import ChannelsStore from './ChannelsStore';
import SettingsStore, { DEFAULT_NOSTR_RELAYS } from './SettingsStore';
import ModalStore from './ModalStore';

import Base64Utils from '../utils/Base64Utils';
import CashuUtils from '../utils/CashuUtils';
import { localeString } from '../utils/LocaleUtils';
import { errorToUserFriendly } from '../utils/ErrorUtils';
import UrlUtils from '../utils/UrlUtils';
import NavigationService from '../NavigationService';

const bip39 = require('bip39');

const BATCH_SIZE = 100;
const MAX_GAP = 3;
const RESTORE_PROOFS_EVENT_NAME = 'RESTORING_PROOF_EVENT';

const UPGRADE_THRESHOLDS = [10000, 25000, 50000, 100000];
const UPGRADE_MESSAGES: { [key: number]: string } = {
    10000: 'cashu.upgradePrompt.message10k',
    25000: 'cashu.upgradePrompt.message25k',
    50000: 'cashu.upgradePrompt.message50k',
    100000: 'cashu.upgradePrompt.message100k'
};

interface Wallet {
    wallet?: CashuWallet;
    walletId: string;
    mintInfo: any;
    counter: number;
    proofs: Array<Proof>;
    balanceSats: number;
    pubkey: string;
    errorConnecting: boolean;
}

interface MintRecommendation {
    count: number;
    url: string;
}

interface ClaimTokenResponse {
    success: boolean;
    errorMessage: string;
}

export default class CashuStore {
    @observable public mintUrls: Array<string>;
    @observable public selectedMintUrl: string;
    @observable public cashuWallets: { [key: string]: Wallet };
    @observable public totalBalanceSats: number;
    @observable public invoices?: Array<CashuInvoice>;
    @observable public payments?: Array<CashuPayment>;
    @observable public receivedTokens?: Array<CashuToken>;
    @observable public sentTokens?: Array<CashuToken>;
    @observable public invoice?: string;
    @observable public quoteId?: string;

    @observable public loading = false;
    @observable public initializing = false;
    @observable public creatingInvoice = false;
    @observable public creatingInvoiceError = false;
    @observable public mintingToken = false;
    @observable public mintingTokenError = false;
    @observable public watchedInvoicePaid = false;
    @observable public watchedInvoicePaidAmt?: number | string;
    @observable public restorationProgress?: number;
    @observable public restorationKeyset?: number;
    @observable public loadingMsg?: string;
    @observable public error = false;
    @observable public error_msg?: string;
    @observable public errorAddingMint = false;

    @observable public payReq?: Invoice;
    @observable public paymentRequest?: string; // bolt11 invoice
    @observable public paymentPreimage?: string;
    @observable public getPayReqError?: string;
    @observable public paymentError?: boolean;
    @observable public paymentErrorMsg?: string;
    @observable public feeEstimate?: number;
    @observable public proofsToUse?: Proof[];
    @observable public meltQuote?: MeltQuoteResponse;
    @observable public noteKey?: string;

    @observable public mintRecommendations?: MintRecommendation[];
    @observable loadingFeeEstimate = false;
    @observable shownThresholdModals: number[] = [];

    settingsStore: SettingsStore;
    invoicesStore: InvoicesStore;
    channelsStore: ChannelsStore;
    modalStore: ModalStore;

    ndk: NDK;

    constructor(
        settingsStore: SettingsStore,
        invoicesStore: InvoicesStore,
        channelsStore: ChannelsStore,
        modalStore: ModalStore
    ) {
        this.settingsStore = settingsStore;
        this.invoicesStore = invoicesStore;
        this.channelsStore = channelsStore;
        this.modalStore = modalStore;
    }

    @action
    public reset = () => {
        this.cashuWallets = {};
        this.totalBalanceSats = 0;
        this.mintUrls = [];
        this.selectedMintUrl = '';
        this.clearInvoice();
        this.clearPayReq();
        this.shownThresholdModals = [];
    };

    @action
    public clearToken = () => {
        this.errorAddingMint = false;
        this.mintingTokenError = false;
        this.error_msg = undefined;
    };

    @action
    public clearInvoice = () => {
        this.invoice = undefined;
        this.watchedInvoicePaid = false;
        this.watchedInvoicePaidAmt = undefined;
        this.quoteId = undefined;
        this.error = false;
    };

    @action
    public clearPayReq = () => {
        this.payReq = undefined;
        this.paymentRequest = undefined;
        this.paymentPreimage = undefined;
        this.getPayReqError = undefined;
        this.feeEstimate = undefined;
        this.proofsToUse = undefined;
        this.meltQuote = undefined;
        this.noteKey = undefined;
        this.error = false;
        this.paymentError = false;
        this.paymentErrorMsg = undefined;
    };

    getLndDir = () => {
        return this.settingsStore.lndDir || 'lnd';
    };

    calculateTotalBalance = async () => {
        let newTotalBalance = 0;
        Object.keys(this.cashuWallets).forEach((mintUrl: string) => {
            newTotalBalance =
                newTotalBalance + this.cashuWallets[mintUrl].balanceSats;
        });
        this.totalBalanceSats = newTotalBalance;
        await Storage.setItem(
            `${this.getLndDir()}-cashu-totalBalanceSats`,
            newTotalBalance
        );
        return this.totalBalanceSats;
    };

    @action
    public fetchMints = async () => {
        runInAction(() => {
            this.loading = true;
        });

        this.ndk = new NDK({ explicitRelayUrls: DEFAULT_NOSTR_RELAYS });
        await this.ndk.connect(); // Ensure connection is established before fetching

        const filter: NDKFilter = { kinds: [38000 as NDKKind], limit: 2000 };
        const events = await this.ndk.fetchEvents(filter);

        InteractionManager.runAfterInteractions(() => {
            const mintCounts = new Map<string, number>();

            for (const event of events) {
                if (event.tagValue('k') === '38172' && event.tagValue('u')) {
                    const mintUrl = event.tagValue('u');
                    if (
                        typeof mintUrl === 'string' &&
                        mintUrl.startsWith('https://')
                    ) {
                        mintCounts.set(
                            mintUrl,
                            (mintCounts.get(mintUrl) || 0) + 1
                        );
                    }
                }
            }

            const mintUrlsCounted = Array.from(mintCounts.entries())
                .map(([url, count]) => ({ url, count }))
                .sort((a, b) => b.count - a.count);

            runInAction(() => {
                this.mintRecommendations = mintUrlsCounted;
                this.loading = false;
            });

            return mintUrlsCounted;
        });
    };

    @action
    public setSelectedMint = async (mintUrl: string) => {
        this.clearInvoice();
        await Storage.setItem(
            `${this.getLndDir()}-cashu-selectedMintUrl`,
            mintUrl
        );

        runInAction(() => {
            this.selectedMintUrl = mintUrl;
        });

        return mintUrl;
    };

    @action
    public addMint = async (
        mintUrl: string,
        checkForExistingProofs?: boolean
    ) => {
        this.loading = true;
        this.errorAddingMint = false;

        const wallet = await this.initializeWallet(mintUrl, true);
        if (wallet.errorConnecting) {
            this.errorAddingMint = true;
            this.loading = false;
            return;
        }
        if (checkForExistingProofs) {
            await this.restoreMintProofs(mintUrl);
            await this.calculateTotalBalance();
        }

        const newMintUrls = this.mintUrls;
        newMintUrls.push(mintUrl);
        await Storage.setItem(
            `${this.getLndDir()}-cashu-mintUrls`,
            this.mintUrls
        );

        // set mint as selected if it's the first one
        if (newMintUrls.length === 1) {
            await this.setSelectedMint(mintUrl);
        }

        runInAction(() => {
            this.mintUrls = newMintUrls;
            this.loading = false;
        });
        return this.cashuWallets;
    };

    @action
    public removeMint = async (mintUrl: string) => {
        this.loading = true;
        const newMintUrls = this.mintUrls.filter((item) => item !== mintUrl);
        await Storage.setItem(
            `${this.getLndDir()}-cashu-mintUrls`,
            newMintUrls
        );
        delete this.cashuWallets[mintUrl];

        // if selected mint is deleted, set the next in line
        if (this.selectedMintUrl === mintUrl) {
            let newSelectedMintUrl = '';
            if (newMintUrls[0]) newSelectedMintUrl = newMintUrls[0];
            await this.setSelectedMint(newSelectedMintUrl);
        }

        const walletId = `${this.getLndDir()}==${mintUrl}`;
        await Storage.removeItem(`${walletId}-counter`);
        await Storage.removeItem(`${walletId}-proofs`);
        await Storage.removeItem(`${walletId}-balance`);

        await this.calculateTotalBalance();
        runInAction(() => {
            this.mintUrls = newMintUrls;
            this.loading = false;
        });
        return this.cashuWallets;
    };

    private getSeed = () => {
        const seedPhrase = this.settingsStore.seedPhrase;
        const mnemonic = seedPhrase.join(' ');
        const seed = bip39.mnemonicToSeedSync(mnemonic);
        const bip39seed = new Uint8Array(seed.slice(32, 64)); // limit to 32 bytes
        return bip39seed;
    };

    private getSeedString = () => {
        const bip39seed = this.getSeed();
        const bip39seedString = Base64Utils.base64ToHex(
            Base64Utils.bytesToBase64(bip39seed)
        );
        return bip39seedString;
    };

    @action
    public startWallet = async (
        mintUrl: string
    ): Promise<{
        wallet: CashuWallet;
        pubkey: string;
        mintInfo: GetInfoResponse;
    }> => {
        this.loading = true;
        console.log('starting wallet for URL', mintUrl);

        const bip39seed = this.getSeed();

        let pubkey: string;
        const walletId = `${this.getLndDir()}==${mintUrl}`;
        if (!this.cashuWallets[mintUrl].pubkey) {
            const privkey = Base64Utils.base64ToHex(
                Base64Utils.bytesToBase64(bip39seed)
            );

            pubkey = '02' + bytesToHex(schnorr.getPublicKey(privkey));

            this.cashuWallets[mintUrl].pubkey = pubkey;
            await Storage.setItem(`${walletId}-pubkey`, pubkey);
        } else {
            pubkey = this.cashuWallets[mintUrl].pubkey;
        }

        // Give wallet 10 seconds to startup
        const mint = new CashuMint(mintUrl);
        const mintInfoPromise = mint.getInfo();
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout exceeded')), 10000)
        );

        try {
            // update the latest mint info anytime we start a wallet
            const mintInfo: any = await Promise.race([
                mintInfoPromise,
                timeoutPromise
            ]);

            await Storage.setItem(`${walletId}-mintInfo`, mintInfo);

            const keysets = (await mint.getKeySets()).keysets.filter(
                (ks) => ks.unit === 'sat'
            );
            const keys = (await mint.getKeys()).keysets.find(
                (ks) => ks.unit === 'sat'
            );

            const wallet = new CashuWallet(mint, {
                bip39seed,
                mintInfo,
                unit: 'sat',
                keys,
                keysets
            });

            // persist wallet.keys and wallet.keysets to avoid calling loadMint() in the future
            await wallet.loadMint();
            await wallet.getKeys();

            return { wallet, pubkey, mintInfo };
        } catch (error: any) {
            console.error(
                `Error connecting to mint ${mintUrl}:`,
                error.message
            );
            throw error; // or handle the timeout error as you see fit
        }
    };

    setMintCounter = async (mintUrl: string, count: number) => {
        await Storage.setItem(
            `${this.cashuWallets[mintUrl].walletId}-counter`,
            count
        );

        runInAction(() => {
            this.cashuWallets[mintUrl].counter = count;
        });

        return count;
    };

    addMintProofs = async (mintUrl: string, newMintProofs: Proof[]) => {
        const allProofs =
            this.cashuWallets[mintUrl].proofs.concat(newMintProofs);
        await this.setMintProofs(mintUrl, allProofs);
        return allProofs;
    };

    removeMintProofs = async (mintUrl: string, proofsToRemove: Proof[]) => {
        let newProofs = this.cashuWallets[mintUrl].proofs;
        proofsToRemove.forEach((proofToRemove: Proof) => {
            newProofs = reject(
                newProofs,
                (proof: Proof) => proof == proofToRemove
            );
        });
        await this.setMintProofs(mintUrl, newProofs);
        return newProofs;
    };

    setMintProofs = async (mintUrl: string, mintProofs: Proof[]) => {
        await Storage.setItem(
            `${this.cashuWallets[mintUrl].walletId}-proofs`,
            mintProofs
        );

        runInAction(() => {
            this.cashuWallets[mintUrl].proofs = mintProofs;
        });

        return mintProofs;
    };

    setMintBalance = async (mintUrl: string, balanceSats: number) => {
        await Storage.setItem(
            `${this.cashuWallets[mintUrl].walletId}-balance`,
            balanceSats
        );

        runInAction(() => {
            this.cashuWallets[mintUrl].balanceSats = balanceSats;
        });

        return balanceSats;
    };

    setTotalBalance = async (newTotalBalanceSats: number) => {
        const previousBalance = this.totalBalanceSats || 0;
        await Storage.setItem(
            `${this.getLndDir()}-cashu-totalBalanceSats`,
            newTotalBalanceSats
        );

        runInAction(() => {
            this.totalBalanceSats = newTotalBalanceSats;
        });

        // Check thresholds after balance update
        this.checkAndShowUpgradeModal(previousBalance, newTotalBalanceSats);

        return newTotalBalanceSats;
    };

    @action
    public checkAndShowUpgradeModal = (
        previousBalance: number,
        currentBalance: number
    ) => {
        for (const threshold of UPGRADE_THRESHOLDS.reverse()) {
            // TODO ecash add checks for on-chain rates to determine
            // if amounts are sufficient for channels
            if (
                previousBalance < threshold &&
                currentBalance >= threshold &&
                !this.shownThresholdModals.includes(threshold) &&
                this.channelsStore.channels.length === 0
            ) {
                const messageKey =
                    UPGRADE_MESSAGES[threshold] ||
                    'cashu.upgradePrompt.messageGeneral'; // Fallback message
                const message = localeString(messageKey);
                const title = localeString('cashu.upgradePrompt.title');

                this.modalStore.toggleInfoModal({
                    title,
                    text: message,
                    buttons: [
                        {
                            title: localeString(
                                'cashu.upgradePrompt.purchaseChannel'
                            ),
                            callback: () => {
                                this.modalStore.toggleInfoModal({}); // Close current modal first
                                NavigationService.navigate('LSPS1');
                            }
                        },
                        {
                            title: localeString(
                                'cashu.upgradePrompt.learnMore'
                            ),
                            callback: () => {
                                this.modalStore.toggleInfoModal({}); // Close current modal first
                                UrlUtils.goToUrl(
                                    'https://docs.zeusln.app/self-custody'
                                );
                            }
                        }
                    ]
                });

                // Mark this threshold modal as shown for the current session
                runInAction(() => {
                    this.shownThresholdModals.push(threshold);
                });
                break; // Show only one modal per balance update
            }
        }
    };

    @action
    public checkPendingItems = async () => {
        console.log('CashuStore: Checking pending invoices and tokens...');
        InteractionManager.runAfterInteractions(async () => {
            // Check pending invoices
            const pendingInvoices = this.invoices?.filter(
                (invoice) => !invoice.isPaid && !invoice.isExpired
            );
            if (pendingInvoices && pendingInvoices.length > 0) {
                console.log(
                    `CashuStore: Found ${pendingInvoices.length} pending invoices to check.`
                );
                for (const invoice of pendingInvoices) {
                    try {
                        console.log(
                            `CashuStore: Checking invoice ${invoice.quote}`
                        );
                        await this.checkInvoicePaid(
                            invoice.quote,
                            invoice.mintUrl
                        );
                    } catch (e) {
                        console.error(
                            `CashuStore: Error checking invoice ${invoice.quote}:`,
                            e
                        );
                    }
                }
            } else {
                console.log('CashuStore: No pending invoices to check.');
            }

            // Check unspent sent tokens
            const unspentSentTokens = this.sentTokens?.filter(
                (token) => !token.spent
            );
            if (unspentSentTokens && unspentSentTokens.length > 0) {
                console.log(
                    `CashuStore: Found ${unspentSentTokens.length} unspent sent tokens to check.`
                );
                for (const token of unspentSentTokens) {
                    try {
                        console.log(
                            `CashuStore: Checking token from mint ${token.mint}`
                        );
                        const isSpent = await this.checkTokenSpent(token);
                        if (isSpent) {
                            console.log(
                                `CashuStore: Marking token from mint ${token.mint} as spent.`
                            );
                            await this.markTokenSpent(token);
                        }
                    } catch (e) {
                        console.error(
                            `CashuStore: Error checking token from mint ${token.mint}:`,
                            e
                        );
                    }
                }
            } else {
                console.log('CashuStore: No unspent sent tokens to check.');
            }
            console.log('CashuStore: Finished checking pending items.');
        });
    };

    @action
    public initializeWallets = async () => {
        const start = new Date();
        runInAction(() => {
            this.initializing = true;
            this.loadingMsg = localeString(
                'stores.CashuStore.initializingWallet'
            );
        });
        const lndDir = this.getLndDir();

        const [
            storedMintUrls,
            storedselectedMintUrl,
            storedTotalBalanceSats,
            storedInvoices,
            storedPayments,
            storedReceivedTokens,
            storedSentTokens
        ] = await Promise.all([
            Storage.getItem(`${lndDir}-cashu-mintUrls`),
            Storage.getItem(`${lndDir}-cashu-selectedMintUrl`),
            Storage.getItem(`${lndDir}-cashu-totalBalanceSats`),
            Storage.getItem(`${lndDir}-cashu-invoices`),
            Storage.getItem(`${lndDir}-cashu-payments`),
            Storage.getItem(`${lndDir}-cashu-received-tokens`),
            Storage.getItem(`${lndDir}-cashu-sent-tokens`)
        ]);

        this.mintUrls = storedMintUrls ? JSON.parse(storedMintUrls) : [];
        this.selectedMintUrl = storedselectedMintUrl || '';
        this.totalBalanceSats = storedTotalBalanceSats
            ? JSON.parse(storedTotalBalanceSats)
            : 0;
        this.invoices = storedInvoices
            ? JSON.parse(storedInvoices).map(
                  (invoice: any) => new CashuInvoice(invoice)
              )
            : [];
        this.payments = storedPayments
            ? JSON.parse(storedPayments).map(
                  (payment: any) => new CashuPayment(payment)
              )
            : [];
        this.receivedTokens = storedReceivedTokens
            ? JSON.parse(storedReceivedTokens).map(
                  (token: any) => new CashuToken(token)
              )
            : [];
        this.sentTokens = storedSentTokens
            ? JSON.parse(storedSentTokens).map(
                  (token: any) => new CashuToken(token)
              )
            : [];

        // Non-blocking parallel wallet initialization
        await Promise.all(
            this.mintUrls.map((mintUrl) => this.initializeWallet(mintUrl))
        );

        runInAction(() => {
            this.loadingMsg = undefined;
            this.initializing = false;
        });

        // Check status of pending items after initialization
        this.checkPendingItems();

        const completionTime =
            (new Date().getTime() - start.getTime()) / 1000 + 's';
        console.log('Cashu start-up time:', completionTime);
    };

    @action
    public initializeWallet = async (
        mintUrl: string,
        startWallet?: boolean
    ): Promise<Wallet> => {
        runInAction(() => {
            this.loading = true;
            this.loadingMsg = `${localeString(
                'stores.CashuStore.startingWallet'
            )}: ${mintUrl}`;
        });

        console.log('initializing wallet for URL', mintUrl);

        const walletId = `${this.getLndDir()}==${mintUrl}`;

        const [
            storedMintInfo,
            storedCounter,
            storedProofs,
            storedBalanceSats,
            storedPubkey
        ] = await Promise.all([
            Storage.getItem(`${walletId}-mintInfo`),
            Storage.getItem(`${walletId}-counter`),
            Storage.getItem(`${walletId}-proofs`),
            Storage.getItem(`${walletId}-balance`),
            Storage.getItem(`${walletId}-pubkey`)
        ]);

        const mintInfo = storedMintInfo ? JSON.parse(storedMintInfo) : [];
        const counter = storedCounter ? JSON.parse(storedCounter) : 0;
        const proofs = storedProofs ? JSON.parse(storedProofs) : [];
        const balanceSats = storedBalanceSats
            ? JSON.parse(storedBalanceSats)
            : 0;
        const pubkey: string = storedPubkey || '';

        runInAction(() => {
            this.cashuWallets[mintUrl] = {
                pubkey,
                walletId,
                mintInfo,
                counter,
                proofs,
                balanceSats,
                errorConnecting: false
            };
        });

        if (startWallet) {
            runInAction(() => {
                this.loadingMsg = `${localeString(
                    'stores.CashuStore.startingWallet'
                )}: ${mintUrl}`;
            });

            try {
                const {
                    wallet,
                    pubkey,
                    mintInfo
                }: {
                    wallet: CashuWallet;
                    pubkey: string;
                    mintInfo: GetInfoResponse;
                } = await this.startWallet(mintUrl);

                runInAction(() => {
                    this.cashuWallets[mintUrl].wallet = wallet;
                    this.cashuWallets[mintUrl].pubkey = pubkey;
                    this.cashuWallets[mintUrl].mintInfo = mintInfo;
                });
            } catch (e) {
                runInAction(() => {
                    this.cashuWallets[mintUrl].errorConnecting = true;
                    this.loadingMsg = undefined;
                    this.loading = false;
                });
                throw e;
            }
        }

        runInAction(() => {
            this.loadingMsg = undefined;
            this.loading = false;
        });

        return this.cashuWallets[mintUrl];
    };

    @action
    public createInvoice = async ({
        memo,
        value,
        lnurl
    }: {
        memo: string;
        value: string;
        lnurl?: LNURLWithdrawParams;
    }) => {
        this.invoice = undefined;
        this.creatingInvoice = true;
        this.creatingInvoiceError = false;
        this.error_msg = undefined;

        try {
            if (!this.cashuWallets[this.selectedMintUrl].wallet) {
                await this.initializeWallet(this.selectedMintUrl, true);
            }

            const mintQuote = await this.cashuWallets[
                this.selectedMintUrl
            ].wallet!!.createMintQuote(value ? Number(value) : 0, memo);

            let invoice: any;
            if (mintQuote) {
                this.quoteId = mintQuote.quote;

                // decode bolt11 for metadata
                let decoded;
                try {
                    decoded = bolt11.decode(mintQuote.request);
                } catch (e) {
                    console.log(
                        'error decoding Cashu bolt11',
                        mintQuote.request
                    );
                }

                invoice = new CashuInvoice({
                    ...mintQuote,
                    decoded,
                    mintUrl:
                        this.cashuWallets[this.selectedMintUrl].wallet!!.mint
                            .mintUrl
                });
                this.invoices?.push(invoice);
                await Storage.setItem(
                    `${this.getLndDir()}-cashu-invoices`,
                    this.invoices
                );
            }

            runInAction(() => {
                this.invoice = invoice?.getPaymentRequest;
                this.creatingInvoice = false;
            });

            let jit_bolt11: string = '';

            if (lnurl) {
                const u = url.parse(lnurl.callback);
                const qs = querystring.parse(u.query);
                qs.k1 = lnurl.k1;
                qs.pr = jit_bolt11 || invoice.getPaymentRequest;
                u.search = querystring.stringify(qs);
                u.query = querystring.stringify(qs);

                ReactNativeBlobUtil.fetch('get', url.format(u))
                    .then((response: any) => {
                        try {
                            const data = response.json();
                            return data;
                        } catch (err) {
                            return {
                                status: 'ERROR',
                                reason: response.text()
                            };
                        }
                    })
                    .catch((err: any) => ({
                        status: 'ERROR',
                        reason: err.message
                    }))
                    .then((data: any) => {
                        if (data.status === 'ERROR') {
                            Alert.alert(
                                `[error] ${lnurl.domain} says:`,
                                data.reason,
                                [
                                    {
                                        text: localeString('general.error'),
                                        onPress: () => void 0
                                    }
                                ],
                                { cancelable: false }
                            );
                        }
                    });
            }

            return {
                // rHash: invoice.getFormattedRhash,
                paymentRequest: jit_bolt11
                    ? jit_bolt11
                    : invoice.getPaymentRequest
            };
        } catch (e: any) {
            console.log('Cashu createInvoice err', e);
            const error_msg = e?.toString();
            runInAction(() => {
                this.creatingInvoiceError = true;
                this.creatingInvoice = false;
                this.error_msg = `${localeString(
                    'stores.InvoicesStore.errorCreatingInvoice'
                )}: ${error_msg}`;
            });
        }
    };

    @action
    public setWatchedInvoicePaid = (amount?: string | number) => {
        this.watchedInvoicePaid = true;
        if (amount) this.watchedInvoicePaidAmt = amount;
    };

    @action
    public checkInvoicePaid = async (
        quoteId?: string,
        quoteMintUrl?: string,
        lockedQuote?: boolean
    ) => {
        const mintUrl = quoteMintUrl || this.selectedMintUrl;

        if (this.cashuWallets[mintUrl].errorConnecting) return;
        if (!this.cashuWallets[mintUrl].wallet) {
            if (!this.mintUrls.includes(mintUrl)) {
                await this.addMint(mintUrl, true);
            } else {
                await this.initializeWallet(mintUrl, true);
            }
        }

        const invoiceQuoteId: string = quoteId || this.quoteId || '';

        const quote: MintQuoteResponse | undefined = await this.cashuWallets[
            mintUrl
        ].wallet?.checkMintQuote(invoiceQuoteId);

        if (quote?.state === 'PAID') {
            // try up to 21 counters in case we get out of sync (DEBUG)
            let attempts = 0;
            let retries = 21;
            let success = false;

            // decode bolt11 for metadata
            let decoded;
            try {
                decoded = bolt11.decode(quote.request);
            } catch (e) {
                console.log('error decoding Cashu bolt11', quote.request);
            }

            const updatedInvoice = new CashuInvoice({
                ...quote,
                decoded,
                mintUrl
            });

            const amtSat = updatedInvoice.getAmount;

            const paymentRequest = this.invoice || '';

            while (attempts < retries && !success) {
                try {
                    const counter =
                        this.cashuWallets[mintUrl].counter + attempts;
                    const newProofs: Proof[] = await this.cashuWallets[
                        mintUrl
                    ].wallet!!.mintProofs(
                        amtSat,
                        // @ts-ignore:next-line
                        lockedQuote && quote ? quote : invoiceQuoteId,
                        lockedQuote
                            ? {
                                  counter,
                                  privateKey: this.getSeedString()
                              }
                            : {
                                  counter
                              }
                    );
                    success = true;

                    const totalBalanceSats = new BigNumber(
                        this.totalBalanceSats || 0
                    )
                        .plus(amtSat || 0)
                        .toNumber();
                    const balanceSats = new BigNumber(
                        this.cashuWallets[mintUrl].balanceSats || 0
                    )
                        .plus(amtSat || 0)
                        .toNumber();
                    const newCounter = new BigNumber(counter || 0)
                        .plus(newProofs.length)
                        .toNumber();

                    // update proofs, counter, balance
                    this.cashuWallets[mintUrl].proofs.push(...newProofs);
                    await this.setMintProofs(
                        mintUrl,
                        this.cashuWallets[mintUrl].proofs
                    );

                    await this.setMintCounter(mintUrl, newCounter);
                    await this.setMintBalance(mintUrl, balanceSats);
                    await this.setTotalBalance(totalBalanceSats);

                    // Update or add the invoice in the store
                    const invoiceIndex = this.invoices?.findIndex(
                        (item) => item.quote === quote.quote
                    );
                    if (invoiceIndex !== undefined && invoiceIndex > -1) {
                        this.invoices!![invoiceIndex] = updatedInvoice;
                    } else {
                        this.invoices?.push(updatedInvoice);
                    }
                    await Storage.setItem(
                        `${this.getLndDir()}-cashu-invoices`,
                        this.invoices
                    );

                    // update Activity list
                    stores.activityStore.getSortedActivity();

                    return {
                        isPaid: true,
                        amtSat,
                        paymentRequest,
                        updatedInvoice
                    };
                } catch (e) {
                    attempts++;
                    console.log(`Attempt ${attempts} failed: ${e}`);
                    if (attempts === retries) {
                        console.log('Max retries reached');
                        return {
                            isPaid: false,
                            amtSat,
                            paymentRequest,
                            updatedInvoice
                        };
                    }
                }
            }
        } else {
            return { isPaid: false };
        }
    };

    @action
    public restoreMintProofs = async (mintUrl: string) => {
        try {
            this.restorationProgress = 0;

            console.log(RESTORE_PROOFS_EVENT_NAME, 'Loading mint keysets...');

            if (!this.cashuWallets[mintUrl].wallet) {
                await this.initializeWallet(mintUrl, true);
            }

            const mint = this.cashuWallets[mintUrl].wallet!!.mint;
            const allKeysets = await mint.getKeySets();
            const keysets = allKeysets.keysets;

            this.restorationProgress = 5;

            let highestCount = 0;
            const ksLen = keysets.length;
            const hexDigitsRegex = /^[0-9A-Fa-f]+$/;

            for (const [i, keyset] of keysets.entries()) {
                // Hex keyset validation
                if (!hexDigitsRegex.test(keyset.id)) {
                    console.log(
                        RESTORE_PROOFS_EVENT_NAME,
                        `Skipping ${keyset.id}. Not a hex keyset.`
                    );
                    continue;
                }

                const statusMessage = `Keyset ${i + 1} of ${ksLen}`;
                console.log(RESTORE_PROOFS_EVENT_NAME, statusMessage);

                // Restore keyset proofs
                const { restoredProofs, count } = await this.restoreKeyset(
                    mint,
                    keyset
                );
                console.log(`Keyset ${i + 1} of ${ksLen}`, {
                    restoredProofs,
                    count
                });
                this.restorationProgress = Math.floor(((i + 1) / ksLen) * 100);

                if (count > highestCount) {
                    highestCount = count;
                    // Update the counter for this keyset
                    console.log('SETTING COUNT', count + 1);
                    await this.setMintCounter(mintUrl, count + 1);
                }

                const restoredAmount =
                    CashuUtils.sumProofsValue(restoredProofs);
                if (restoredAmount > 0) {
                    console.log(
                        RESTORE_PROOFS_EVENT_NAME,
                        `Restored ${restoredAmount} for keyset ${keyset.id} (${this.restorationProgress}%)`
                    );
                }
            }
            console.log(RESTORE_PROOFS_EVENT_NAME, 'end');
            this.restorationProgress = undefined;
            this.restorationKeyset = undefined;
            return true;
        } catch (error: any) {
            console.error('Error restoring proofs:', error);
            console.log(RESTORE_PROOFS_EVENT_NAME, `Error: ${error.message}`);
            return null;
        }
    };

    // Separate function for restoring a single keyset
    restoreKeyset = async (mint: CashuMint, keyset: any) => {
        try {
            const keys = await mint.getKeys(keyset.id);
            const mintInfo = await mint.getInfo();

            const wallet = new CashuWallet(mint, {
                bip39seed: this.getSeed(),
                mintInfo,
                unit: 'sat',
                keys: keys.keysets,
                keysets: [keyset]
            });

            this.restorationKeyset = keyset.id;

            console.log(
                RESTORE_PROOFS_EVENT_NAME,
                `Loading keys for keyset ${keyset.id}`
            );

            const { keysetProofs, count } = await this.restoreBatch(
                wallet,
                keyset.id
            );

            // Check proof states similar to the original
            console.log(
                RESTORE_PROOFS_EVENT_NAME,
                `Checking proof states for keyset ${keyset.id}`
            );

            let restoredProofs: any[] = [];

            // Process proofs in batches to avoid potential issues with large sets
            for (let i = 0; i < keysetProofs.length; i += BATCH_SIZE) {
                const batchProofs = keysetProofs.slice(i, i + BATCH_SIZE);
                if (batchProofs.length === 0) continue;

                const proofStates = await wallet.checkProofsStates(batchProofs);

                // Filter for unspent proofs using the approach from the original code
                const unspentProofStateYs = proofStates
                    .filter((ps) => ps.state === 'UNSPENT')
                    .map((ps) => ps.Y);

                const unspentKeysetProofs = batchProofs.filter((_, idx) =>
                    unspentProofStateYs.includes(proofStates[idx].Y)
                );

                // Store only new proofs
                const existingProofSecrets =
                    this.cashuWallets[mint.mintUrl].proofs;
                const newProofs = unspentKeysetProofs.filter(
                    (p) => !existingProofSecrets.includes(p)
                );

                if (newProofs.length > 0) {
                    const mintProofs =
                        this.cashuWallets[mint.mintUrl].proofs.concat(
                            newProofs
                        );
                    const balanceSats = CashuUtils.sumProofsValue(mintProofs);
                    await this.setMintProofs(mint.mintUrl, mintProofs);
                    await this.setMintBalance(mint.mintUrl, balanceSats);
                }
            }

            return { restoredProofs, count };
        } catch (error: any) {
            console.log(
                RESTORE_PROOFS_EVENT_NAME,
                `Error restoring keyset ${keyset.id}: ${error.message}`
            );
            throw error;
        }
    };

    restoreBatch = async (wallet: CashuWallet, keysetId: string) => {
        let keysetProofs = [];
        try {
            let newProofs = [];
            let start = 0;
            let lastFound = 0;
            let noProofsFoundCounter = 0;
            const noProofsFoundLimit = MAX_GAP;

            do {
                console.log(
                    RESTORE_PROOFS_EVENT_NAME,
                    `Restoring ${start} through ${start + BATCH_SIZE}`
                );

                const { proofs } = await wallet.restore(start, BATCH_SIZE, {
                    keysetId
                });
                newProofs = [...proofs];
                keysetProofs.push(...proofs);

                if (newProofs.length) {
                    const proofsSum = CashuUtils.sumProofsValue(proofs);
                    console.log(
                        `> Restored ${proofs.length} proofs with sum ${proofsSum} - starting at ${start}`
                    );
                    noProofsFoundCounter = 0;
                    lastFound = start + proofs.length + 1;
                } else {
                    noProofsFoundCounter++;
                    console.log(
                        `No proofs found in batch starting at ${start}`
                    );
                }

                start = start + BATCH_SIZE;
            } while (noProofsFoundCounter < noProofsFoundLimit);

            console.log(lastFound + 1, 'setting count');
            return { keysetProofs, count: lastFound + 1 };
        } catch (error: any) {
            console.log(
                RESTORE_PROOFS_EVENT_NAME,
                `Error restoring batch: ${error.message}`
            );
            throw error;
        }
    };

    getProofsToUse = (
        proofsAvailable: Proof[],
        amount: number,
        order = 'desc'
    ) => {
        const proofsToSend: Proof[] = [];
        let amountAvailable = 0;
        if (order === 'desc') {
            proofsAvailable.sort((a, b) => b.amount - a.amount);
        } else {
            proofsAvailable.sort((a, b) => a.amount - b.amount);
        }

        proofsAvailable.forEach((proof) => {
            if (amountAvailable >= amount) {
                return;
            }

            amountAvailable = amountAvailable + proof.amount;

            proofsToSend.push(proof);
        });
        return { proofsToUse: proofsToSend };
    };

    @action
    public getPayReq = async (bolt11Invoice: string) => {
        this.loading = true;
        this.payReq = undefined;
        this.paymentRequest = bolt11Invoice;
        this.feeEstimate = undefined;

        try {
            const data = await new Promise((resolve) => {
                const decoded: any = bolt11.decode(bolt11Invoice || '');
                for (let i = 0; i < decoded.tags.length; i++) {
                    const tag = decoded.tags[i];
                    switch (tag.tagName) {
                        case 'purpose_commit_hash':
                            decoded.description_hash = tag.data;
                            break;
                        case 'payment_hash':
                            decoded.payment_hash = tag.data;
                            break;
                        case 'expire_time':
                            decoded.expiry = tag.data;
                            break;
                        case 'description':
                            decoded.description = tag.data;
                            break;
                    }
                }
                resolve(decoded);
            });

            if (!this.cashuWallets[this.selectedMintUrl].wallet) {
                await this.initializeWallet(this.selectedMintUrl, true);
            }
            const cashuWallet = this.cashuWallets[this.selectedMintUrl];

            const meltQuote = await cashuWallet.wallet!!.createMeltQuote(
                bolt11Invoice
            );
            const { proofsToUse }: { proofsToUse: Proof[] } =
                this.getProofsToUse(
                    cashuWallet.proofs,
                    meltQuote.amount + meltQuote.fee_reserve,
                    'desc'
                );

            runInAction(() => {
                this.payReq = new Invoice(data);
                this.getPayReqError = undefined;
                this.loading = false;
            });

            this.proofsToUse = proofsToUse;
            this.meltQuote = meltQuote;
            this.feeEstimate = this.meltQuote.fee_reserve || 0;

            return;
        } catch (e: any) {
            const error = e;
            runInAction(() => {
                this.payReq = undefined;
                this.getPayReqError = errorToUserFriendly(error);
                this.loading = false;
            });
        }
    };

    getSpendingProofsWithPreciseCounter = async (
        wallet: CashuWallet,
        amountToPay: number,
        proofs: Proof[],
        currentCounter: number,
        swap?: boolean
    ) => {
        try {
            const { keep: proofsToKeep, send: proofsToSend } = swap
                ? await wallet.swap(amountToPay, proofs, {
                      counter: currentCounter,
                      includeFees: true
                  })
                : await wallet.send(amountToPay, proofs, {
                      counter: currentCounter,
                      includeFees: true
                  });

            const existingProofsIds = proofs.map((p) => p.secret);
            const newKeepProofsCount = proofsToKeep.filter(
                (p) => !existingProofsIds.includes(p.secret)
            ).length;
            const newSendProofsCount = proofsToSend.filter(
                (p) => !existingProofsIds.includes(p.secret)
            ).length;

            console.log(newKeepProofsCount, 'NEW PROOFS KEEP COUNT');
            console.log(newSendProofsCount, 'NEW PROOFS SEND COUNT');

            const newCounterValue =
                currentCounter + newKeepProofsCount + newSendProofsCount;

            return {
                proofsToSend,
                proofsToKeep,
                newCounterValue
            };
        } catch (err) {
            console.error('Error in getSpendingProofsWithPreciseCounter:', err);
            throw err;
        }
    };

    @action
    public payLnInvoiceFromEcash = async ({ amount }: { amount?: string }) => {
        this.loading = true;

        const mintUrl = this.selectedMintUrl;

        if (!this.cashuWallets[mintUrl].wallet) {
            await this.initializeWallet(mintUrl, true);
        }

        const wallet = this.cashuWallets[mintUrl].wallet;
        let proofs = this.proofsToUse;

        const paymentAmt = this.payReq?.getRequestAmount
            ? this.payReq?.getRequestAmount
            : Number(amount);
        const amountToPay = this.feeEstimate
            ? this.feeEstimate + paymentAmt
            : paymentAmt;
        const totalProofsValue = CashuUtils.sumProofsValue(proofs);

        console.log('ecash quote fee reserve:', this.feeEstimate);
        console.log('Proofs before send', proofs);
        console.log(totalProofsValue, amountToPay);

        try {
            if (totalProofsValue < amountToPay) {
                this.paymentError = true;
                this.paymentErrorMsg = localeString(
                    'stores.CashuStore.notEnoughFunds'
                );
                this.loading = false;
                return;
            }

            console.log('[payLnInvoce] use send ', {
                amountToPay,
                amount,
                fee: this.feeEstimate,
                totalProofsValue
            });

            let currentCount = this.cashuWallets[mintUrl].counter;

            const { proofsToSend, proofsToKeep, newCounterValue } =
                await this.getSpendingProofsWithPreciseCounter(
                    wallet!!,
                    amountToPay,
                    this.proofsToUse!!,
                    currentCount
                );

            console.log('PROOFS TO SEND:', proofsToSend);
            console.log('PROOFS TO KEEP:', proofsToKeep);

            proofs = proofsToSend;

            if (proofsToKeep.length)
                await this.addMintProofs(mintUrl, proofsToKeep);

            let meltResponse = await wallet!!.meltProofs(
                this.meltQuote!!,
                proofsToSend,
                {
                    counter: newCounterValue + 1
                }
            );
            console.log('melt response', meltResponse);

            if (meltResponse?.change?.length) {
                await this.setMintCounter(
                    mintUrl,
                    newCounterValue + meltResponse.change.length + 1
                );
                await this.addMintProofs(mintUrl, meltResponse.change);
            } else {
                await this.setMintCounter(mintUrl, newCounterValue + 1);
            }

            const realFee = Math.max(
                0,
                meltResponse.quote?.fee_reserve -
                    CashuUtils.sumProofsValue(meltResponse?.change)
            );

            this.paymentPreimage = meltResponse.quote.payment_preimage!!;

            const payment = new CashuPayment({
                ...this.payReq,
                proofs: proofsToSend,
                bolt11: this.paymentRequest,
                meltResponse,
                amount: meltResponse.quote.amount,
                fee: realFee,
                payment_preimage: this.paymentPreimage,
                mintUrl
            });

            this.noteKey = payment.getNoteKey;

            await this.removeMintProofs(mintUrl, this.proofsToUse!!);
            // store Ecash payment
            this.payments?.push(payment);
            await Storage.setItem(
                `${this.getLndDir()}-cashu-payments`,
                this.payments
            );

            // update balances
            await this.setTotalBalance(this.totalBalanceSats - amountToPay);
            await this.setMintBalance(
                mintUrl,
                this.cashuWallets[mintUrl].balanceSats - amountToPay
            );

            this.loading = false;

            return payment;
        } catch (err: any) {
            console.log('paying ln invoice from ecash error', err);
            const mintQuote = await wallet!!.checkMeltQuote(
                this.meltQuote!!.quote
            );
            if (mintQuote.state == MeltQuoteState.PAID) {
                this.paymentError = true;
                this.paymentErrorMsg = localeString(
                    'stores.CashuStore.alreadyPaid'
                );
                this.loading = false;
                return;
            } else if (mintQuote.state == MeltQuoteState.PENDING) {
                this.paymentError = true;
                this.paymentErrorMsg = localeString(
                    'stores.CashuStore.pending'
                );
                this.loading = false;
                return;
            }
            await this.removeMintProofs(mintUrl, this.proofsToUse!!);
            await this.addMintProofs(mintUrl, proofs!!);
            this.paymentError = true;
            this.paymentErrorMsg = String(err.message);
            this.loading = false;
            return;
        }
    };

    @action
    public checkTokenSpent = async (decoded: CashuToken) => {
        const { mint } = decoded;

        if (this.cashuWallets[mint].errorConnecting) return;
        if (!this.cashuWallets[mint].wallet) {
            await this.initializeWallet(mint, true);
        }

        const wallet = this.cashuWallets[mint].wallet;

        const states = await wallet!!.checkProofsStates(decoded.proofs);

        let alreadySpent = false;
        states.forEach((state) => {
            if (alreadySpent) return;
            if (state.state !== 'UNSPENT') {
                alreadySpent = true;
            }
        });

        return alreadySpent;
    };

    @action
    public markTokenSpent = async (decoded: CashuToken) => {
        // delete old instance of token
        this.sentTokens = this.sentTokens?.filter(
            (item) => item.encodedToken !== decoded.encodedToken
        );

        const updatedToken = new CashuToken({
            ...decoded,
            spent: true
        });

        // save new instance of token
        this.sentTokens?.push(updatedToken);
        await Storage.setItem(
            `${this.getLndDir()}-cashu-sent-tokens`,
            this.sentTokens
        );

        return updatedToken;
    };

    @action
    public claimToken = async (
        encodedToken: string,
        decoded: CashuToken,
        toSelfCustody?: boolean
    ): Promise<ClaimTokenResponse> => {
        this.loading = true;

        const mintUrl = decoded.mint;

        if (!this.cashuWallets[mintUrl].wallet) {
            await this.initializeWallet(mintUrl, true);
        }

        try {
            const alreadySpent = await this.checkTokenSpent(decoded);
            if (alreadySpent) {
                return {
                    success: false,
                    errorMessage: localeString('stores.CashuStore.alreadySpent')
                };
            }

            const wallet = this.cashuWallets[mintUrl].wallet!!;

            if (toSelfCustody) {
                const tokenAmt = decoded.getAmount;
                const initialAssumedFeeSat = 0;

                const memo = `${localeString(
                    'views.Cashu.CashuToken.tokenSweep'
                )}${decoded.memo ? `: ${decoded.memo}` : ''}`;

                const invoiceParams = {
                    expiry: '3600',
                    routeHints: true,
                    noLsp: true
                };

                let invoice = await this.invoicesStore.createInvoice({
                    ...invoiceParams,
                    memo,
                    value: String(tokenAmt)
                });

                let meltQuote = await wallet.createMeltQuote(
                    invoice.paymentRequest
                );
                if (initialAssumedFeeSat !== meltQuote.fee_reserve) {
                    const receiveAmtSat: number =
                        tokenAmt - meltQuote.fee_reserve;

                    if (receiveAmtSat <= 0) {
                        this.loading = false;
                        return {
                            success: false,
                            errorMessage: localeString(
                                'stores.CashuStore.feeExceedsAmt'
                            )
                        };
                    }

                    invoice = await this.invoicesStore.createInvoice({
                        ...invoiceParams,
                        memo: `${memo} [${localeString(
                            'views.Cashu.CashuToken.feeAdjusted'
                        )}]`,
                        value: receiveAmtSat.toString()
                    });

                    meltQuote = await wallet.createMeltQuote(
                        invoice.paymentRequest
                    );
                }

                const amountToSend = meltQuote.amount + meltQuote.fee_reserve;

                const { send: proofsToSend } = await wallet.send(
                    amountToSend,
                    decoded.proofs,
                    {
                        includeFees: true
                    }
                );

                await wallet.meltProofs(meltQuote, proofsToSend);
            } else {
                const counter =
                    this.cashuWallets[mintUrl].counter + decoded.proofs.length;

                const newProofs = await wallet!!.receive(encodedToken, {
                    counter
                });
                const amtSat = CashuUtils.sumProofsValue(newProofs);

                const totalBalanceSats = new BigNumber(
                    this.totalBalanceSats || 0
                )
                    .plus(amtSat || 0)
                    .toNumber();
                const balanceSats = new BigNumber(
                    this.cashuWallets[mintUrl].balanceSats || 0
                )
                    .plus(amtSat || 0)
                    .toNumber();
                const newCounter = new BigNumber(counter || 0)
                    .plus(newProofs.length)
                    .toNumber();

                // update proofs, counter, balance
                this.cashuWallets[mintUrl].proofs.push(...newProofs);
                await this.setMintProofs(
                    mintUrl,
                    this.cashuWallets[mintUrl].proofs
                );

                // record received token activity
                this.receivedTokens?.push(
                    new CashuToken({
                        ...decoded,
                        received: true,
                        encodedToken,
                        received_at: Date.now() / 1000
                    })
                );
                await Storage.setItem(
                    `${this.getLndDir()}-cashu-received-tokens`,
                    this.receivedTokens
                );

                await this.setMintCounter(mintUrl, newCounter);
                await this.setMintBalance(mintUrl, balanceSats);
                await this.setTotalBalance(totalBalanceSats);
            }

            this.loading = false;

            return { success: true, errorMessage: '' };
        } catch (e) {
            console.log('claimToken error', { e });
            const error_msg = e?.toString();
            this.loading = false;
            return {
                success: false,
                errorMessage:
                    error_msg || localeString('stores.CashuStore.claimError')
            };
        }
    };

    @action
    public mintToken = async ({
        memo,
        value
    }: {
        memo: string;
        value: string;
    }): Promise<{ token: string; decoded: CashuToken } | undefined> => {
        runInAction(() => {
            this.mintingToken = true;
            this.mintingTokenError = false;
            this.error_msg = undefined;
        });

        const mintUrl = this.selectedMintUrl;

        if (!this.cashuWallets[mintUrl].wallet) {
            await this.initializeWallet(mintUrl, true);
        }

        const { wallet, proofs, counter } = this.cashuWallets[mintUrl];

        const { proofsToUse } = this.getProofsToUse(proofs, Number(value));

        try {
            const { proofsToSend, proofsToKeep, newCounterValue } =
                await this.getSpendingProofsWithPreciseCounter(
                    wallet!!,
                    Number(value),
                    proofsToUse!!,
                    counter + proofsToUse.length + 1,
                    true
                );

            if (proofsToKeep.length) {
                await this.addMintProofs(mintUrl, proofsToKeep);
            }

            await this.setMintCounter(mintUrl, newCounterValue + 1);

            await this.removeMintProofs(mintUrl, proofsToUse);

            // update balances
            await this.setTotalBalance(this.totalBalanceSats - Number(value));
            await this.setMintBalance(
                mintUrl,
                this.cashuWallets[mintUrl].balanceSats - Number(value)
            );

            const tokenObj = {
                mint: mintUrl,
                proofs: proofsToSend,
                memo,
                unit: 'sat'
            };
            const token = getEncodedToken(tokenObj);
            const decoded = new CashuToken({
                ...tokenObj,
                sent: true,
                encodedToken: token,
                created_at: Date.now() / 1000,
                spent: false
            });

            // record received token activity
            this.sentTokens?.push(decoded);
            await Storage.setItem(
                `${this.getLndDir()}-cashu-sent-tokens`,
                this.sentTokens
            );

            runInAction(() => {
                this.mintingToken = false;
            });

            return { token, decoded };
        } catch (e) {
            console.log('Cashu mintToken err', e);
            runInAction(() => {
                this.mintingTokenError = true;
                this.mintingToken = false;
                this.error_msg = localeString(
                    'stores.CashuStore.errorMintingToken'
                );
            });
        }
    };

    @action
    public deleteCashuData = async () => {
        this.loading = true;
        const lndDir = this.getLndDir();

        try {
            for (const mintUrl of this.mintUrls) {
                const walletId = `${lndDir}==${mintUrl}`;
                await Storage.removeItem(`${walletId}-mintInfo`);
                await Storage.removeItem(`${walletId}-counter`);
                await Storage.removeItem(`${walletId}-proofs`);
                await Storage.removeItem(`${walletId}-balance`);
                await Storage.removeItem(`${walletId}-pubkey`);
            }

            await Storage.removeItem(`${lndDir}-cashu-mintUrls`);
            await Storage.removeItem(`${lndDir}-cashu-selectedMintUrl`);
            await Storage.removeItem(`${lndDir}-cashu-totalBalanceSats`);
            await Storage.removeItem(`${lndDir}-cashu-invoices`);
            await Storage.removeItem(`${lndDir}-cashu-payments`);
            await Storage.removeItem(`${lndDir}-cashu-received-tokens`);
            await Storage.removeItem(`${lndDir}-cashu-sent-tokens`);

            // Reset store state
            this.reset();

            runInAction(() => {
                this.loading = false;
            });

            Alert.alert(
                localeString('general.success'),
                localeString('stores.CashuStore.dataDeletedMessage')
            );
        } catch (error: any) {
            console.error('Error deleting Cashu data:', error);
            runInAction(() => {
                this.loading = false;
                this.error = true;
            });
            Alert.alert(
                localeString('general.error'),
                localeString('stores.CashuStore.errorDeletingData') +
                    `: ${error.message}`
            );
        }
    };
}
