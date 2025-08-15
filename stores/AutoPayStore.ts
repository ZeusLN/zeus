import { action, observable, runInAction } from 'mobx';
import Storage from '../storage';

export const AUTOPAY_TRANSACTIONS_KEY = 'zeus-autopay-transactions-v1';

export default class AutoPayStore {
    @observable public autoPayTransactionIds: Set<string> = new Set();

    constructor() {
        this.loadAutoPayTransactions();
    }

    @action
    public markTransactionAsAutoPay = async (paymentHash: string) => {
        this.autoPayTransactionIds.add(paymentHash);
        await this.saveAutoPayTransactions();
    };

    @action
    public removeAutoPayTransaction = async (paymentHash: string) => {
        this.autoPayTransactionIds.delete(paymentHash);
        await this.saveAutoPayTransactions();
    };

    public isAutoPayTransaction = (paymentHash: string): boolean => {
        return this.autoPayTransactionIds.has(paymentHash);
    };

    public async loadAutoPayTransactions() {
        try {
            const storedTransactions: any = await Storage.getItem(
                AUTOPAY_TRANSACTIONS_KEY
            );
            if (storedTransactions) {
                const transactionArray = JSON.parse(storedTransactions);
                runInAction(() => {
                    this.autoPayTransactionIds = new Set(transactionArray);
                });
            }
        } catch (error) {
            console.error(
                'Error loading auto-pay transactions from storage',
                error
            );
        }
    }

    private saveAutoPayTransactions = async () => {
        try {
            const transactionArray = Array.from(this.autoPayTransactionIds);
            await Storage.setItem(
                AUTOPAY_TRANSACTIONS_KEY,
                JSON.stringify(transactionArray)
            );
        } catch (error) {
            console.error(
                'Error saving auto-pay transactions to storage',
                error
            );
        }
    };

    @action
    public clearAllAutoPayTransactions = async () => {
        this.autoPayTransactionIds.clear();
        await this.saveAutoPayTransactions();
    };
}
