import { action, observable } from 'mobx';
import EncryptedStorage from 'react-native-encrypted-storage';

import SettingsStore from './SettingsStore';

import BackendUtils from '../utils/BackendUtils';

import Account from '../models/Account';
import Utxo from '../models/Utxo';

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
            const hiddenString = await EncryptedStorage.getItem(
                'hidden-accounts'
            );
            hiddenAccounts = JSON.parse(hiddenString || '[]');

            if (!hiddenAccounts.includes(name)) hiddenAccounts.push(name);

            await EncryptedStorage.setItem(
                'hidden-accounts',
                JSON.stringify(hiddenAccounts)
            );

            this.listAccounts();
        } catch (error) {
            console.log('Error loading hidden account list:', error);
        }
    };
    @action
    public unhideAccount = async (name: string) => {
        let hiddenAccounts: Array<string> = [];
        try {
            const hiddenString = await EncryptedStorage.getItem(
                'hidden-accounts'
            );
            hiddenAccounts = JSON.parse(hiddenString || '[]');

            if (hiddenAccounts.includes(name)) {
                hiddenAccounts = hiddenAccounts.filter((item) => item !== name);
            }

            await EncryptedStorage.setItem(
                'hidden-accounts',
                JSON.stringify(hiddenAccounts)
            );

            this.listAccounts();
        } catch (error) {
            console.log('Error loading hidden account list:', error);
        }
    };

    @action
    public listAccounts = async (data?: any) => {
        let hiddenAccounts: Array<string> = [];
        try {
            const hiddenString = await EncryptedStorage.getItem(
                'hidden-accounts'
            );
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
                this.loadingAccounts = false;
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

        return BackendUtils.importAccount(data)
            .then((response: any) => {
                this.importingAccount = false;
                this.error = false;
                if (response === this.accountToImport && !data.dry_run) {
                    this.success = true;
                    return;
                } else {
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
                this.getUtxosError();
            });
    };
}
