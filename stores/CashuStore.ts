import { action, observable, runInAction } from 'mobx';
import { Alert } from 'react-native';
import bolt11 from 'bolt11';
import url from 'url';
import querystring from 'querystring-es3';
import {
    CashuMint,
    CashuWallet,
    MeltQuoteResponse,
    MeltQuoteState,
    Proof
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

import Storage from '../storage';

import stores from './Stores';
import SettingsStore, { DEFAULT_NOSTR_RELAYS } from './SettingsStore';

import Base64Utils from '../utils/Base64Utils';
import { localeString } from '../utils/LocaleUtils';
import { errorToUserFriendly } from '../utils/ErrorUtils';

const bip39 = require('bip39');

const BATCH_SIZE = 100;
const MAX_GAP = 3;
const RESTORE_PROOFS_EVENT_NAME = 'RESTORING_PROOF_EVENT';

const sumProofsValue = (proofs: any) => {
    return proofs.reduce((r: number, c: any) => {
        return r + c.amount;
    }, 0);
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

export default class CashuStore {
    @observable public mintUrls: Array<string>;
    @observable public selectedMintUrl: string;
    @observable public cashuWallets: { [key: string]: Wallet };
    @observable public totalBalanceSats: number;
    @observable public invoices?: Array<CashuInvoice>;
    @observable public payments?: Array<CashuPayment>;
    @observable public invoice?: string;
    @observable public quoteId?: string;

    @observable public loading = false;
    @observable public creatingInvoice = false;
    @observable public creatingInvoiceError = false;
    @observable public watchedInvoicePaid = false;
    @observable public watchedInvoicePaidAmt?: number | string;
    @observable public restorationProgress?: number;
    @observable public restorationKeyset?: number;
    @observable public loadingMsg?: string;
    @observable public error = false;
    @observable public error_msg?: string;

    @observable public payReq?: Invoice;
    @observable public paymentRequest?: string; // bolt11 invoice
    @observable public paymentPreimage?: string;
    @observable public getPayReqError?: string;
    @observable public paymentError?: string;
    @observable public feeEstimate?: number;
    @observable public proofsToUse?: Proof[];
    @observable public meltQuote?: MeltQuoteResponse;
    @observable public noteKey?: string;

    @observable public mintRecommendations?: MintRecommendation[];
    @observable loadingFeeEstimate = false;

    ndk: NDK;
    settingsStore: SettingsStore;

    constructor(settingsStore: SettingsStore) {
        this.settingsStore = settingsStore;
    }

    @action
    public reset = () => {
        this.cashuWallets = {};
        this.totalBalanceSats = 0;
        this.mintUrls = [];
        this.selectedMintUrl = '';
        this.clearInvoice();
        this.clearPayReq();
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
        this.paymentError = undefined;
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
        this.loading = true;
        this.ndk = new NDK({ explicitRelayUrls: DEFAULT_NOSTR_RELAYS });
        this.ndk.connect();

        const filter: NDKFilter = { kinds: [38000 as NDKKind], limit: 2000 };
        const events = await this.ndk.fetchEvents(filter);
        let mintUrls: string[] = [];
        events.forEach((event: any) => {
            if (event.tagValue('k') == '38172' && event.tagValue('u')) {
                const mintUrl = event.tagValue('u');
                if (
                    typeof mintUrl === 'string' &&
                    mintUrl.length > 0 &&
                    mintUrl.startsWith('https://')
                ) {
                    mintUrls.push(mintUrl);
                }
            }
        });
        // Count the number of times each mint URL appears
        const mintUrlsSet = new Set(mintUrls);
        const mintUrlsArray = Array.from(mintUrlsSet);
        const mintUrlsCounted = mintUrlsArray.map((url) => {
            return {
                url,
                count: mintUrls.filter((u) => u === url).length
            };
        });
        mintUrlsCounted.sort((a, b) => b.count - a.count);
        this.mintRecommendations = mintUrlsCounted;
        this.loading = false;
        return mintUrlsCounted;
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

        await this.initializeWallet(mintUrl, true);
        if (checkForExistingProofs) {
            await this.restoreMintProofs(mintUrl);
            await this.calculateTotalBalance();
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
    ): Promise<{ wallet: CashuWallet; pubkey: string }> => {
        this.loading = true;
        console.log('starting wallet for URL', mintUrl);
        const mint = new CashuMint(mintUrl);
        const keysets = (await mint.getKeySets()).keysets.filter(
            (ks) => ks.unit === 'sat'
        );
        const keys = (await mint.getKeys()).keysets.find(
            (ks) => ks.unit === 'sat'
        );

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

            return { wallet, pubkey };
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

    setTotalBalance = async (totalBalanceSats: number) => {
        await Storage.setItem(
            `${this.getLndDir()}-cashu-totalBalanceSats`,
            totalBalanceSats
        );

        runInAction(() => {
            this.totalBalanceSats = totalBalanceSats;
        });

        return totalBalanceSats;
    };

    @action
    public initializeWallet = async (
        mintUrl: string,
        startWallet?: boolean
    ): Promise<Wallet> => {
        console.log('initializing wallet for URL', mintUrl);

        const walletId = `${this.getLndDir()}==${mintUrl}`;

        const storedMintInfo = await Storage.getItem(`${walletId}-mintInfo`);
        const mintInfo = storedMintInfo ? JSON.parse(storedMintInfo) : [];

        const storedCounter = await Storage.getItem(`${walletId}-counter`);
        const counter = storedCounter ? JSON.parse(storedCounter) : 0;

        const storedProofs = await Storage.getItem(`${walletId}-proofs`);
        const proofs = storedProofs ? JSON.parse(storedProofs) : [];

        const storedBalanceSats = await Storage.getItem(`${walletId}-balance`);
        const balanceSats = storedBalanceSats
            ? JSON.parse(storedBalanceSats)
            : 0;

        const storedPubkey = await Storage.getItem(`${walletId}-pubkey`);
        const pubkey: string = storedPubkey ? storedPubkey : '';

        let errorConnecting = false;
        runInAction(() => {
            this.cashuWallets[mintUrl] = {
                pubkey,
                walletId,
                mintInfo,
                counter,
                proofs,
                balanceSats,
                errorConnecting
            };
            this.loadingMsg = `${localeString(
                'stores.CashuStore.startingWallet'
            )}: ${mintUrl}`;
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
                    pubkey
                }: { wallet: CashuWallet; pubkey: string } =
                    await this.startWallet(mintUrl);
                runInAction(() => {
                    this.cashuWallets[mintUrl].wallet = wallet;
                    this.cashuWallets[mintUrl].pubkey = pubkey;
                });
            } catch (e) {
                errorConnecting = true;
            }
        }

        runInAction(() => {
            this.loadingMsg = undefined;
            this.loading = false;
        });

        return this.cashuWallets[mintUrl];
    };

    @action
    public initializeWallets = async () => {
        const lndDir = this.getLndDir();

        const storedMintUrls = await Storage.getItem(
            `${lndDir}-cashu-mintUrls`
        );
        this.mintUrls = storedMintUrls ? JSON.parse(storedMintUrls) : [];

        const storedselectedMintUrl = await Storage.getItem(
            `${lndDir}-cashu-selectedMintUrl`
        );
        this.selectedMintUrl = storedselectedMintUrl
            ? storedselectedMintUrl
            : '';

        const storedTotalBalanceSats = await Storage.getItem(
            `${lndDir}-cashu-totalBalanceSats`
        );
        this.totalBalanceSats = storedTotalBalanceSats
            ? JSON.parse(storedTotalBalanceSats)
            : 0;

        const storedInvoices = await Storage.getItem(
            `${lndDir}-cashu-invoices`
        );
        this.invoices = storedInvoices
            ? JSON.parse(storedInvoices).map(
                  (invoice: any) => new CashuInvoice(invoice)
              )
            : [];
        const storedPayments = await Storage.getItem(
            `${lndDir}-cashu-payments`
        );
        this.payments = storedPayments
            ? JSON.parse(storedPayments).map(
                  (payment: any) => new CashuPayment(payment)
              )
            : [];

        for (let i = 0; i < this.mintUrls.length; i++) {
            const mintUrl = this.mintUrls[i];
            await new Promise(async (resolve) => {
                const wallet = await this.initializeWallet(mintUrl);
                resolve(wallet);
            });
        }

        runInAction(() => {
            this.loadingMsg = undefined;
        });
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

        if (!this.cashuWallets[this.selectedMintUrl].wallet) {
            await this.initializeWallet(this.selectedMintUrl, true);
        }

        try {
            const mintQuote = await this.cashuWallets[
                this.selectedMintUrl
            ].wallet!!.createMintQuote(value ? Number(value) : 0, memo);

            let invoice: any;
            if (mintQuote) {
                this.quoteId = mintQuote?.quote;
                invoice = new CashuInvoice({
                    ...mintQuote,
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
            runInAction(() => {
                this.creatingInvoiceError = true;
                this.creatingInvoice = false;
                this.error_msg = localeString(
                    'stores.InvoicesStore.errorCreatingInvoice'
                );
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

        if (!this.cashuWallets[mintUrl].wallet) {
            await this.initializeWallet(mintUrl, true);
        }

        const invoiceQuoteId = quoteId || this.quoteId || '';

        const quote = await this.cashuWallets[mintUrl].wallet?.checkMintQuote(
            invoiceQuoteId
        );

        const updatedInvoice = new CashuInvoice({
            ...quote,
            mintUrl
        });

        const amtSat = updatedInvoice.getAmount;

        const paymentRequest = this.invoice || '';
        if (quote?.state === 'PAID') {
            // try up to 3 counters in case we get out of sync (DEBUG)
            let attempts = 0;
            let retries = 3;
            let success = false;

            while (attempts < retries && !success) {
                try {
                    const counter =
                        this.cashuWallets[mintUrl].counter + attempts;
                    const newProofs: Proof[] = await this.cashuWallets[
                        mintUrl
                    ].wallet!!.mintProofs(
                        amtSat,
                        lockedQuote ? quote : invoiceQuoteId,
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

                    // delete old instance of invoice
                    this.invoices = this.invoices?.filter(
                        (item) => item.quote !== quote.quote
                    );
                    // save new instance of invoice
                    this.invoices?.push(updatedInvoice);
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
            return { isPaid: false, amtSat, paymentRequest, updatedInvoice };
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

                const restoredAmount = sumProofsValue(restoredProofs);
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

                const unspentKeysetProofs = batchProofs.filter((p, idx) =>
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
                    const balanceSats = sumProofsValue(mintProofs);
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
                    const proofsSum = sumProofsValue(proofs);
                    console.log(
                        `> Restored ${proofs.length} proofs with sum ${proofsSum} - starting at ${start}`
                    );
                    noProofsFoundCounter = 0;
                    lastFound = start + proofs.length;
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

            const cashuWallet = this.cashuWallets[this.selectedMintUrl];

            if (!cashuWallet.wallet) {
                await this.initializeWallet(this.selectedMintUrl, true);
            }
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
            runInAction(() => {
                this.payReq = undefined;
                this.getPayReqError = errorToUserFriendly(e);
                this.loading = false;
            });
        }
    };

    getSpendingProofsWithPreciseCounter = async (
        wallet: CashuWallet,
        amountToPay: number,
        proofs: Proof[],
        currentCounter: number
    ) => {
        try {
            const { keep: proofsToKeep, send: proofsToSend } =
                await wallet.send(amountToPay, proofs, {
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
        const totalProofsValue = sumProofsValue(proofs);

        console.log('ecash quote fee reserve:', this.feeEstimate);
        console.log('Proofs before send', proofs);
        console.log(totalProofsValue, amountToPay);

        try {
            if (totalProofsValue < amountToPay)
                throw new Error('Not enough funds to cover payment');
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
                    sumProofsValue(meltResponse?.change)
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
                this.error = true;
                this.paymentError = localeString(
                    'stores.CashuStore.alreadyPaid'
                );
                return;
            } else if (mintQuote.state == MeltQuoteState.PENDING) {
                this.error = true;
                this.paymentError = localeString('stores.CashuStore.pending');
                return;
            }
            await this.removeMintProofs(mintUrl, this.proofsToUse!!);
            await this.addMintProofs(mintUrl, proofs!!);
            this.error = true;
            this.paymentError = String(err.message);
            this.loading = false;
            return;
        }
    };
}
