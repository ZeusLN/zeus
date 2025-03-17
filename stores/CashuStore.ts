import { action, observable, runInAction } from 'mobx';
import { Alert } from 'react-native';
import url from 'url';
import querystring from 'querystring-es3';
import { CashuMint, CashuWallet, Proof } from '@cashu/cashu-ts';
import { LNURLWithdrawParams } from 'js-lnurl';
import ReactNativeBlobUtil from 'react-native-blob-util';
import BigNumber from 'bignumber.js';

import CashuInvoice from '../models/CashuInvoice';

import Storage from '../storage';

import stores from './Stores';
import SettingsStore from './SettingsStore';

import { localeString } from '../utils/LocaleUtils';

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
    wallet: CashuWallet;
    walletId: string;
    counter: number;
    proofs: Array<Proof>;
    balanceSats: number;
}

export default class CashuStore {
    @observable public lndDir: string;
    @observable public mintUrls: Array<string>;
    @observable public selectedMintUrl: string;
    @observable public cashuWallets: { [key: string]: Wallet };
    @observable public totalBalanceSats: number;
    @observable public invoices?: Array<CashuInvoice>;
    // @observable public payments?: Array<CashuPayments>;

    @observable public payment_request?: string;
    @observable public quoteId?: string;
    @observable public loading = false;
    @observable public creatingInvoice = false;
    @observable public creatingInvoiceError = false;
    @observable public watchedInvoicePaid = false;
    @observable public watchedInvoicePaidAmt: number | string;
    @observable public restorationProgress?: number;
    @observable public restorationKeyset?: number;
    @observable public loading_msg?: string;
    @observable public error = false;
    @observable public error_msg?: string;
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
    };

    @action
    public clearInvoice = () => {
        this.payment_request = undefined;
        this.quoteId = undefined;
        this.error = false;
    };

    calculateTotalBalance = async () => {
        let newTotalBalance = 0;
        Object.keys(this.cashuWallets).forEach((mintUrl: string) => {
            newTotalBalance =
                newTotalBalance + this.cashuWallets[mintUrl].balanceSats;
        });
        this.totalBalanceSats = newTotalBalance;
        await Storage.setItem(
            `${this.lndDir}-cashu-totalBalanceSats`,
            newTotalBalance
        );
        return this.totalBalanceSats;
    };

    @action
    public addMint = async (
        mintUrl: string,
        checkForExistingProofs?: boolean
    ) => {
        this.loading = true;
        const newMintUrls = this.mintUrls;
        newMintUrls.push(mintUrl);
        await Storage.setItem(`${this.lndDir}-cashu-mintUrls`, this.mintUrls);
        await this.initializeWallet(mintUrl);
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
        console.log('newMintUrls', newMintUrls);
        await Storage.setItem(`${this.lndDir}-cashu-mintUrls`, newMintUrls);
        delete this.cashuWallets[mintUrl];

        const walletId = `${this.lndDir}==${mintUrl}`;
        console.log('testB', `${walletId}-counter`);
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

    @action
    public startWallet = async (mintUrl: string): Promise<CashuWallet> => {
        console.log('starting wallet for URL', mintUrl);
        const mint = new CashuMint(mintUrl);
        const keysets = (await mint.getKeySets()).keysets.filter(
            (ks) => ks.unit === 'sat'
        );
        const keys = (await mint.getKeys()).keysets.find(
            (ks) => ks.unit === 'sat'
        );

        const seedPhrase = this.settingsStore.seedPhrase;
        const mnemonic = seedPhrase.join(' ');
        const seed = bip39.mnemonicToSeedSync(mnemonic);

        const mintInfo = await mint.getInfo();

        const wallet = new CashuWallet(mint, {
            bip39seed: new Uint8Array(seed),
            mintInfo,
            unit: 'sat',
            keys,
            keysets
        });

        // persist wallet.keys and wallet.keysets to avoid calling loadMint() in the future
        await wallet.loadMint();
        await wallet.getKeys();
        return wallet;
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
        console.log('testA', `${this.cashuWallets[mintUrl].walletId}-balance`);
        await Storage.setItem(
            `${this.cashuWallets[mintUrl].walletId}-balance`,
            balanceSats
        );

        runInAction(() => {
            this.cashuWallets[mintUrl].balanceSats = balanceSats;
        });

        return balanceSats;
    };

    @action
    public initializeWallet = async (mintUrl: string): Promise<Wallet> => {
        console.log('initializing wallet for URL', mintUrl);

        const walletId = `${this.lndDir}==${mintUrl}`;

        const storedCounter = await Storage.getItem(`${walletId}-counter`);
        const counter = storedCounter ? JSON.parse(storedCounter) : 0;

        const storedProofs = await Storage.getItem(`${walletId}-proofs`);
        const proofs = storedProofs ? JSON.parse(storedProofs) : [];

        const storedBalanceSats = await Storage.getItem(`${walletId}-balance`);
        const balanceSats = storedBalanceSats
            ? JSON.parse(storedBalanceSats)
            : 0;

        const wallet: CashuWallet = await this.startWallet(mintUrl);

        runInAction(() => {
            this.cashuWallets[mintUrl] = {
                wallet,
                walletId,
                counter,
                proofs,
                balanceSats
            };
        });

        return this.cashuWallets[mintUrl];
    };

    @action
    public initializeWallets = async () => {
        this.lndDir = this.settingsStore.lndDir || 'lnd';

        const storedMintUrls = await Storage.getItem(
            `${this.lndDir}-cashu-mintUrls`
        );
        this.mintUrls = storedMintUrls ? JSON.parse(storedMintUrls) : [];

        const storedSelectedMintUrl = await Storage.getItem(
            `${this.lndDir}-cashu-selectedMintUrl`
        );
        this.selectedMintUrl = storedSelectedMintUrl
            ? storedSelectedMintUrl
            : '';

        const storedTotalBalanceSats = await Storage.getItem(
            `${this.lndDir}-cashu-totalBalanceSats`
        );
        this.totalBalanceSats = storedTotalBalanceSats
            ? JSON.parse(storedTotalBalanceSats)
            : 0;

        const storedInvoices = await Storage.getItem(
            `${this.lndDir}-cashu-invoices`
        );
        this.invoices = storedInvoices
            ? JSON.parse(storedInvoices).map(
                  (invoice: any) => new CashuInvoice(invoice)
              )
            : [];

        for (let i = 0; i < this.mintUrls.length; i++) {
            const mintUrl = this.mintUrls[i];
            runInAction(() => {
                this.loading_msg = `Initializing ecash wallet for ${mintUrl}`;
            });
            await new Promise(async (resolve) => {
                const wallet = await this.initializeWallet(mintUrl);
                resolve(wallet);
            });
        }

        runInAction(() => {
            this.loading_msg = undefined;
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
        this.payment_request = undefined;
        this.creatingInvoice = true;
        this.creatingInvoiceError = false;
        this.error_msg = undefined;

        try {
            const mintQuote = await this.cashuWallets[
                this.selectedMintUrl
            ].wallet.createMintQuote(value ? Number(value) : 0, memo);

            let invoice: any;
            if (mintQuote) {
                this.quoteId = mintQuote?.quote;
                invoice = new CashuInvoice({
                    ...mintQuote,
                    mintUrl:
                        this.cashuWallets[this.selectedMintUrl].wallet.mint
                            .mintUrl
                });
                this.invoices?.push(invoice);
                await Storage.setItem(
                    `${this.lndDir}-cashu-invoices`,
                    this.invoices
                );
            }

            runInAction(() => {
                this.payment_request = invoice?.getPaymentRequest;
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
        selectedMintUrl?: string
    ) => {
        const mintUrl = selectedMintUrl || this.selectedMintUrl;
        const quote = await this.cashuWallets[mintUrl].wallet?.checkMintQuote(
            quoteId || this.quoteId || ''
        );

        const updatedInvoice = new CashuInvoice({
            ...quote,
            mintUrl
        });

        const amtSat = updatedInvoice.getAmount;

        const paymentRequest = this.payment_request || '';
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
                    ].wallet.mintProofs(amtSat, quoteId || this.quoteId || '', {
                        counter
                    });
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
                        .plus(1)
                        .toNumber();
                    // update proofs, counter, balance
                    this.cashuWallets[mintUrl].proofs.push(...newProofs);
                    await Storage.setItem(
                        `${this.cashuWallets[mintUrl].walletId}-proofs`,
                        this.cashuWallets[mintUrl].proofs
                    );
                    await Storage.setItem(
                        `${this.cashuWallets[mintUrl].walletId}-counter`,
                        newCounter
                    );
                    await Storage.setItem(
                        `${this.lndDir}-cashu-totalBalanceSats`,
                        totalBalanceSats
                    );
                    await Storage.setItem(
                        `${this.cashuWallets[mintUrl].walletId}-balance`,
                        balanceSats
                    );
                    this.totalBalanceSats = totalBalanceSats;
                    this.cashuWallets[mintUrl].balanceSats = balanceSats;
                    this.cashuWallets[mintUrl].counter = newCounter;
                    // delete old instance of invoice
                    this.invoices = this.invoices?.filter(
                        (item) => item.quote !== quote.quote
                    );
                    // save new instance of invoice
                    this.invoices?.push(updatedInvoice);
                    await Storage.setItem(
                        `${this.lndDir}-cashu-invoices`,
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
    public restoreMintProofs = async (mintURL: string) => {
        try {
            this.restorationProgress = 0;

            console.log(RESTORE_PROOFS_EVENT_NAME, 'Loading mint keysets...');

            const mint = this.cashuWallets[mintURL].wallet.mint;
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
                    await this.setMintCounter(mintURL, count + 1);
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

            const seedPhrase = this.settingsStore.seedPhrase;
            const mnemonic = seedPhrase.join(' ');
            const seed = bip39.mnemonicToSeedSync(mnemonic);

            const mintInfo = await mint.getInfo();

            const wallet = new CashuWallet(mint, {
                bip39seed: new Uint8Array(seed),
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
}
