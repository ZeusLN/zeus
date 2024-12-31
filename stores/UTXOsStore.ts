import { action, observable } from 'mobx';
import Storage from '../storage';

import SettingsStore from './SettingsStore';

import BackendUtils from '../utils/BackendUtils';

import Account from '../models/Account';
import Utxo from '../models/Utxo';

import { walletrpc } from '../proto/lightning';

export const LEGACY_HIDDEN_ACCOUNTS_KEY = 'hidden-accounts';
export const HIDDEN_ACCOUNTS_KEY = 'zeus-hidden-accounts';

export default class UTXOsStore {
    // utxos
    @observable public loading = false;
    @observable public success = false;
    @observable public error = false;
    @observable public errorMsg: string;
    @observable public utxos: Array<Utxo> = [];
    // accounts
    @observable public loadingAccounts = false;
    @observable public importingAccount = false;
    @observable public accounts: any = [];
    @observable public accountToImport: any | null;
    @observable public start_height?: number;
    @observable public addresses_to_generate: number = 50;
    @observable public addresses_to_generate_progress: number = 1;
    // rescan
    @observable public attemptingRescan = false;
    @observable public rescanErrorMsg: string;
    // addresses
    @observable public loadingAddresses: boolean = false;
    @observable public accountsWithAddresses = [];
    @observable public loadingAddressesError: string = '';
    //
    settingsStore: SettingsStore;

    constructor(settingsStore: SettingsStore) {
        this.settingsStore = settingsStore;
    }

    @action
    public reset = () => {
        this.error = false;
        this.loading = false;
        this.success = false;
        this.loadingAccounts = false;
        this.importingAccount = false;
        this.errorMsg = '';
        this.accounts = [];
        this.accountToImport = null;
        this.utxos = [];
        // addresses
        this.loadingAddresses = false;
        this.accountsWithAddresses = [];
        this.loadingAddressesError = '';
    };

    getUtxosError = () => {
        this.error = true;
        this.loading = false;
        this.utxos = [];
    };

    @action
    public getUTXOs = (data: any) => {
        this.errorMsg = '';
        this.loading = true;

        const request: any = {
            min_confs: 0,
            max_confs: 200000
        };

        if (data && data.account) {
            request.account = data.account;
        }

        BackendUtils.getUTXOs(data)
            .then((data: any) => {
                this.loading = false;
                const utxos = data.utxos || data.outputs;
                this.utxos = utxos.map((utxo: any) => new Utxo(utxo));
                this.error = false;
            })
            .catch((error: any) => {
                // handle error
                this.errorMsg = error.toString();
                this.getUtxosError();
            });
    };

    @action
    public hideAccount = async (name: string) => {
        let hiddenAccounts: Array<string> = [];
        try {
            const hiddenString = await Storage.getItem(HIDDEN_ACCOUNTS_KEY);
            hiddenAccounts = JSON.parse(hiddenString || '[]');

            if (!hiddenAccounts.includes(name)) hiddenAccounts.push(name);

            await Storage.setItem(HIDDEN_ACCOUNTS_KEY, hiddenAccounts);

            this.listAccounts();
        } catch (error) {
            console.log('Error loading hidden account list:', error);
        }
    };
    @action
    public unhideAccount = async (name: string) => {
        let hiddenAccounts: Array<string> = [];
        try {
            const hiddenString = await Storage.getItem(HIDDEN_ACCOUNTS_KEY);
            hiddenAccounts = JSON.parse(hiddenString || '[]');

            if (hiddenAccounts.includes(name)) {
                hiddenAccounts = hiddenAccounts.filter((item) => item !== name);
            }

            await Storage.setItem(HIDDEN_ACCOUNTS_KEY, hiddenAccounts);

            this.listAccounts();
        } catch (error) {
            console.log('Error loading hidden account list:', error);
        }
    };

    @action
    public listAccounts = async (data?: any) => {
        let hiddenAccounts: Array<string> = [];
        try {
            const hiddenString = await Storage.getItem(HIDDEN_ACCOUNTS_KEY);
            if (hiddenString) {
                hiddenAccounts = JSON.parse(hiddenString);
            }
        } catch (error) {
            console.log('Error loading hidden account list:', error);
        }

        this.errorMsg = '';
        this.loadingAccounts = true;
        return BackendUtils.listAccounts(data)
            .then(async (data: any) => {
                const accounts: any = [];
                for (const i in data.accounts) {
                    const account = new Account(data.accounts[i]);
                    const { name } = account;
                    if (name && name !== 'default' && !name.includes('act:')) {
                        await BackendUtils.getBlockchainBalance({
                            account: name
                        })
                            .then((data: any) => {
                                accounts.push({
                                    ...account,
                                    XFP: account.XFP,
                                    balance: data.total_balance,
                                    hidden: hiddenAccounts.includes(name)
                                });

                                return;
                            })
                            .catch((e: Error) => {
                                console.error(
                                    'error fetching account balance',
                                    e
                                );
                                return;
                            });
                    }
                }
                this.accounts = accounts;
                this.loadingAccounts = false;
                this.error = false;
                return this.accounts;
            })
            .catch((error: any) => {
                // handle error
                this.errorMsg = error.toString();
                this.getUtxosError();
            });
    };

    @action
    public importAccount = (data: any) => {
        this.errorMsg = '';
        this.success = false;
        this.importingAccount = true;
        if (data.dry_run) {
            this.start_height = undefined;
            this.addresses_to_generate = 50;
        }

        if (data.birthday_height) {
            this.start_height = data.birthday_height;
        }

        if (data.addresses_to_generate) {
            this.addresses_to_generate_progress = 1;
            this.addresses_to_generate = data.addresses_to_generate || 50;
        }

        if (this.start_height && !data.birthday_height) {
            data.birthday_height = this.start_height;
        }

        console.log('importAccount req', data);

        return BackendUtils.importAccount(data)
            .then(async (response: any) => {
                if (!data.dry_run) {
                    if (this.start_height) {
                        // generate N addresses from account
                        for (let i = 0; i < this.addresses_to_generate; i++) {
                            this.addresses_to_generate_progress = i + 1;
                            await BackendUtils.getNewAddress({
                                account: this.accountToImport.account.name,
                                type: walletrpc.AddressType[
                                    this.accountToImport.account.address_type
                                ]
                            }).then((response: any) => {
                                console.log(
                                    `generated address ${i}`,
                                    response.address
                                );
                            });
                            await BackendUtils.getNewChangeAddress({
                                account: this.accountToImport.account.name,
                                type: walletrpc.AddressType[
                                    this.accountToImport.account.address_type
                                ],
                                change: true
                            }).then((response: any) => {
                                console.log(
                                    `generated change address ${i}`,
                                    response.addr
                                );
                            });
                        }

                        console.log(
                            'Starting rescan at height',
                            this.start_height
                        );

                        BackendUtils.rescan({
                            start_height: this.start_height
                        })
                            .then((response: any) => {
                                console.log('rescan resp', response);
                            })
                            .catch((err: Error) => {
                                console.log('rescan err', err);
                            });
                    }

                    this.importingAccount = false;
                    this.error = false;
                    this.success = true;
                    return;
                } else {
                    this.importingAccount = false;
                    this.error = false;
                    this.accountToImport = response;
                    return this.accountToImport;
                }
            })
            .catch((error: any) => {
                // handle error
                this.errorMsg = error.toString();
                this.success = false;
                this.accountToImport = null;
                this.importingAccount = false;
                this.start_height = undefined;
                this.getUtxosError();
            });
    };

    @action
    public rescan = (blockHeight: number) => {
        this.rescanErrorMsg = '';
        this.attemptingRescan = true;

        return BackendUtils.rescan({
            start_height: blockHeight
        })
            .then((response: any) => {
                console.log('rescan resp', response);
                this.attemptingRescan = false;
                return;
            })
            .catch((err: Error) => {
                console.log('rescan err', err);
                this.attemptingRescan = false;
                this.rescanErrorMsg = err.toString();
                return;
            });
    };

    @action
    public listAddresses = async () => {
        this.loadingAddresses = true;
        this.accountsWithAddresses = [];
        this.loadingAddressesError = '';

        return await new Promise((resolve, reject) => {
            BackendUtils.listAddresses()
                .then((response: any) => {
                    this.accountsWithAddresses =
                        response.account_with_addresses;
                    this.loadingAddresses = false;
                    resolve(this.accountsWithAddresses);
                })
                .catch((err: Error) => {
                    this.loadingAddressesError = err.toString();
                    this.loadingAddresses = false;
                    reject();
                });
        });
    };
}
