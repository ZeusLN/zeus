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

    @action
    public addMint = async (mintUrl: string) => {
        this.loading = true;
        const newMintUrls = this.mintUrls;
        newMintUrls.push(mintUrl);
        await Storage.setItem(`${this.lndDir}-cashu-mintUrls`, this.mintUrls);
        await this.initializeWallet(mintUrl);
        runInAction(() => {
            this.mintUrls = newMintUrls;
            this.loading = false;
        });
    };

    @action
    public initializeWallet = async (mintUrl: string) => {
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
            keysets,
            keys
        });

        // persist wallet.keys and wallet.keysets to avoid calling loadMint() in the future
        await wallet.loadMint();
        await wallet.getKeys();

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
        this.mintUrls = storedMintUrls
            ? JSON.parse(storedMintUrls)
            : ['https://mint.minibits.cash/Bitcoin'];

        const storedSelectedMintUrl = await Storage.getItem(
            `${this.lndDir}-cashu-selectedMintUrl`
        );
        this.selectedMintUrl = storedSelectedMintUrl
            ? storedSelectedMintUrl
            : 'https://mint.minibits.cash/Bitcoin';

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

        this.mintUrls.forEach(async (mintUrl) => {
            await this.initializeWallet(mintUrl);
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
}
