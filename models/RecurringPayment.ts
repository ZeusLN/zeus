
export enum RecurrenceInterval {
    DAILY = 'DAILY',
    WEEKLY = 'WEEKLY',
    MONTHLY = 'MONTHLY',
    YEARLY = 'YEARLY'
}

export interface RecurringPaymentModel {
    id: string;
    name: string;
    destination: string; // LN Address or BOLT12 Offer
    amount: number;
    currency: string; // 'SATS' or Fiat Code (e.g. 'USD')
    interval: RecurrenceInterval;
    lastPaidAt?: number;
    nextPaymentAt: number;
    active: boolean;
    createdAt: number;
}

export default class RecurringPayment implements RecurringPaymentModel {
    id: string;
    name: string;
    destination: string;
    amount: number;
    currency: string;
    interval: RecurrenceInterval;
    lastPaidAt?: number;
    nextPaymentAt: number;
    active: boolean;
    createdAt: number;

    constructor(data: RecurringPaymentModel) {
        this.id = data.id;
        this.name = data.name;
        this.destination = data.destination;
        this.amount = data.amount;
        this.currency = data.currency;
        this.interval = data.interval;
        this.lastPaidAt = data.lastPaidAt;
        this.nextPaymentAt = data.nextPaymentAt;
        this.active = data.active;
        this.createdAt = data.createdAt;
    }
}
