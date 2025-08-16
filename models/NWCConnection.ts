import { computed } from 'mobx';
import type { Nip47SingleMethod } from '@getalby/sdk/dist/nwc/types';
import BaseModel from './BaseModel';

export interface NWCConnectionData {
    id: string;
    name: string;
    icon?: any;
    description?: string;
    pubkey: string;
    permissions: string[];
    createdAt: Date;
    lastUsed?: Date;
    isolated?: boolean;
    totalSpendSats: number;
    maxAmountSats?: number;
    budgetRenewal?: 'never' | 'daily' | 'weekly' | 'monthly' | 'yearly';
    expiresAt?: Date;
    lastBudgetReset?: Date;
    metadata?: any;
}

export default class NWCConnection extends BaseModel {
    id: string;
    name: string;
    icon?: any;
    description?: string;
    pubkey: string;
    permissions: Nip47SingleMethod[];
    createdAt: Date;
    lastUsed?: Date;
    isolated?: boolean;
    totalSpendSats: number;
    maxAmountSats?: number;
    budgetRenewal?: 'never' | 'daily' | 'weekly' | 'monthly' | 'yearly';
    expiresAt?: Date;
    lastBudgetReset?: Date;
    metadata?: any;

    constructor(data?: NWCConnectionData) {
        super(data);

        if (this.totalSpendSats === undefined) {
            this.totalSpendSats = 0;
        } else {
            this.totalSpendSats = Number(this.totalSpendSats);
        }

        if (this.createdAt && typeof this.createdAt === 'string') {
            this.createdAt = new Date(this.createdAt);
        }
        if (this.lastUsed && typeof this.lastUsed === 'string') {
            this.lastUsed = new Date(this.lastUsed);
        }
        if (this.expiresAt && typeof this.expiresAt === 'string') {
            this.expiresAt = new Date(this.expiresAt);
        }
        if (this.lastBudgetReset && typeof this.lastBudgetReset === 'string') {
            this.lastBudgetReset = new Date(this.lastBudgetReset);
        }
        if (this.maxAmountSats !== undefined) {
            this.maxAmountSats = Number(this.maxAmountSats);
        }
    }
    @computed public get isExpired(): boolean {
        if (!this.expiresAt) return false;
        return new Date() > this.expiresAt;
    }

    @computed public get statusText(): string {
        if (this.isExpired) return 'Expired';
        return 'Active';
    }

    @computed public get hasRecentActivity(): boolean {
        if (!this.lastUsed) return false;
        const dayAgo = new Date();
        dayAgo.setDate(dayAgo.getDate() - 1);
        return this.lastUsed > dayAgo;
    }

    @computed public get hasBudgetLimit(): boolean {
        return !!(this.maxAmountSats && this.maxAmountSats > 0);
    }

    @computed public get budgetLimitReached(): boolean {
        if (!this.hasBudgetLimit) return false;
        return this.totalSpendSats >= this.maxAmountSats!;
    }

    @computed public get remainingBudget(): number {
        if (!this.hasBudgetLimit) return Infinity;
        return Math.max(0, this.maxAmountSats! - this.totalSpendSats);
    }

    @computed public get budgetUsagePercentage(): number {
        if (!this.hasBudgetLimit) return 0;
        return Math.min(100, (this.totalSpendSats / this.maxAmountSats!) * 100);
    }

    @computed public get needsBudgetReset(): boolean {
        if (
            !this.hasBudgetLimit ||
            !this.budgetRenewal ||
            this.budgetRenewal === 'never'
        ) {
            return false;
        }

        if (!this.lastBudgetReset) {
            return true; // First time, needs reset
        }

        const now = new Date();
        const lastReset = this.lastBudgetReset;

        switch (this.budgetRenewal) {
            case 'daily':
                const oneDayAgo = new Date(now);
                oneDayAgo.setDate(oneDayAgo.getDate() - 1);
                return lastReset <= oneDayAgo;

            case 'weekly':
                const oneWeekAgo = new Date(now);
                oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                return lastReset <= oneWeekAgo;

            case 'monthly':
                const oneMonthAgo = new Date(now);
                oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
                return lastReset <= oneMonthAgo;

            case 'yearly':
                const oneYearAgo = new Date(now);
                oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
                return lastReset <= oneYearAgo;

            default:
                return false;
        }
    }

    public canSpend(amountSats: number): boolean {
        if (!this.hasBudgetLimit) return true;
        return this.totalSpendSats + amountSats <= this.maxAmountSats!;
    }

    public resetBudget(): void {
        this.totalSpendSats = 0;
        this.lastBudgetReset = new Date();
    }
}
