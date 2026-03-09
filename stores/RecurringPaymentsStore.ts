import { action, observable, runInAction, reaction } from 'mobx';
import { v4 as uuidv4 } from 'uuid';
import Storage from '../storage';
import RecurringPayment, { RecurrenceInterval, RecurringPaymentModel } from '../models/RecurringPayment';
import BackendUtils from '../utils/BackendUtils';
import AddressUtils from '../utils/AddressUtils';
import { invoicesStore } from './Stores';
import FiatStore from './FiatStore';
import SettingsStore from './SettingsStore';

const RECURRING_PAYMENTS_KEY = 'zeus-recurring-payments';

export default class RecurringPaymentsStore {
    @observable public recurringPayments: RecurringPayment[] = [];
    @observable public loading = false;

    settingsStore: SettingsStore;
    fiatStore: FiatStore;

    constructor(settingsStore: SettingsStore, fiatStore: FiatStore) {
        this.settingsStore = settingsStore;
        this.fiatStore = fiatStore;
        this.loadPayments();
    }

    @action
    public loadPayments = async () => {
        try {
            const data = await Storage.getItem(RECURRING_PAYMENTS_KEY);
            if (data) {
                const parsed = JSON.parse(data);
                runInAction(() => {
                    this.recurringPayments = parsed.map((p: RecurringPaymentModel) => new RecurringPayment(p));
                });
                this.processDuePayments();
            }
        } catch (error) {
            console.error('Failed to load recurring payments:', error);
        }
    };

    @action
    public savePayments = async () => {
        try {
            await Storage.setItem(RECURRING_PAYMENTS_KEY, JSON.stringify(this.recurringPayments));
        } catch (error) {
            console.error('Failed to save recurring payments:', error);
        }
    };

    @action
    public addPayment = async (
        name: string,
        destination: string,
        amount: number,
        currency: string,
        interval: RecurrenceInterval
    ) => {
        const newPayment = new RecurringPayment({
            id: uuidv4(),
            name,
            destination,
            amount,
            currency,
            interval,
            nextPaymentAt: Date.now(), // Due immediately? Or next cycle? Let's say immediately for now or user sets start date. MVP: Immediately/Today.
            active: true,
            createdAt: Date.now()
        });

        runInAction(() => {
            this.recurringPayments.push(newPayment);
        });
        await this.savePayments();
        await this.processDuePayments(); // Check if it needs to run now
    };

    @action
    public removePayment = async (id: string) => {
        runInAction(() => {
            this.recurringPayments = this.recurringPayments.filter(p => p.id !== id);
        });
        await this.savePayments();
    };

    @action
    public togglePayment = async (id: string) => {
        const payment = this.recurringPayments.find(p => p.id === id);
        if (payment) {
            runInAction(() => {
                payment.active = !payment.active;
            });
            await this.savePayments();
        }
    };

    @action
    public processDuePayments = async () => {
        console.log('Checking for due recurring payments...');
        const now = Date.now();

        for (const payment of this.recurringPayments) {
            if (payment.active && payment.nextPaymentAt <= now) {
                await this.executePayment(payment);
            }
        }
    };

    private executePayment = async (payment: RecurringPayment) => {
        try {
            console.log(`Executing recurring payment: ${payment.name}`);

            let satsToPay = payment.amount;

            // Handle Fiat Conversion
            if (payment.currency !== 'SATS' && payment.currency !== 'BTC') {
                // Refresh rates to ensure accuracy
                await this.fiatStore.getFiatRates();
                const rate = this.fiatStore.getRate(false); // Returns formatted string, need raw value logic
                // Since getRate returns string, we need to access internal rates directly or use a better method if available.
                // Checking FiatStore source... it has `fiatRates`.

                const fiatRate = this.fiatStore.fiatRates?.find(r => r.code === payment.currency)?.rate;
                if (fiatRate) {
                    // formula: (amount / rate) * 100_000_000
                    satsToPay = Math.round((payment.amount / fiatRate) * 100_000_000);
                } else {
                    console.warn(`Could not find rate for ${payment.currency}, skipping payment.`);
                    return;
                }
            }

            // Resolve Destination
            let payReq = '';

            if (AddressUtils.isValidLightningAddress(payment.destination)) {
                // Resolve LN Address
                // We can use handleAnything utils or reimplement basic resolution.
                // Re-using logic from handleAnything/AddressUtils is safest but they are UI coupled sometimes.
                // Validating address usually involves network call.

                // Let's use a simplified fetch for LUD-16
                const [username, domain] = payment.destination.split('@');
                const url = `https://${domain}/.well-known/lnurlp/${username}`;
                const resp = await fetch(url);
                const data = await resp.json();

                if (data.status === 'OK' && data.callback) {
                    const callbackUrl = new URL(data.callback);
                    callbackUrl.searchParams.append('amount', (satsToPay * 1000).toString()); // millisats
                    const prResp = await fetch(callbackUrl.toString());
                    const prData = await prResp.json();
                    if (prData.status === 'OK' && prData.pr) {
                        payReq = prData.pr;
                    }
                }
            } else if (AddressUtils.isValidLightningOffer(payment.destination)) {
                // Fetch Invoice from Offer
                const res = await BackendUtils.fetchInvoiceFromOffer(payment.destination, satsToPay);
                if (res.invoice) {
                    payReq = res.invoice;
                }
            }

            if (payReq) {
                // Execute Payment
                await BackendUtils.payLightningInvoice(payReq);

                // Update State
                runInAction(() => {
                    payment.lastPaidAt = Date.now();
                    payment.nextPaymentAt = this.calculateNextPayment(payment.interval, payment.nextPaymentAt);
                });
                await this.savePayments();
                console.log(`Payment executed successfully for ${payment.name}`);
            } else {
                console.warn(`Failed to generate payment request for ${payment.name}`);
            }

        } catch (error) {
            console.error(`Error executing recurring payment ${payment.name}:`, error);
        }
    };

    private calculateNextPayment = (interval: RecurrenceInterval, currentDue: number): number => {
        const date = new Date(currentDue);
        switch (interval) {
            case RecurrenceInterval.DAILY:
                date.setDate(date.getDate() + 1);
                break;
            case RecurrenceInterval.WEEKLY:
                date.setDate(date.getDate() + 7);
                break;
            case RecurrenceInterval.MONTHLY:
                date.setMonth(date.getMonth() + 1);
                break;
            case RecurrenceInterval.YEARLY:
                date.setFullYear(date.getFullYear() + 1);
                break;
        }
        return date.getTime();
    };
}
