import { action, observable, runInAction } from 'mobx';
import { Alert, InteractionManager } from 'react-native';
import bolt11 from 'bolt11';
import url from 'url';
import querystring from 'querystring-es3';

// CDK Bridge - Native Cashu Development Kit bindings
import CashuDevKit, {
    CDKMintInfo,
    CDKMintQuote,
    CDKMeltQuote,
    CDKMelted,
    CDKToken,
    CDKSpendingConditions,
    CDKP2PKCondition
} from '../cashu-cdk';

import { LNURLWithdrawParams } from 'js-lnurl';
import ReactNativeBlobUtil from 'react-native-blob-util';
import NDK, { NDKEvent, NDKFilter, NDKKind } from '@nostr-dev-kit/ndk';
import * as bip39scure from '@scure/bip39';
import {
    generatePrivateKey,
    getPublicKey,
    getEventHash,
    getSignature,
    relayInit
} from 'nostr-tools';
import { HDKey } from '@scure/bip32';
import { bytesToHex } from '@noble/hashes/utils';

import NostrUtils from '../utils/NostrUtils';

import Invoice from '../models/Invoice';
import CashuInvoice from '../models/CashuInvoice';
import CashuPayment from '../models/CashuPayment';
import CashuToken from '../models/CashuToken';

import Storage from '../storage';

import { activityStore, lightningAddressStore } from './Stores';
import InvoicesStore from './InvoicesStore';
import ChannelsStore from './ChannelsStore';
import SettingsStore, { DEFAULT_NOSTR_RELAYS } from './SettingsStore';
import ModalStore from './ModalStore';

import Base64Utils from '../utils/Base64Utils';
import { BIP39_WORD_LIST } from '../utils/Bip39Utils';
import CashuUtils from '../utils/CashuUtils';
import { errorToUserFriendly } from '../utils/ErrorUtils';
import { localeString } from '../utils/LocaleUtils';
import MigrationsUtils from '../utils/MigrationUtils';
import UrlUtils from '../utils/UrlUtils';

import NavigationService from '../NavigationService';

const bip39 = require('bip39');

const RESTORE_PROOFS_EVENT_NAME = 'RESTORING_PROOF_EVENT';

const UPGRADE_THRESHOLDS = [10000, 25000, 50000, 100000];
const UPGRADE_MESSAGES: { [key: number]: string } = {
    10000: 'cashu.upgradePrompt.message10k',
    25000: 'cashu.upgradePrompt.message25k',
    50000: 'cashu.upgradePrompt.message50k',
    100000: 'cashu.upgradePrompt.message100k'
};

// ZEUS official npub for trusted mint recommendations
const ZEUS_NPUB =
    'npub1xnf02f60r9v0e5kty33a404dm79zr7z2eepyrk5gsq3m7pwvsz2sazlpr5';

interface Wallet {
    walletId: string;
    pubkey: string;
    errorConnecting: boolean;
}

interface MintRecommendation {
    count: number;
    url: string;
}

export interface MintReviewRating {
    score: number;
    max: number;
}

export interface MintReview {
    pubkey: string;
    content: string;
    createdAt: number;
    mintUrl: string;
    rating?: MintReviewRating;
}

/**
 * Parses a rating from review content in format [n/m] at the beginning.
 * Returns the rating object and the remaining content with the rating stripped.
 */
const parseReviewRating = (
    content: string
): { rating?: MintReviewRating; cleanContent: string } => {
    if (!content) {
        return { cleanContent: '' };
    }

    const ratingRegex = /^\s*\[(\d+)\/(\d+)\]\s*/;
    const match = content.match(ratingRegex);

    if (match) {
        const score = parseInt(match[1], 10);
        const max = parseInt(match[2], 10);

        if (score >= 0 && max > 0 && score <= max) {
            return {
                rating: { score, max },
                cleanContent: content.replace(ratingRegex, '').trim()
            };
        }
    }

    return { cleanContent: content.trim() };
};

export interface ReviewerProfile {
    pubkey: string;
    npub: string;
    name?: string;
    picture?: string;
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
    // Per-mint data fetched from CDK
    @observable public mintBalances: { [key: string]: number } = {};
    @observable public mintInfos: { [key: string]: CDKMintInfo } = {};
    @observable public invoices?: Array<CashuInvoice>;
    @observable public payments?: Array<CashuPayment>;
    @observable public receivedTokens?: Array<CashuToken>;
    @observable public sentTokens?: Array<CashuToken>;
    // CDK transactions loaded from history (CashuInvoice for incoming, CashuPayment for outgoing)
    @observable public cdkInvoices: Array<CashuInvoice> = [];
    @observable public cdkPayments: Array<CashuPayment> = [];
    @observable public seedVersion?: string;
    @observable public seedPhrase?: Array<string>;
    @observable public seed?: Uint8Array;
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
    @observable public paymentSuccess?: boolean; // true when payment completed successfully
    @observable public getPayReqError?: string;
    @observable public paymentError?: boolean;
    @observable public paymentErrorMsg?: string;
    @observable public feeEstimate?: number;
    @observable public meltQuote?: {
        quote: string;
        amount: number;
        fee_reserve: number;
        state: string;
        expiry: number;
        payment_preimage?: string | null;
    };
    @observable public noteKey?: string;
    @observable public paymentStartTime?: number;
    @observable public paymentDuration?: number;

    @observable public mintRecommendations?: MintRecommendation[];
    @observable public trustedMintRecommendations?: MintRecommendation[];
    @observable public mintReviews: Map<string, MintReview[]> = new Map();
    @observable public reviewerProfiles: Map<string, ReviewerProfile> =
        new Map();
    @observable public loadingTrustedMints = false;
    @observable public loadingReviews = false;
    @observable public submittingReview = false;
    @observable public reviewSubmitSuccess = false;
    @observable public reviewSubmitError = false;
    @observable loadingFeeEstimate = false;
    @observable shownThresholdModals: number[] = [];

    // CDK integration state
    @observable public cdkInitialized: boolean = false;
    // Cache of mints that have been added to CDK this session
    private addedMintsCache: Set<string> = new Set();
    // Cache for derived Cashu HD key (NUT-10 path m/129372'/0'/0'/0'/0')
    private cashuHDKeyCache: HDKey | null = null;

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

    // =========================================================================
    // CDK Integration Methods
    // =========================================================================

    /**
     * Set loading state
     */
    @action
    public setLoading = (loading: boolean) => {
        this.loading = loading;
    };

    /**
     * Reset payment state before starting a new payment
     */
    @action
    public resetPaymentState = () => {
        this.paymentPreimage = '';
        this.paymentSuccess = false;
        this.paymentError = false;
        this.paymentErrorMsg = '';
        this.paymentStartTime = undefined;
    };

    /**
     * Initialize CDK wallet with mnemonic
     * Call this after seed phrase is available
     */
    @action
    public initializeCDK = async (): Promise<boolean> => {
        if (!CashuDevKit.isAvailable()) {
            console.log('CDK: Not available');
            return false;
        }

        try {
            // Get mnemonic from seed derivation
            const mnemonic = this.getCDKMnemonic();
            if (!mnemonic) {
                console.error('CDK: Unable to derive mnemonic');
                return false;
            }

            await CashuDevKit.initializeWallet(mnemonic, 'sat');

            runInAction(() => {
                this.cdkInitialized = true;
            });

            console.log('CDK: Initialized successfully');
            return true;
        } catch (e) {
            console.error('CDK: Initialization failed:', e);
            return false;
        }
    };

    /**
     * Normalize mint URL for consistent comparison
     */
    private normalizeMintUrl = (url: string): string => {
        // Remove trailing slash for consistent format
        return url.replace(/\/+$/, '');
    };

    /**
     * Ensure a mint is added to CDK, using cache to avoid redundant calls.
     * This is an optimization since addMint is called frequently before operations.
     */
    private ensureMintAdded = async (mintUrl: string): Promise<void> => {
        const normalizedUrl = this.normalizeMintUrl(mintUrl);
        if (this.addedMintsCache.has(normalizedUrl)) {
            return;
        }

        try {
            await CashuDevKit.addMint(normalizedUrl);
            this.addedMintsCache.add(normalizedUrl);
        } catch (e) {
            // Mint might already be added (from previous session), cache it anyway
            this.addedMintsCache.add(normalizedUrl);
        }
    };

    /**
     * Get or derive the Cashu HD key at NUT-10 path m/129372'/0'/0'/0'/0'
     * Caches the result to avoid repeated derivation.
     */
    private getCashuHDKey = (): HDKey | null => {
        if (this.cashuHDKeyCache) {
            return this.cashuHDKeyCache;
        }

        if (!this.seedPhrase || this.seedPhrase.length === 0) {
            return null;
        }

        try {
            const mnemonic = this.seedPhrase.join(' ');
            const seed = bip39.mnemonicToSeedSync(mnemonic);
            const hdKey = HDKey.fromMasterSeed(seed);
            // Cashu NUT-10 derivation path: m/129372'/0'/0'/0'/0'
            this.cashuHDKeyCache = hdKey.derive("m/129372'/0'/0'/0'/0'");
            return this.cashuHDKeyCache;
        } catch (error) {
            console.error('Error deriving Cashu HD key:', error);
            return null;
        }
    };

    /**
     * Get mnemonic string for CDK from existing seed
     */
    private getCDKMnemonic = (): string | null => {
        // First check for stored cashu seed phrase
        if (this.seedPhrase && this.seedPhrase.length > 0) {
            const mnemonic = this.seedPhrase.join(' ');
            // Validate it's a proper BIP-39 mnemonic
            if (bip39scure.validateMnemonic(mnemonic, BIP39_WORD_LIST)) {
                return mnemonic;
            }
            console.warn('CDK: Stored cashu seed is not valid BIP-39');
        }

        // No valid stored cashu seed - derive from LND seed
        const lndSeedPhrase = this.settingsStore.seedPhrase;
        if (!lndSeedPhrase || lndSeedPhrase.length === 0) {
            console.warn('CDK: No LND seed phrase available');
            return null;
        }

        const lndMnemonic = lndSeedPhrase.join(' ');

        // Derive cashu seed from LND seed (v2-bip39 style)
        const seedFromMnemonic = bip39scure.mnemonicToSeedSync(lndMnemonic);
        const entropy = seedFromMnemonic.slice(48, 64);
        const cashuSeedPhrase = bip39scure.entropyToMnemonic(
            entropy,
            BIP39_WORD_LIST
        );

        // Store derived seed for future use
        const derivedSeedPhrase = cashuSeedPhrase.split(' ');
        Storage.setItem(
            `${this.getLndDir()}-cashu-seed-phrase`,
            derivedSeedPhrase
        );
        this.seedPhrase = derivedSeedPhrase;
        this.seedVersion = 'v2-bip39';
        Storage.setItem(`${this.getLndDir()}-cashu-seed-version`, 'v2-bip39');

        console.log('CDK: Derived and stored cashu seed from LND seed');
        return cashuSeedPhrase;
    };

    /**
     * Sync balances from CDK to local state
     * @param includeTransactions - Whether to also reload transaction history (default: false)
     */
    @action
    public syncCDKBalances = async (includeTransactions: boolean = false) => {
        if (!this.cdkInitialized) return;

        try {
            const balances = await CashuDevKit.getBalances();
            const totalBalance = await CashuDevKit.getTotalBalance();

            runInAction(() => {
                this.mintBalances = balances;
                this.totalBalanceSats = totalBalance;
            });

            // Only load transactions when explicitly requested
            if (includeTransactions) {
                await this.loadTransactions();
            }
        } catch (e) {
            console.error('CDK: Failed to sync balances:', e);
        }
    };

    /**
     * Load transaction history from CDK
     * Converts to CashuInvoice (incoming) or CashuPayment (outgoing)
     */
    @action
    public loadTransactions = async () => {
        if (!this.cdkInitialized) return;

        try {
            const cdkTransactions =
                (await CashuDevKit.listTransactions()) || [];
            runInAction(() => {
                this.cdkInvoices = cdkTransactions
                    .filter((tx) => tx.direction === 'incoming')
                    .map((tx) => CashuInvoice.fromCDKTransaction(tx));
                this.cdkPayments = cdkTransactions
                    .filter((tx) => tx.direction === 'outgoing')
                    .map((tx) => CashuPayment.fromCDKTransaction(tx));
            });
        } catch (e) {
            console.error('CDK: Failed to load transactions:', e);
        }
    };

    /**
     * Fetch mint info from CDK for a specific mint
     */
    @action
    public fetchMintInfo = async (mintUrl: string) => {
        try {
            const mintInfo = await CashuDevKit.fetchMintInfo(mintUrl);
            if (mintInfo) {
                runInAction(() => {
                    this.mintInfos[mintUrl] = mintInfo;
                });
            }
            return mintInfo;
        } catch (e) {
            console.error(`CDK: Failed to fetch mint info for ${mintUrl}:`, e);
            return null;
        }
    };

    /**
     * CDK: Create mint quote (receive ecash via Lightning)
     */
    public createMintQuoteCDK = async (
        mintUrl: string,
        amount: number,
        description?: string
    ): Promise<CDKMintQuote> => {
        if (!this.cdkInitialized) {
            throw new Error('CDK not initialized');
        }

        await this.ensureMintAdded(mintUrl);
        return await CashuDevKit.createMintQuote(mintUrl, amount, description);
    };

    /**
     * CDK: Check mint quote status and mint proofs if paid
     */
    public checkAndMintCDK = async (
        mintUrl: string,
        quoteId: string
    ): Promise<{
        isPaid: boolean;
        amount?: number;
        quote?: CDKMintQuote;
        isLegacy?: boolean;
        externalQuote?: any;
    }> => {
        if (!this.cdkInitialized) {
            throw new Error('CDK not initialized');
        }

        await this.ensureMintAdded(mintUrl);

        console.log('CDK checkAndMintCDK: Checking quote', {
            mintUrl,
            quoteId,
            quoteIdLength: quoteId?.length,
            quoteIdType: typeof quoteId
        });

        try {
            const quote = await CashuDevKit.checkMintQuote(mintUrl, quoteId);
            console.log('CDK checkAndMintCDK: Quote state', {
                quoteId,
                state: quote.state,
                amount: quote.amount
            });

            if (quote.state === 'Paid') {
                // Mint the proofs - CDK handles storage internally
                console.log(
                    'CDK checkAndMintCDK: Quote is paid, minting proofs'
                );
                await CashuDevKit.mint(mintUrl, quoteId);
                await this.syncCDKBalances();

                return { isPaid: true, amount: quote.amount, quote };
            }

            // Also check for 'Issued' state (proofs already minted)
            if (quote.state === 'Issued') {
                console.log('CDK checkAndMintCDK: Quote already issued');
                await this.syncCDKBalances();
                return { isPaid: true, amount: quote.amount, quote };
            }

            // Handle 'Pending' state - payment in progress, try to mint anyway
            // Some mints may allow minting while payment is pending
            if (quote.state === 'Pending') {
                console.log(
                    'CDK checkAndMintCDK: Quote is pending, attempting to mint'
                );
                try {
                    await CashuDevKit.mint(mintUrl, quoteId);
                    await this.syncCDKBalances();
                    return { isPaid: true, amount: quote.amount, quote };
                } catch (mintError: any) {
                    console.log(
                        'CDK checkAndMintCDK: Mint failed while pending:',
                        mintError?.message
                    );
                    // Return pending state info for better error message
                    return { isPaid: false, quote };
                }
            }

            console.log(
                `CDK checkAndMintCDK: Quote state is ${quote.state}, not redeemable`
            );
            return { isPaid: false, quote };
        } catch (e: any) {
            // Handle "Unknown quote" error - this is likely an external quote
            const errorMsg = e?.message || '';
            console.log('CDK checkAndMintCDK: checkMintQuote error:', {
                message: errorMsg,
                type: e?.type,
                fullError: JSON.stringify(e)
            });

            if (errorMsg.includes('Unknown quote')) {
                console.log(
                    `CDK checkAndMintCDK: Quote ${quoteId} not in local DB, checking external...`
                );

                // Check external quote status directly from mint's HTTP API
                try {
                    const externalQuote =
                        await CashuDevKit.checkExternalMintQuote(
                            mintUrl,
                            quoteId
                        );
                    console.log(
                        'CDK checkAndMintCDK: External quote status:',
                        externalQuote
                    );

                    // NUT-04 states are uppercase: "UNPAID", "PAID", "PENDING", "ISSUED"
                    const state = externalQuote.state?.toUpperCase();

                    if (state === 'PAID') {
                        console.log(
                            `CDK checkAndMintCDK: External quote ${quoteId} is PAID, adding to database and minting...`
                        );

                        try {
                            // Derive the secret key for P2PK-locked quotes
                            // This is needed because ZeusPay locks quotes to our cashu pubkey
                            const secretKey = this.deriveCashuSecretKey();
                            if (secretKey) {
                                console.log(
                                    'CDK checkAndMintCDK: Using P2PK secret key for minting'
                                );
                            }

                            // First, add the external quote to CDK's database with secret key
                            await CashuDevKit.addExternalMintQuote(
                                mintUrl,
                                quoteId,
                                externalQuote.amount || 0,
                                externalQuote.request || '',
                                externalQuote.state || 'PAID',
                                externalQuote.expiry || 0,
                                secretKey || undefined
                            );
                            console.log(
                                `CDK checkAndMintCDK: Added quote ${quoteId} to database`
                            );

                            // Now mint - the quote is in the database
                            await CashuDevKit.mintExternal(
                                mintUrl,
                                quoteId,
                                externalQuote.amount || 0
                            );
                            await this.syncCDKBalances();
                            console.log(
                                `CDK checkAndMintCDK: External mint succeeded for ${quoteId}`
                            );
                            return {
                                isPaid: true,
                                amount: externalQuote.amount,
                                externalQuote
                            };
                        } catch (mintError: any) {
                            console.log(
                                `CDK checkAndMintCDK: External mint failed: ${mintError?.message}`
                            );

                            // Return info for the UI
                            return {
                                isPaid: false,
                                isLegacy: true,
                                externalQuote,
                                amount: externalQuote.amount
                            };
                        }
                    } else if (state === 'ISSUED') {
                        console.log(
                            `CDK checkAndMintCDK: External quote ${quoteId} already ISSUED`
                        );
                        // Proofs were already minted, try restore to claim them
                        try {
                            const restored = await CashuDevKit.restore(mintUrl);
                            console.log(
                                `CDK checkAndMintCDK: Restored ${restored} sats`
                            );
                            await this.syncCDKBalances();
                            if (restored > 0) {
                                return {
                                    isPaid: true,
                                    amount: restored,
                                    externalQuote
                                };
                            }
                        } catch (restoreError: any) {
                            console.log(
                                `CDK checkAndMintCDK: Restore failed: ${restoreError?.message}`
                            );
                        }
                        return {
                            isPaid: true,
                            amount: externalQuote.amount,
                            externalQuote
                        };
                    } else {
                        console.log(
                            `CDK checkAndMintCDK: External quote state is ${state}, not redeemable yet`
                        );
                        return { isPaid: false, externalQuote };
                    }
                } catch (externalError: any) {
                    console.log(
                        `CDK checkAndMintCDK: External quote check failed: ${externalError?.message}`
                    );
                    // Quote truly doesn't exist
                    return { isPaid: false, isLegacy: true };
                }
            }
            throw e;
        }
    };

    /**
     * CDK: Create melt quote (pay Lightning invoice with ecash)
     */
    public createMeltQuoteCDK = async (
        mintUrl: string,
        bolt11Invoice: string
    ): Promise<CDKMeltQuote> => {
        if (!this.cdkInitialized) {
            throw new Error('CDK not initialized');
        }

        await this.ensureMintAdded(mintUrl);
        return await CashuDevKit.createMeltQuote(mintUrl, bolt11Invoice);
    };

    /**
     * CDK: Execute melt (pay Lightning invoice)
     */
    public meltCDK = async (
        mintUrl: string,
        bolt11: string
    ): Promise<CDKMelted> => {
        if (!this.cdkInitialized) {
            throw new Error('CDK not initialized');
        }

        await this.ensureMintAdded(mintUrl);

        // Create melt quote first, then execute melt with quote ID
        const quote = await CashuDevKit.createMeltQuote(mintUrl, bolt11);
        const result = await CashuDevKit.melt(mintUrl, quote.id);
        await this.syncCDKBalances();

        return result;
    };

    /**
     * Enrich tokens with value if missing (migration for old tokens)
     */
    private enrichTokensWithProofs = async () => {
        const lndDir = this.getLndDir();
        let updated = false;

        // Enrich sent tokens
        if (this.sentTokens) {
            for (const token of this.sentTokens) {
                if (!token.value && token.encodedToken) {
                    try {
                        const decoded = await CashuDevKit.decodeToken(
                            token.encodedToken
                        );
                        if (decoded.value) {
                            token.value = decoded.value;
                            updated = true;
                        }
                    } catch (e) {
                        console.warn(
                            'Failed to decode token for enrichment:',
                            e
                        );
                    }
                }
            }
            if (updated) {
                await Storage.setItem(
                    `${lndDir}-cashu-sent-tokens`,
                    this.sentTokens
                );
            }
        }

        // Enrich received tokens
        updated = false;
        if (this.receivedTokens) {
            for (const token of this.receivedTokens) {
                if (!token.value && token.encodedToken) {
                    try {
                        const decoded = await CashuDevKit.decodeToken(
                            token.encodedToken
                        );
                        if (decoded.value) {
                            token.value = decoded.value;
                            updated = true;
                        }
                    } catch (e) {
                        console.warn(
                            'Failed to decode token for enrichment:',
                            e
                        );
                    }
                }
            }
            if (updated) {
                await Storage.setItem(
                    `${lndDir}-cashu-received-tokens`,
                    this.receivedTokens
                );
            }
        }
    };

    /**
     * CDK: Send ecash token
     */
    public sendTokenCDK = async (
        mintUrl: string,
        amount: number,
        memo?: string,
        p2pkPubkey?: string,
        locktime?: number
    ): Promise<CDKToken> => {
        if (!this.cdkInitialized) {
            throw new Error('CDK not initialized');
        }

        let conditions: CDKSpendingConditions | undefined;
        if (p2pkPubkey && p2pkPubkey.trim().length > 0) {
            const conditionData: CDKP2PKCondition = {
                pubkey: p2pkPubkey.trim()
            };
            if (locktime !== undefined && locktime !== null) {
                conditionData.locktime = locktime;
            }
            conditions = {
                kind: 'P2PK',
                data: conditionData
            };
        }
        const token = await CashuDevKit.send(mintUrl, amount, memo, conditions);
        await this.syncCDKBalances();

        return token;
    };

    /**
     * CDK: Receive ecash token
     */
    public receiveTokenCDK = async (
        encodedToken: string,
        signingKey?: string
    ): Promise<number> => {
        if (!this.cdkInitialized) {
            throw new Error('CDK not initialized');
        }

        // p2pk_signing_keys when the token is P2PK-locked.
        const options: { p2pk_signing_keys: string[] } = {
            p2pk_signing_keys: signingKey ? [signingKey] : []
        };

        const amount = await CashuDevKit.receive(encodedToken, options);
        await this.syncCDKBalances();

        return amount;
    };

    /**
     * CDK: Restore proofs from seed
     */
    public restoreCDK = async (mintUrl: string): Promise<number> => {
        if (!this.cdkInitialized) {
            throw new Error('CDK not initialized');
        }

        const normalizedUrl = this.normalizeMintUrl(mintUrl);
        await this.ensureMintAdded(normalizedUrl);

        const amount = await CashuDevKit.restore(normalizedUrl);
        await this.syncCDKBalances();

        return amount;
    };

    /**
     * CDK: Decode token without receiving
     */
    public decodeTokenCDK = async (encodedToken: string): Promise<CDKToken> => {
        return await CashuDevKit.decodeToken(encodedToken);
    };

    /**
     * CDK: Pay to human-readable address (BOLT12/BIP353)
     */
    public payToAddressCDK = async (
        mintUrl: string,
        address: string,
        amountSats: number
    ): Promise<CDKMelted> => {
        if (!this.cdkInitialized) {
            throw new Error('CDK not initialized');
        }

        const result = await CashuDevKit.payToAddress(
            mintUrl,
            address,
            amountSats
        );
        await this.syncCDKBalances();

        return result;
    };

    // =========================================================================
    // End CDK Integration Methods
    // =========================================================================

    @action
    public reset = () => {
        this.cashuWallets = {};
        this.totalBalanceSats = 0;
        this.mintUrls = [];
        this.selectedMintUrl = '';
        this.invoices = undefined;
        this.payments = undefined;
        this.receivedTokens = undefined;
        this.sentTokens = undefined;
        this.seedVersion = undefined;
        this.seedPhrase = undefined;
        this.seed = undefined;
        this.clearInvoice();
        this.clearPayReq();
        this.shownThresholdModals = [];
        this.addedMintsCache.clear();
        this.cashuHDKeyCache = null;
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
        this.meltQuote = undefined;
        this.noteKey = undefined;
        this.error = false;
        this.paymentError = false;
        this.paymentErrorMsg = undefined;
        this.paymentStartTime = undefined;
        this.paymentDuration = undefined;
    };

    getLndDir = () => {
        return this.settingsStore.lndDir || 'lnd';
    };

    get selectedMintPubkey() {
        return this.cashuWallets[this.selectedMintUrl]?.pubkey;
    }

    public isProperlyConfigured(): boolean {
        return (
            this.mintUrls.length > 0 &&
            !!this.selectedMintUrl &&
            this.selectedMintUrl.trim() !== '' &&
            !!this.cashuWallets[this.selectedMintUrl]
        );
    }

    calculateTotalBalance = async () => {
        if (this.cdkInitialized) {
            try {
                this.totalBalanceSats = await CashuDevKit.getTotalBalance();
            } catch (e) {
                console.error('CDK: Failed to calculate total balance:', e);
            }
        }
        return this.totalBalanceSats;
    };

    /**
     * Helper: Subscribe to NDK and collect events with EOSE handling and timeout.
     */
    private subscribeAndCollectEvents = async (
        filter: NDKFilter,
        logPrefix: string
    ): Promise<Set<NDKEvent>> => {
        const events = new Set<NDKEvent>();
        let eoseCount = 0;
        const totalRelays = DEFAULT_NOSTR_RELAYS.length;
        const sub = this.ndk.subscribe(filter, { closeOnEose: true });

        await new Promise<void>((resolve) => {
            sub.on('event', (event: NDKEvent) => {
                events.add(event);
            });
            sub.on('eose', () => {
                eoseCount++;
                if (eoseCount >= Math.ceil(totalRelays / 2)) {
                    console.log(
                        `${logPrefix}: EOSE received from majority of relays`
                    );
                    resolve();
                }
            });
            setTimeout(() => {
                console.log(`${logPrefix}: Timeout reached`);
                resolve();
            }, 10000);
        });

        sub.stop();
        return events;
    };

    /**
     * Helper: Process NIP-87 events into mint recommendations and reviews.
     */
    private processMintRecommendationEvents = (
        events: Set<NDKEvent>
    ): {
        recommendations: MintRecommendation[];
        reviews: Map<string, MintReview[]>;
    } => {
        const mintCounts = new Map<string, number>();
        const mintReviewsMap = new Map<string, MintReview[]>();

        for (const event of events) {
            if (event.tagValue('k') === '38172' && event.tagValue('u')) {
                const mintUrl = event.tagValue('u');
                if (
                    typeof mintUrl === 'string' &&
                    mintUrl.startsWith('https://')
                ) {
                    const count = (mintCounts.get(mintUrl) || 0) + 1;
                    mintCounts.set(mintUrl, count);

                    // Store review data with parsed rating
                    const { rating, cleanContent } = parseReviewRating(
                        event.content || ''
                    );
                    const review: MintReview = {
                        pubkey: event.pubkey,
                        content: cleanContent,
                        createdAt: event.created_at || 0,
                        mintUrl,
                        rating
                    };

                    const existingReviews = mintReviewsMap.get(mintUrl) || [];
                    existingReviews.push(review);
                    mintReviewsMap.set(mintUrl, existingReviews);
                }
            }
        }

        const recommendations = Array.from(mintCounts.entries())
            .map(([url, count]) => ({ url, count }))
            .sort((a, b) => b.count - a.count);

        return { recommendations, reviews: mintReviewsMap };
    };

    @action
    public fetchMints = async () => {
        try {
            runInAction(() => {
                this.loading = true;
                this.error = false;
                this.error_msg = undefined;
            });

            this.ndk = new NDK({
                explicitRelayUrls: DEFAULT_NOSTR_RELAYS
            });
            await this.ndk.connect();

            const filter: NDKFilter = {
                kinds: [38000 as NDKKind],
                limit: 2000
            };

            const events = await this.subscribeAndCollectEvents(
                filter,
                'Mint discovery'
            );

            const { recommendations, reviews } =
                this.processMintRecommendationEvents(events);

            runInAction(() => {
                this.mintRecommendations = recommendations;
                this.mintReviews = reviews;
                this.loading = false;
            });

            return recommendations;
        } catch (e: any) {
            console.error('Error fetching mints:', e);
            runInAction(() => {
                this.loading = false;
                this.error = true;
                this.error_msg = localeString(
                    'stores.CashuStore.errorDiscoveringMints'
                );
            });
        }
    };

    // Validate npub format and return hex pubkey if valid
    public validateNpub = (npubInput: string): string | null => {
        return NostrUtils.npubToHex(npubInput);
    };

    @action
    public fetchMintsFromFollows = async (npubInput?: string) => {
        try {
            runInAction(() => {
                this.loadingTrustedMints = true;
                this.error = false;
                this.error_msg = undefined;
            });

            // Use provided npub or default to ZEUS npub
            const npubToUse = npubInput?.trim() || ZEUS_NPUB;
            const hexPubkey = this.validateNpub(npubToUse);

            if (!hexPubkey) {
                runInAction(() => {
                    this.loadingTrustedMints = false;
                    this.error = true;
                    this.error_msg = localeString(
                        'views.Cashu.AddMint.invalidNpub'
                    );
                });
                return [];
            }

            // Initialize NDK if not already done
            if (!this.ndk) {
                this.ndk = new NDK({
                    explicitRelayUrls: DEFAULT_NOSTR_RELAYS
                });
                await this.ndk.connect();
            }

            // Fetch follow list (kind 3)
            const followFilter: NDKFilter = {
                kinds: [3 as NDKKind],
                authors: [hexPubkey],
                limit: 1
            };

            const followEvents = await this.ndk.fetchEvents(followFilter);
            const followEvent = Array.from(followEvents)[0];

            if (!followEvent) {
                console.log('No follow list found for npub');
                runInAction(() => {
                    this.trustedMintRecommendations = [];
                    this.loadingTrustedMints = false;
                    this.error = true;
                    this.error_msg = localeString(
                        'views.Cashu.AddMint.noFollowList'
                    );
                });
                return [];
            }

            // Extract followed pubkeys from 'p' tags
            const followedPubkeys = new Set<string>();
            for (const tag of followEvent.tags) {
                if (tag[0] === 'p' && tag[1]) {
                    followedPubkeys.add(tag[1]);
                }
            }

            if (followedPubkeys.size === 0) {
                runInAction(() => {
                    this.trustedMintRecommendations = [];
                    this.loadingTrustedMints = false;
                });
                return [];
            }

            // Fetch mint recommendations (kind 38000) from followed accounts
            const mintFilter: NDKFilter = {
                kinds: [38000 as NDKKind],
                authors: Array.from(followedPubkeys),
                limit: 2000
            };

            const events = await this.subscribeAndCollectEvents(
                mintFilter,
                'Trusted mint discovery'
            );

            const { recommendations, reviews } =
                this.processMintRecommendationEvents(events);

            runInAction(() => {
                this.trustedMintRecommendations = recommendations;
                this.mintReviews = reviews;
                this.loadingTrustedMints = false;
            });

            return recommendations;
        } catch (e: any) {
            console.error('Error fetching mints from follows:', e);
            runInAction(() => {
                this.loadingTrustedMints = false;
                this.error = true;
                this.error_msg = localeString(
                    'stores.CashuStore.errorDiscoveringMints'
                );
            });
        }
    };

    @action
    public fetchReviewerProfiles = async (pubkeys: string[]) => {
        if (!pubkeys.length) return;

        try {
            runInAction(() => {
                this.loadingReviews = true;
            });

            // Filter out pubkeys we already have profiles for
            const newPubkeys = pubkeys.filter(
                (pk) => !this.reviewerProfiles.has(pk)
            );

            if (!newPubkeys.length) {
                runInAction(() => {
                    this.loadingReviews = false;
                });
                return;
            }

            // Initialize NDK if not already done
            if (!this.ndk) {
                this.ndk = new NDK({
                    explicitRelayUrls: DEFAULT_NOSTR_RELAYS
                });
                await this.ndk.connect();
            }

            // Fetch profiles (kind 0)
            const profileFilter: NDKFilter = {
                kinds: [0 as NDKKind],
                authors: newPubkeys,
                limit: newPubkeys.length
            };

            const events = await this.ndk.fetchEvents(profileFilter);

            const profilesMap = new Map<string, ReviewerProfile>();

            // Initialize all pubkeys with basic info
            for (const pubkey of newPubkeys) {
                const npub = NostrUtils.hexToNpub(pubkey);
                profilesMap.set(pubkey, {
                    pubkey,
                    npub: npub || pubkey
                });
            }

            // Update with profile data where available
            for (const event of events) {
                try {
                    const content = JSON.parse(event.content);
                    const npub = NostrUtils.hexToNpub(event.pubkey);
                    profilesMap.set(event.pubkey, {
                        pubkey: event.pubkey,
                        npub: npub || event.pubkey,
                        name:
                            content.display_name ||
                            content.name ||
                            content.username,
                        picture: content.picture
                    });
                } catch (e) {
                    console.error('Error parsing profile:', e);
                }
            }

            runInAction(() => {
                // Merge new profiles with existing ones
                for (const [pubkey, profile] of profilesMap) {
                    this.reviewerProfiles.set(pubkey, profile);
                }
                this.loadingReviews = false;
            });
        } catch (e: any) {
            console.error('Error fetching reviewer profiles:', e);
            runInAction(() => {
                this.loadingReviews = false;
            });
        }
    };

    /**
     * Submits a mint review to Nostr relays (NIP-87).
     * @param mintUrl - The mint URL to review
     * @param rating - Rating from 1-5 (optional)
     * @param reviewText - Review text content (optional)
     * @param nsec - User's nsec for signing (if not provided, generates anonymous keypair)
     * @returns Object with success status and optional npub of the signer
     */
    @action
    public submitMintReview = async (
        mintUrl: string,
        rating?: number,
        reviewText?: string,
        nsec?: string
    ): Promise<{ success: boolean; npub?: string; error?: string }> => {
        if (!mintUrl) {
            return {
                success: false,
                error: localeString('views.Cashu.Mint.mintUrlRequired')
            };
        }

        runInAction(() => {
            this.submittingReview = true;
            this.reviewSubmitSuccess = false;
            this.reviewSubmitError = false;
        });

        try {
            // Get or generate private key
            let privateKey: string;
            if (nsec) {
                const hexKey = NostrUtils.nsecToHex(nsec);
                if (!hexKey) {
                    runInAction(() => {
                        this.submittingReview = false;
                        this.reviewSubmitError = true;
                    });
                    return {
                        success: false,
                        error: localeString('views.Cashu.Mint.invalidNsec')
                    };
                }
                privateKey = hexKey;
            } else {
                // Generate anonymous keypair
                privateKey = generatePrivateKey();
            }

            const publicKey = getPublicKey(privateKey);
            const npub = NostrUtils.hexToNpub(publicKey);

            // Build content with optional rating prefix
            let content = '';
            if (rating && rating >= 1 && rating <= 5) {
                content = `[${rating}/5]`;
                if (reviewText?.trim()) {
                    content += ` ${reviewText.trim()}`;
                }
            } else if (reviewText?.trim()) {
                content = reviewText.trim();
            }

            // Create NIP-87 event (kind 38000, parameterized replaceable)
            const unsignedEvent = {
                kind: 38000,
                content,
                tags: [
                    ['k', '38172'], // Cashu mint recommendation
                    ['u', mintUrl],
                    ['d', mintUrl] // Identifier for parameterized replaceable
                ],
                created_at: Math.floor(Date.now() / 1000),
                pubkey: publicKey
            };

            // Sign the event
            const signedEvent = {
                ...unsignedEvent,
                id: getEventHash(unsignedEvent),
                sig: getSignature(unsignedEvent, privateKey)
            };

            // Publish to relays
            const publishPromises = DEFAULT_NOSTR_RELAYS.map(
                async (relayUrl) => {
                    try {
                        const relay = relayInit(relayUrl);
                        await relay.connect();
                        await relay.publish(signedEvent);
                        relay.close();
                        return true;
                    } catch (e) {
                        console.warn(`Failed to publish to ${relayUrl}:`, e);
                        return false;
                    }
                }
            );

            const results = await Promise.all(publishPromises);
            const successCount = results.filter(Boolean).length;

            if (successCount === 0) {
                throw new Error(
                    localeString('views.Cashu.Mint.failedToPublishRelay')
                );
            }

            runInAction(() => {
                this.submittingReview = false;
                this.reviewSubmitSuccess = true;
            });

            return { success: true, npub: npub || publicKey };
        } catch (e: any) {
            console.error('Error submitting mint review:', e);
            runInAction(() => {
                this.submittingReview = false;
                this.reviewSubmitError = true;
            });
            return {
                success: false,
                error:
                    e?.message || localeString('views.Cashu.Mint.submitError')
            };
        }
    };

    @action
    public resetReviewSubmitState = () => {
        this.submittingReview = false;
        this.reviewSubmitSuccess = false;
        this.reviewSubmitError = false;
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
        this.error = false;
        this.error_msg = undefined;

        try {
            // Ensure CDK is initialized
            if (!this.cdkInitialized) {
                await this.initializeCDK();
            }
            if (this.mintUrls.length === 0 && this.seedVersion !== 'v1') {
                const seedVersion = 'v2-bip39';
                await Storage.setItem(
                    `${this.getLndDir()}-cashu-seed-version`,
                    seedVersion
                );
                this.seedVersion = seedVersion;
            }

            // Add mint to CDK (CDK persists mints internally)
            try {
                await CashuDevKit.addMint(mintUrl);
                this.addedMintsCache.add(this.normalizeMintUrl(mintUrl));
                console.log(`CDK: Added mint ${mintUrl}`);
            } catch (e: any) {
                console.error(`CDK: Failed to add mint ${mintUrl}:`, e);
                runInAction(() => {
                    this.loading = false;
                    this.errorAddingMint = true;
                    this.error = true;
                    this.error_msg = localeString(
                        'stores.CashuStore.errorAddingMint'
                    );
                });
                return;
            }

            // Initialize wallet UI state
            await this.initializeWallet(mintUrl);

            // Fetch mint info
            await this.fetchMintInfo(mintUrl);

            if (checkForExistingProofs) {
                await this.restoreMintProofs(mintUrl);
            }

            // Sync balances from CDK
            await this.syncCDKBalances();

            // Update local mintUrls from CDK (source of truth)
            this.mintUrls = await CashuDevKit.getMintUrls();

            // Backup to local storage for migration on restart
            await Storage.setItem(
                `${this.getLndDir()}-cashu-mintUrls`,
                JSON.stringify(this.mintUrls)
            );

            // set mint as selected if it's the first one
            if (this.mintUrls.length === 1) {
                await this.setSelectedMint(mintUrl);
            }

            runInAction(() => {
                this.loading = false;
            });
            return this.cashuWallets;
        } catch (e) {
            console.error('Error adding mint:', e);
            runInAction(() => {
                this.loading = false;
                this.errorAddingMint = true;
                this.error = true;
                this.error_msg = localeString(
                    'stores.CashuStore.errorAddingMint'
                );
            });
        }
    };

    @action
    public removeMint = async (mintUrl: string) => {
        this.loading = true;

        // Remove from CDK (CDK is source of truth for mints)
        try {
            await CashuDevKit.removeMint(mintUrl);
            console.log(`CDK: Removed mint ${mintUrl}`);
        } catch (e) {
            console.warn(`CDK: Failed to remove mint ${mintUrl}:`, e);
        }

        // Remove from local wallet state
        delete this.cashuWallets[mintUrl];

        // Update local mintUrls from CDK
        this.mintUrls = await CashuDevKit.getMintUrls();

        // if selected mint is deleted, set the next in line
        if (this.selectedMintUrl === mintUrl) {
            if (this.mintUrls[0]) {
                await this.setSelectedMint(this.mintUrls[0]);
            } else {
                this.selectedMintUrl = '';
                await Storage.removeItem(
                    `${this.getLndDir()}-cashu-selectedMintUrl`
                );
            }
        }

        // Clean up any legacy local storage for this mint
        const walletId = `${this.getLndDir()}==${mintUrl}`;
        await Storage.removeItem(`${walletId}-counter`);
        await Storage.removeItem(`${walletId}-proofs`);
        await Storage.removeItem(`${walletId}-balance`);
        await Storage.removeItem(`${walletId}-pubkey`);

        await this.calculateTotalBalance();
        runInAction(() => {
            this.loading = false;
        });
        return this.cashuWallets;
    };

    setTotalBalance = async (newTotalBalanceSats: number) => {
        const previousBalance = this.totalBalanceSats || 0;

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
        InteractionManager.runAfterInteractions(async () => {
            // Check pending invoices
            const pendingInvoices = this.invoices?.filter(
                (invoice) => !invoice.isPaid && !invoice.isExpired
            );
            if (pendingInvoices && pendingInvoices.length > 0) {
                for (const invoice of pendingInvoices) {
                    try {
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
            }

            // Check unspent sent tokens
            const unspentSentTokens = this.sentTokens?.filter(
                (token) => !token.spent
            );
            let tokensUpdated = false;
            if (unspentSentTokens && unspentSentTokens.length > 0) {
                for (const token of unspentSentTokens) {
                    try {
                        const isSpent = await this.checkTokenSpent(token);
                        if (isSpent) {
                            await this.markTokenSpent(token);
                            tokensUpdated = true;
                        }
                    } catch (e) {
                        console.error(
                            `CashuStore: Error checking token from mint ${token.mint}:`,
                            e
                        );
                    }
                }
            }

            // Refresh activity list if any tokens were updated
            if (tokensUpdated) {
                activityStore.getSortedActivity();
            }
        });
    };

    /**
     * Check sent tokens spent status (awaitable, for use in views)
     */
    @action
    public checkSentTokensSpentStatus = async (): Promise<boolean> => {
        const unspentSentTokens = this.sentTokens?.filter(
            (token) => !token.spent
        );

        let tokensUpdated = false;
        if (unspentSentTokens && unspentSentTokens.length > 0) {
            for (const token of unspentSentTokens) {
                try {
                    const isSpent = await this.checkTokenSpent(token);
                    if (isSpent) {
                        await this.markTokenSpent(token);
                        tokensUpdated = true;
                    }
                } catch (e) {
                    console.error(
                        `CashuStore: Error checking token from mint ${token.mint}:`,
                        e
                    );
                }
            }
        }

        return tokensUpdated;
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

        // Load app-specific data from local storage (activity, preferences, seed)
        const [
            storedMintUrls, // Only needed for migration to CDK
            storedselectedMintUrl,
            storedInvoices,
            storedPayments,
            storedReceivedTokens,
            storedSentTokens,
            storedSeedVersion,
            storedSeedPhrase,
            storedSeed
        ] = await Promise.all([
            Storage.getItem(`${lndDir}-cashu-mintUrls`),
            Storage.getItem(`${lndDir}-cashu-selectedMintUrl`),
            Storage.getItem(`${lndDir}-cashu-invoices`),
            Storage.getItem(`${lndDir}-cashu-payments`),
            Storage.getItem(`${lndDir}-cashu-received-tokens`),
            Storage.getItem(`${lndDir}-cashu-sent-tokens`),
            Storage.getItem(`${lndDir}-cashu-seed-version`),
            Storage.getItem(`${lndDir}-cashu-seed-phrase`),
            Storage.getItem(`${lndDir}-cashu-seed`)
        ]);

        // Parse app-specific stored data
        this.selectedMintUrl = storedselectedMintUrl || '';
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
        this.seedVersion = storedSeedVersion ? storedSeedVersion : undefined;
        this.seedPhrase = storedSeedPhrase
            ? JSON.parse(storedSeedPhrase)
            : undefined;
        this.seed = storedSeed
            ? Base64Utils.base64ToBytes(storedSeed)
            : undefined;

        // Run Cashu specific migrations before CDK init
        await MigrationsUtils.migrateCashuSeedVersion(this);

        // Initialize CDK and use it as the source of truth for mints/balances
        if (CashuDevKit.isAvailable()) {
            try {
                const cdkInitialized = await this.initializeCDK();
                if (!cdkInitialized) {
                    throw new Error('CDK wallet initialization returned false');
                }
                console.log('CDK initialized during wallet startup');

                // Migrate any mints from local storage to CDK
                const localMintUrls = storedMintUrls
                    ? JSON.parse(storedMintUrls)
                    : [];
                const cdkMintUrls = await CashuDevKit.getMintUrls();

                for (const mintUrl of localMintUrls) {
                    if (!cdkMintUrls.includes(mintUrl)) {
                        try {
                            await CashuDevKit.addMint(mintUrl);
                            this.addedMintsCache.add(
                                this.normalizeMintUrl(mintUrl)
                            );
                            console.log(
                                `CDK: Migrated mint from local storage: ${mintUrl}`
                            );

                            // Restore any existing funds for this mint
                            runInAction(() => {
                                this.loadingMsg = localeString(
                                    'stores.CashuStore.restoringFunds'
                                );
                            });
                            const restored = await CashuDevKit.restore(mintUrl);
                            if (restored > 0) {
                                console.log(
                                    `CDK: Restored ${restored} sats from ${mintUrl}`
                                );
                            }
                        } catch (e) {
                            console.warn(
                                `CDK: Failed to migrate mint ${mintUrl}:`,
                                e
                            );
                        }
                    }
                }

                // Get mint URLs from CDK (source of truth) and populate cache
                this.mintUrls = await CashuDevKit.getMintUrls();
                this.mintUrls.forEach((url) =>
                    this.addedMintsCache.add(this.normalizeMintUrl(url))
                );

                // Initialize wallet UI state for each mint
                await Promise.all(
                    this.mintUrls.map((mintUrl) =>
                        this.initializeWallet(mintUrl)
                    )
                );

                // Sync balances and fetch mint info from CDK
                await this.syncCDKBalances(true); // Include transactions on init
                await Promise.all(
                    this.mintUrls.map((mintUrl) => this.fetchMintInfo(mintUrl))
                );

                // Enrich tokens with proofs if missing (migration for old tokens)
                await this.enrichTokensWithProofs();

                // Clean up legacy local storage (mint URLs now in CDK)
                await Storage.removeItem(`${lndDir}-cashu-mintUrls`);
                await Storage.removeItem(`${lndDir}-cashu-totalBalanceSats`);

                // Clean up legacy per-wallet storage keys (now handled by CDK)
                for (const mintUrl of this.mintUrls) {
                    const walletId = `${lndDir}==${mintUrl}`;
                    // Remove keys that CDK now manages internally
                    await Storage.removeItem(`${walletId}-mintInfo`);
                    await Storage.removeItem(`${walletId}-proofs`);
                    await Storage.removeItem(`${walletId}-balance`);
                    // Keep -counter for legacy restore tool
                    // Keep -pubkey for display purposes
                }

                // Clean up legacy seed bytes if we have a valid seed phrase
                // (seed bytes were used by old cashu-ts, CDK uses mnemonic directly)
                if (this.seedPhrase && this.seedPhrase.length > 0) {
                    await Storage.removeItem(`${lndDir}-cashu-seed`);
                }
            } catch (e) {
                console.warn('CDK initialization failed:', e);
                // Fallback: use local storage mint URLs if CDK fails
                this.mintUrls = storedMintUrls
                    ? JSON.parse(storedMintUrls)
                    : [];
                await Promise.all(
                    this.mintUrls.map((mintUrl) =>
                        this.initializeWallet(mintUrl)
                    )
                );
            }
        } else {
            // CDK not available - use local storage (should not happen in production)
            console.warn('CDK not available, using local storage');
            this.mintUrls = storedMintUrls ? JSON.parse(storedMintUrls) : [];
            await Promise.all(
                this.mintUrls.map((mintUrl) => this.initializeWallet(mintUrl))
            );
        }

        // Ensure selected mint is valid
        if (
            this.selectedMintUrl &&
            !this.mintUrls.includes(this.selectedMintUrl)
        ) {
            this.selectedMintUrl = this.mintUrls[0] || '';
            await Storage.setItem(
                `${lndDir}-cashu-selectedMintUrl`,
                this.selectedMintUrl
            );
        }

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

    /**
     * Derive a P2PK pubkey from the Cashu mnemonic
     * Uses BIP-32 derivation path m/129372'/0'/0'/0'/0' per Cashu NUT-10
     */
    private deriveCashuPubkey = (): string | null => {
        const childKey = this.getCashuHDKey();
        if (!childKey?.publicKey) {
            console.warn(
                'Cannot derive pubkey: no seed phrase or key available'
            );
            return null;
        }
        // Return compressed public key as hex (33 bytes)
        return bytesToHex(childKey.publicKey);
    };

    /**
     * Derive the P2PK secret key from the Cashu mnemonic
     * Uses BIP-32 derivation path m/129372'/0'/0'/0'/0' per Cashu NUT-10
     * This key is used to sign when minting from P2PK-locked quotes
     */
    public deriveCashuSecretKey = (): string | null => {
        const childKey = this.getCashuHDKey();
        if (!childKey?.privateKey) {
            console.warn(
                'Cannot derive secret key: no seed phrase or key available'
            );
            return null;
        }
        // Return private key as hex (32 bytes)
        return bytesToHex(childKey.privateKey);
    };

    @action
    public initializeWallet = async (mintUrl: string): Promise<Wallet> => {
        console.log('initializing wallet for URL', mintUrl);

        const walletId = `${this.getLndDir()}==${mintUrl}`;

        // Load stored pubkey or derive from seed
        let pubkey = await Storage.getItem(`${walletId}-pubkey`);

        if (!pubkey) {
            // Derive pubkey from mnemonic if not stored
            const derivedPubkey = this.deriveCashuPubkey();
            if (derivedPubkey) {
                pubkey = derivedPubkey;
                // Store for future use
                await Storage.setItem(`${walletId}-pubkey`, pubkey);
                console.log('Derived and stored Cashu pubkey for', mintUrl);
            } else {
                pubkey = '';
                console.warn('Could not derive pubkey for', mintUrl);
            }
        }

        runInAction(() => {
            this.cashuWallets[mintUrl] = {
                walletId,
                pubkey,
                errorConnecting: false
            };
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
            if (!this.isProperlyConfigured()) {
                throw new Error(
                    localeString('stores.CashuStore.notProperlyConfigured')
                );
            }

            // Create mint quote via CDK
            const cdkQuote = await this.createMintQuoteCDK(
                this.selectedMintUrl,
                value ? Number(value) : 0,
                memo
            );
            const mintQuote = {
                quote: cdkQuote.id,
                request: cdkQuote.request,
                state: cdkQuote.state,
                expiry: cdkQuote.expiry
            };

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
                    mintUrl: this.selectedMintUrl
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
            const error_msg = e?.message || e?.toString() || 'Unknown error';
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
        _lockedQuote?: boolean,
        skipMintCheck?: boolean
    ) => {
        const mintUrl = quoteMintUrl || this.selectedMintUrl;

        console.log('checkInvoicePaid called with:', {
            quoteId,
            quoteMintUrl,
            mintUrl,
            _lockedQuote,
            skipMintCheck
        });

        if (!this.isProperlyConfigured()) {
            throw new Error(
                localeString('stores.CashuStore.notProperlyConfigured')
            );
        }

        const invoiceQuoteId: string = quoteId || this.quoteId || '';

        console.log('checkInvoicePaid invoiceQuoteId:', invoiceQuoteId);

        // Check and mint via CDK
        const result = await this.checkAndMintCDK(mintUrl, invoiceQuoteId);

        console.log('checkAndMintCDK result:', result);

        if (result.isPaid) {
            // CDK handles storage internally, just update local state
            await this.syncCDKBalances(true); // Include transactions for activity

            let updatedInvoice: CashuInvoice | undefined;

            // If we have quote info, create invoice record
            if (result.quote) {
                const cdkQuote = result.quote;
                let decoded;
                try {
                    decoded = bolt11.decode(cdkQuote.request);
                } catch (e) {
                    console.log(
                        'error decoding Cashu bolt11',
                        cdkQuote.request
                    );
                }

                updatedInvoice = new CashuInvoice({
                    quote: cdkQuote.id,
                    request: cdkQuote.request,
                    state: 'PAID',
                    paid: true,
                    expiry: cdkQuote.expiry,
                    decoded,
                    mintUrl
                });

                // Update or add the invoice in the store
                runInAction(() => {
                    const invoiceIndex = this.invoices?.findIndex(
                        (item) => item.quote === invoiceQuoteId
                    );
                    if (invoiceIndex !== undefined && invoiceIndex > -1) {
                        this.invoices!![invoiceIndex] = updatedInvoice!;
                    } else {
                        this.invoices?.push(updatedInvoice!);
                    }
                });

                await Storage.setItem(
                    `${this.getLndDir()}-cashu-invoices`,
                    this.invoices
                );

                activityStore.getSortedActivity();
            }

            if (!skipMintCheck) {
                this.checkAndSweepMints(mintUrl);
            }

            return {
                isPaid: true,
                amtSat: result.amount,
                paymentRequest: this.invoice || '',
                updatedInvoice
            };
        }

        // Return quote state info for better error messages
        return {
            isPaid: false,
            quoteState: result.quote?.state,
            isLegacy: result.isLegacy
        };
    };

    @action
    public restoreMintProofs = async (mintUrl: string) => {
        if (!this.cdkInitialized) {
            console.error('CDK not initialized, cannot restore proofs');
            return null;
        }

        try {
            this.restorationProgress = 0;
            console.log(
                RESTORE_PROOFS_EVENT_NAME,
                `CDK: Starting restore for mint: "${mintUrl}"`
            );

            const restoredAmount = await this.restoreCDK(mintUrl);

            this.restorationProgress = 100;
            console.log(
                RESTORE_PROOFS_EVENT_NAME,
                `CDK: Restored ${restoredAmount} sats`
            );

            this.restorationProgress = undefined;
            this.restorationKeyset = undefined;
            return true;
        } catch (error: any) {
            console.error('CDK restore error:', error);
            console.log(
                RESTORE_PROOFS_EVENT_NAME,
                `CDK Error: ${error.message}`
            );
            this.restorationProgress = undefined;
            this.restorationKeyset = undefined;
            return null;
        }
    };

    @action
    public getPayReq = async (
        bolt11Invoice: string,
        isDonationPayment: boolean = false
    ) => {
        console.log('getPayReq: Starting', {
            bolt11Invoice: bolt11Invoice?.substring(0, 20),
            isDonationPayment
        });

        if (!isDonationPayment) {
            this.loading = true;
        }
        this.payReq = undefined;
        this.paymentRequest = bolt11Invoice;
        this.feeEstimate = undefined;

        try {
            console.log('getPayReq: Checking isProperlyConfigured');
            if (!this.isProperlyConfigured()) {
                throw new Error(
                    localeString('stores.CashuStore.notProperlyConfigured')
                );
            }
            console.log('getPayReq: isProperlyConfigured passed');

            console.log('getPayReq: Decoding bolt11');
            const data = await new Promise((resolve, reject) => {
                try {
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
                } catch (err) {
                    reject(err);
                }
            });
            console.log('getPayReq: bolt11 decoded');

            // Create melt quote via CDK
            console.log('getPayReq: About to call createMeltQuoteCDK');
            const cdkQuote = await this.createMeltQuoteCDK(
                this.selectedMintUrl,
                bolt11Invoice
            );
            console.log('getPayReq: createMeltQuoteCDK completed', cdkQuote);
            const meltQuote = {
                quote: cdkQuote.id,
                amount: cdkQuote.amount,
                fee_reserve: cdkQuote.fee_reserve,
                state: cdkQuote.state as any,
                expiry: cdkQuote.expiry,
                payment_preimage: cdkQuote.payment_preimage
            };

            runInAction(() => {
                this.payReq = new Invoice(data);
                this.getPayReqError = undefined;
                this.meltQuote = meltQuote;
                this.feeEstimate = meltQuote.fee_reserve || 0;
            });
            console.log('getPayReq: Success, setting loading = false');
        } catch (e: any) {
            console.log('getPayReq: Error caught', e?.message || e);
            const errorMsg = errorToUserFriendly(e);
            runInAction(() => {
                this.payReq = undefined;
                this.getPayReqError = errorMsg;
            });
        } finally {
            // ALWAYS set loading = false when done
            console.log('getPayReq: Finally block, setting loading = false');
            if (!isDonationPayment) {
                runInAction(() => {
                    this.loading = false;
                });
            }
        }
    };

    @action
    public payLnInvoiceFromEcash = async ({
        amount,
        isDonationPayment = false
    }: {
        amount?: string;
        isDonationPayment?: boolean;
    }) => {
        // Reset payment state (don't set loading=true here as it triggers LoadingIndicator on CashuPaymentRequest)
        if (isDonationPayment) {
            console.log('CDK payLnInvoiceFromEcash: Starting donation payment');
        } else {
            this.paymentPreimage = '';
            this.paymentSuccess = false;
            this.paymentError = false;
            this.paymentErrorMsg = '';
            this.paymentStartTime = Date.now();
        }

        const mintUrl = this.selectedMintUrl;

        if (!this.meltQuote) {
            runInAction(() => {
                this.paymentError = true;
                this.paymentErrorMsg = 'No melt quote available';
                this.loading = false;
            });
            return;
        }

        try {
            const paymentAmt = this.payReq?.getRequestAmount
                ? this.payReq?.getRequestAmount
                : Number(amount);

            // Check balance via CDK
            const balance = await CashuDevKit.getMintBalance(mintUrl);
            const amountToPay = this.feeEstimate
                ? this.feeEstimate + paymentAmt
                : paymentAmt;

            if (balance < amountToPay) {
                runInAction(() => {
                    this.paymentError = true;
                    this.paymentErrorMsg = localeString(
                        'stores.CashuStore.notEnoughFunds'
                    );
                    this.loading = false;
                });
                return;
            }

            const meltResult = await this.meltCDK(
                mintUrl,
                this.paymentRequest!
            );

            const realFee = meltResult.fee_paid;
            const paymentPreimage = meltResult.preimage || '';

            const payment = new CashuPayment({
                ...this.payReq,
                bolt11: this.paymentRequest,
                meltResponse: {
                    quote: this.meltQuote,
                    change: meltResult.change
                },
                amount: meltResult.amount,
                fee: realFee,
                payment_preimage: paymentPreimage,
                mintUrl
            });

            // Store the payment
            this.payments?.push(payment);

            await Storage.setItem(
                `${this.getLndDir()}-cashu-payments`,
                this.payments
            );

            // CDK handles balance updates internally
            await this.syncCDKBalances(true); // Include transactions for activity

            // Set payment result
            runInAction(() => {
                if (!isDonationPayment) {
                    this.paymentPreimage = paymentPreimage;
                    this.paymentSuccess = true;
                    this.noteKey = payment.getNoteKey;
                    this.loading = false;
                }

                if (this.paymentStartTime) {
                    this.paymentDuration =
                        (Date.now() - this.paymentStartTime) / 1000;
                }
            });

            return payment;
        } catch (err: any) {
            console.error('CDK payLnInvoiceFromEcash error:', err);
            runInAction(() => {
                this.paymentError = true;
                this.paymentErrorMsg = String(err.message);
                this.loading = false;
            });
            return;
        }
    };

    @action
    public checkTokenSpent = async (decoded: CashuToken) => {
        const { mint } = decoded;

        if (this.cashuWallets[mint]?.errorConnecting) {
            return false;
        }

        try {
            // Get proofs - decode from encodedToken if not available
            let proofs = decoded.proofs;
            if (
                (!proofs || !Array.isArray(proofs) || proofs.length === 0) &&
                decoded.encodedToken
            ) {
                try {
                    // Use cashu-ts sync decode which returns proofs directly
                    const decodedToken = CashuUtils.decodeCashuToken(
                        decoded.encodedToken
                    );
                    proofs = decodedToken.proofs || [];
                } catch (e) {
                    console.error('Error decoding token for spent check:', e);
                    return false;
                }
            }

            if (!proofs || !Array.isArray(proofs) || proofs.length === 0) {
                return false;
            }

            // Map proofs to CDK format
            const cdkProofs = proofs.map((p: any) => ({
                amount: p.amount,
                keyset_id: p.id || p.keyset_id || '',
                secret: p.secret,
                c: p.C || p.c || ''
            }));

            await this.ensureMintAdded(mint);

            // Use CDK to check proofs state
            const states = await CashuDevKit.checkProofsState(mint, cdkProofs);

            if (!states || !Array.isArray(states)) {
                return false;
            }

            let alreadySpent = false;
            states.forEach((state) => {
                if (alreadySpent) return;
                // CDK uses 'Unspent', 'Pending', 'Spent' (capitalized)
                if (state.state !== 'Unspent') {
                    alreadySpent = true;
                }
            });

            return alreadySpent;
        } catch (error: any) {
            console.error('Error checking token spent status:', error);
            runInAction(() => {
                this.error = true;
                let errorMessage: string;
                if (error && typeof error === 'object') {
                    // CDKError has { type, message } structure
                    errorMessage = error.message || String(error);
                } else if (typeof error === 'string') {
                    errorMessage = error;
                } else {
                    errorMessage = String(error);
                }
                this.error_msg =
                    errorMessage ||
                    localeString('stores.CashuStore.checkSpentError');
            });
            return false;
        }
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

        try {
            // Ensure CDK is initialized
            if (!this.cdkInitialized) {
                await this.initializeCDK();
            }

            // Check if token is valid
            const isValid = await CashuDevKit.isValidToken(encodedToken);
            if (!isValid) {
                this.loading = false;
                return {
                    success: false,
                    errorMessage: localeString('stores.CashuStore.invalidToken')
                };
            }
            const isLocked = CashuUtils.isTokenP2PKLocked(decoded);
            const signingKey = isLocked
                ? this.deriveCashuSecretKey() ?? undefined
                : undefined;

            if (toSelfCustody) {
                // For toSelfCustody, receive the token first then sweep via melt
                const tokenAmt = decoded.getAmount;

                const memo = `${localeString(
                    'views.Cashu.CashuToken.tokenSweep'
                )}${decoded.memo ? `: ${decoded.memo}` : ''}`;

                const invoiceParams = {
                    expirySeconds: '3600',
                    routeHints: true,
                    noLsp: true
                };

                // Pass signing key only when token is P2PK-locked (decoded has proofs)

                await this.receiveTokenCDK(encodedToken, signingKey);
                await this.syncCDKBalances();

                // Create invoice for sweeping
                let invoice = await this.invoicesStore.createInvoice({
                    ...invoiceParams,
                    memo,
                    value: String(tokenAmt)
                });

                // Create melt quote via CDK
                const meltQuote = await this.createMeltQuoteCDK(
                    mintUrl,
                    invoice.paymentRequest
                );

                if (meltQuote.fee_reserve > 0) {
                    const receiveAmtSat = tokenAmt - meltQuote.fee_reserve;
                    if (receiveAmtSat <= 0) {
                        this.loading = false;
                        return {
                            success: false,
                            errorMessage: localeString(
                                'stores.CashuStore.feeExceedsAmt'
                            )
                        };
                    }

                    // Recreate invoice with adjusted amount
                    invoice = await this.invoicesStore.createInvoice({
                        ...invoiceParams,
                        memo: `${memo} [${localeString(
                            'views.Cashu.CashuToken.feeAdjusted'
                        )}]`,
                        value: receiveAmtSat.toString()
                    });
                }

                // Melt via CDK to pay the invoice
                await this.meltCDK(mintUrl, invoice.paymentRequest);

                await this.syncCDKBalances(true); // Include transactions for activity
            } else {
                // Regular receive via CDK
                await this.receiveTokenCDK(encodedToken, signingKey);

                // Record received token activity
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

                // CDK handles balance updates internally
                await this.syncCDKBalances(true); // Include transactions for activity

                this.checkAndSweepMints(mintUrl);
            }

            this.loading = false;
            return { success: true, errorMessage: '' };
        } catch (e: any) {
            console.error('CDK claimToken error:', e);
            if (e.message?.includes('spent') || e.message?.includes('Spent')) {
                this.loading = false;
                return {
                    success: false,
                    errorMessage: localeString('stores.CashuStore.alreadySpent')
                };
            }
            if (
                typeof e?.message === 'string' &&
                e.message.toLowerCase().includes('witness is missing') &&
                e.message.toLowerCase().includes('p2pk')
            ) {
                this.loading = false;
                return {
                    success: false,
                    errorMessage: localeString(
                        'stores.CashuStore.claimError.lockedToWallet'
                    )
                };
            }
            this.loading = false;
            return {
                success: false,
                errorMessage:
                    e.message || localeString('stores.CashuStore.claimError')
            };
        }
    };

    @action
    public checkAndSweepMints = async (specificMintUrl?: string) => {
        if (this.channelsStore.channels.length === 0) {
            return;
        }

        const automaticallySweep =
            this.settingsStore.settings.ecash.automaticallySweep;
        const sweepThresholdSats =
            this.settingsStore.settings.ecash.sweepThresholdSats;
        if (
            !automaticallySweep ||
            !sweepThresholdSats ||
            sweepThresholdSats <= 0
        ) {
            return;
        }

        const mintsToCheck = specificMintUrl
            ? [specificMintUrl]
            : this.mintUrls;

        for (const mintUrl of mintsToCheck) {
            const balance = this.mintBalances[mintUrl] || 0;

            if (balance > sweepThresholdSats) {
                console.log(
                    `Cashu sweep triggered for ${mintUrl}: Balance ${balance} > Threshold ${sweepThresholdSats}`
                );
                try {
                    await this.sweepMint(mintUrl);
                } catch (error) {
                    console.error(`Error sweeping mint ${mintUrl}:`, error);
                }
            } else {
                console.log(
                    `Cashu sweep check for ${mintUrl}: Balance ${balance} <= Threshold ${sweepThresholdSats}`
                );
            }
        }
    };

    @action
    public sweepMint = async (mintUrl: string): Promise<boolean> => {
        console.log(`Attempting to sweep funds from mint: ${mintUrl}`);
        this.loading = true;

        try {
            // Get balance from CDK
            const amountToSweep = await CashuDevKit.getMintBalance(mintUrl);
            if (amountToSweep <= 0) {
                console.log(`Sweep skipped for ${mintUrl}: Zero balance.`);
                this.loading = false;
                return true;
            }

            const memo = `${localeString(
                'stores.CashuStore.autoSweep'
            )} ${mintUrl}`;
            const invoiceParams = {
                expirySeconds: '3600',
                routeHints: true,
                noLsp: true
            };

            // 1. Create initial invoice for full amount to estimate fee
            console.log(
                `Sweep ${mintUrl}: Creating initial invoice for ${amountToSweep} sats`
            );
            const initialInvoice = await this.invoicesStore.createInvoice({
                ...invoiceParams,
                memo,
                value: String(amountToSweep)
            });
            if (!initialInvoice?.paymentRequest)
                throw new Error(
                    'Failed to create initial invoice for fee estimation.'
                );

            // 2. Get melt quote from CDK for fee estimation
            console.log(
                `Sweep ${mintUrl}: Getting melt quote for fee estimation`
            );
            const initialMeltQuote = await CashuDevKit.createMeltQuote(
                mintUrl,
                initialInvoice.paymentRequest
            );
            const feeReserve = initialMeltQuote.fee_reserve;
            console.log(
                `Sweep ${mintUrl}: Estimated fee reserve: ${feeReserve} sats`
            );

            // 3. Calculate actual receive amount and create final invoice
            const receiveAmtSat = amountToSweep - feeReserve;
            if (receiveAmtSat <= 0) {
                console.warn(
                    `Sweep ${mintUrl}: Fee reserve (${feeReserve}) exceeds or equals amount to sweep (${amountToSweep}). Cannot sweep.`
                );
                this.loading = false;
                return false;
            }

            console.log(
                `Sweep ${mintUrl}: Creating final invoice for ${receiveAmtSat} sats`
            );
            const finalInvoice = await this.invoicesStore.createInvoice({
                ...invoiceParams,
                memo: `${memo} [${localeString(
                    'views.Cashu.CashuToken.feeAdjusted'
                )}]`,
                value: String(receiveAmtSat)
            });
            if (!finalInvoice?.paymentRequest)
                throw new Error('Failed to create final invoice for sweep.');

            // 4. Execute melt via CDK (handles quote creation internally)
            console.log(`Sweep ${mintUrl}: Executing melt via CDK`);
            const meltResponse = await CashuDevKit.melt(
                mintUrl,
                finalInvoice.paymentRequest
            );
            console.log(
                `Sweep ${mintUrl}: Melt response received`,
                meltResponse
            );

            // 6. Update balances from CDK
            await this.calculateTotalBalance();

            console.log(
                `Sweep ${mintUrl}: Successfully swept ${receiveAmtSat} sats.`
            );
            this.loading = false;
            return true;
        } catch (e: any) {
            const error = e;
            console.error(`Sweep failed for mint ${mintUrl}:`, error);
            runInAction(() => {
                this.loading = false;
                this.error = true;
                this.error_msg = `${localeString(
                    'stores.CashuStore.sweepError'
                )} (${mintUrl}): ${error.message || error.toString()}`;
            });
            return false;
        }
    };

    @action
    public mintToken = async ({
        memo,
        value,
        pubkey,
        lockTime
    }: {
        memo: string;
        value: string;
        pubkey?: string;
        lockTime?: number;
    }): Promise<{ token: string; decoded: CashuToken } | undefined> => {
        runInAction(() => {
            this.mintingToken = true;
            this.mintingTokenError = false;
            this.error_msg = undefined;
        });

        const mintUrl = this.selectedMintUrl;

        try {
            // Check balance via CDK
            const balance = await CashuDevKit.getMintBalance(mintUrl);
            if (balance < Number(value)) {
                runInAction(() => {
                    this.mintingTokenError = true;
                    this.mintingToken = false;
                    this.error_msg = localeString(
                        'stores.CashuStore.insufficientBalance'
                    );
                });
                return;
            }

            // Send token via CDK (normalize pubkey so we never create P2PK by mistake)
            const cdkToken = await this.sendTokenCDK(
                mintUrl,
                Number(value),
                memo,
                pubkey,
                lockTime
            );

            const token = cdkToken.encoded;

            const decoded = new CashuToken({
                mint: mintUrl,
                memo,
                unit: 'sat',
                sent: true,
                proofs: cdkToken.proofs,
                encodedToken: token,
                created_at: Date.now() / 1000,
                spent: false,
                value: cdkToken.value
            });

            // Record sent token activity
            this.sentTokens?.push(decoded);
            await Storage.setItem(
                `${this.getLndDir()}-cashu-sent-tokens`,
                this.sentTokens
            );

            // CDK handles balance updates internally
            await this.syncCDKBalances();

            runInAction(() => {
                this.mintingToken = false;
            });

            return { token, decoded };
        } catch (e: any) {
            console.error('CDK mintToken error:', e);
            runInAction(() => {
                this.mintingTokenError = true;
                this.mintingToken = false;
                this.error_msg =
                    e.message ||
                    localeString('stores.CashuStore.errorMintingToken');
            });
            return;
        }
    };

    @action
    public deleteCashuData = async () => {
        this.loading = true;
        const lndDir = this.getLndDir();

        try {
            // Remove all mints from CDK
            for (const mintUrl of this.mintUrls) {
                try {
                    await CashuDevKit.removeMint(mintUrl);
                    console.log(`CDK: Removed mint ${mintUrl}`);
                } catch (e) {
                    console.warn(`CDK: Failed to remove mint ${mintUrl}:`, e);
                }

                // Clean up legacy local storage for this mint
                const walletId = `${lndDir}==${mintUrl}`;
                await Storage.removeItem(`${walletId}-mintInfo`);
                await Storage.removeItem(`${walletId}-counter`);
                await Storage.removeItem(`${walletId}-proofs`);
                await Storage.removeItem(`${walletId}-balance`);
                await Storage.removeItem(`${walletId}-pubkey`);
            }

            // Clean up legacy storage keys (may exist from migration)
            await Storage.removeItem(`${lndDir}-cashu-mintUrls`);
            await Storage.removeItem(`${lndDir}-cashu-totalBalanceSats`);

            // Clean up app-specific storage
            await Storage.removeItem(`${lndDir}-cashu-selectedMintUrl`);
            await Storage.removeItem(`${lndDir}-cashu-invoices`);
            await Storage.removeItem(`${lndDir}-cashu-payments`);
            await Storage.removeItem(`${lndDir}-cashu-received-tokens`);
            await Storage.removeItem(`${lndDir}-cashu-sent-tokens`);
            await Storage.removeItem(`${lndDir}-cashu-seed-version`);
            await Storage.removeItem(`${lndDir}-cashu-seed-phrase`);
            await Storage.removeItem(`${lndDir}-cashu-seed`);

            if (lightningAddressStore.lightningAddressType === 'cashu') {
                lightningAddressStore.deleteAddress();
            }

            // Reset store state
            this.reset();
            this.cdkInitialized = false;

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
