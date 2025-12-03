import { action, computed, observable } from 'mobx';
import type { Nip47SingleMethod } from '@getalby/sdk/dist/nwc/types';
import { localeString } from '../utils/LocaleUtils';

import BaseModel from './BaseModel';

import { Implementations } from '../stores/SettingsStore';

export enum PermissionType {
    FullAccess = 'full_access',
    ReadOnly = 'read_only',
    Custom = 'custom'
}

export enum BudgetRenewalType {
    Never = 'never',
    Daily = 'daily',
    Weekly = 'weekly',
    Monthly = 'monthly',
    Yearly = 'yearly'
}

export type TimeUnit = 'Hours' | 'Days' | 'Weeks' | 'Months' | 'Years';
export interface NWCConnectionData {
    id: string;
    name: string;
    icon?: any;
    description?: string;
    pubkey: string;
    relayUrl: string;
    permissions: Nip47SingleMethod[];
    createdAt: Date;
    lastUsed?: Date;
    totalSpendSats: number;
    maxAmountSats?: number;
    budgetRenewal?: BudgetRenewalType;
    expiresAt?: Date;
    lastBudgetReset?: Date;
    customExpiryValue?: number;
    customExpiryUnit?: TimeUnit;
    nodePubkey: string;
    implementation: string;
    metadata?: any;
}

const BUDGET_RENEWAL_MS = {
    daily: 24 * 60 * 60 * 1000,
    weekly: 7 * 24 * 60 * 60 * 1000,
    monthly: 30 * 24 * 60 * 60 * 1000,
    yearly: 365 * 24 * 60 * 60 * 1000
} as const;

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export default class NWCConnection extends BaseModel {
    id: string;
    @observable name: string;
    @observable icon?: any;
    @observable description?: string;
    pubkey: string;
    relayUrl: string;
    @observable permissions: Nip47SingleMethod[];
    createdAt: Date;
    @observable lastUsed?: Date;
    @observable totalSpendSats: number;
    @observable maxAmountSats?: number;
    @observable budgetRenewal?: BudgetRenewalType;
    @observable expiresAt?: Date;
    @observable lastBudgetReset?: Date;
    @observable customExpiryValue?: number;
    @observable customExpiryUnit?: TimeUnit;
    @observable nodePubkey: string;
    @observable implementation: Implementations;
    @observable metadata?: any;

    constructor(data?: NWCConnectionData) {
        super(data);

        this.totalSpendSats = Math.floor(Number(this.totalSpendSats || 0));
        this.maxAmountSats =
            this.maxAmountSats !== undefined
                ? Math.floor(Number(this.maxAmountSats))
                : undefined;

        this.normalizeDates();
    }

    private normalizeDates(): void {
        const dateFields = [
            'createdAt',
            'lastUsed',
            'expiresAt',
            'lastBudgetReset'
        ] as const;

        dateFields.forEach((field) => {
            const value = (this as any)[field];
            if (value && typeof value === 'string') {
                (this as any)[field] = new Date(value);
            }
        });
    }
    @computed public get isExpired(): boolean {
        return this.expiresAt ? new Date() > this.expiresAt : false;
    }
    @computed public get statusText(): string {
        return this.isExpired
            ? localeString('channel.expirationStatus.expired')
            : localeString('general.active');
    }
    @computed public get hasRecentActivity(): boolean {
        if (!this.lastUsed) return false;

        const dayAgo = new Date(Date.now() - ONE_DAY_MS);
        return this.lastUsed > dayAgo;
    }

    @computed public get hasBudgetLimit(): boolean {
        return !!(this.maxAmountSats && this.maxAmountSats > 0);
    }

    @computed public get budgetLimitReached(): boolean {
        return (
            this.hasBudgetLimit && this.totalSpendSats >= this.maxAmountSats!
        );
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
        // If no last reset, needs reset
        if (!this.lastBudgetReset) {
            return true;
        }
        const timeDiff = Date.now() - this.lastBudgetReset.getTime();
        const renewalMs = BUDGET_RENEWAL_MS[this.budgetRenewal];

        return timeDiff >= renewalMs;
    }

    @computed public get isActive(): boolean {
        return !this.isExpired;
    }

    @computed public get displayName(): string {
        return this.name || this.pubkey.slice(0, 8) + '...';
    }

    @computed public get permissionsCount(): number {
        return this.permissions?.length || 0;
    }

    public canSpend(amountSats: number): boolean {
        if (!this.hasBudgetLimit) return true;
        return this.totalSpendSats + amountSats <= this.maxAmountSats!;
    }

    @action
    public resetBudget(): void {
        this.totalSpendSats = 0;
        this.lastBudgetReset = new Date();
    }

    @action
    public checkAndResetBudgetIfNeeded(availableBalance?: number): boolean {
        if (availableBalance !== undefined && this.maxAmountSats) {
            if (this.maxAmountSats > availableBalance) {
                this.maxAmountSats = availableBalance;
                return false;
            }
        }
        if (!this.needsBudgetReset) {
            return false;
        }
        this.resetBudget();
        return true;
    }

    private validateAmount(amountSats: number): void {
        if (!Number.isInteger(amountSats) || amountSats < 0) {
            throw new Error(
                localeString(
                    'views.Settings.NostrWalletConnect.error.invalidAmount'
                )
            );
        }
    }
    @action
    public validateBudgetBeforePayment(amountSats: number): {
        success: boolean;
        errorMessage?: string;
    } {
        this.validateAmount(amountSats);

        if (this.isExpired) {
            return {
                success: false,
                errorMessage: localeString(
                    'views.Settings.NostrWalletConnect.error.connectionExpired'
                )
            };
        }

        this.checkAndResetBudgetIfNeeded();

        if (this.hasBudgetLimit && !this.canSpend(amountSats)) {
            return {
                success: false,
                errorMessage: localeString(
                    'views.Settings.NostrWalletConnect.error.paymentExceedsBudget',
                    {
                        amount: amountSats.toString(),
                        remaining: this.remainingBudget.toString()
                    }
                )
            };
        }
        return {
            success: true
        };
    }

    @action
    public trackSpending(amountSats: number): void {
        this.validateAmount(amountSats);
        this.totalSpendSats += amountSats;
    }

    public hasPermission(permission: Nip47SingleMethod): boolean {
        return this.permissions?.includes(permission) || false;
    }
    public getDaysUntilExpiry(): number | null {
        if (!this.expiresAt) return null;
        const now = new Date();
        const timeDiff = this.expiresAt.getTime() - now.getTime();
        return Math.ceil(timeDiff / ONE_DAY_MS);
    }
    public getDaysSinceLastUsed(): number | null {
        if (!this.lastUsed) return null;

        const now = new Date();
        const timeDiff = now.getTime() - this.lastUsed.getTime();
        return Math.floor(timeDiff / ONE_DAY_MS);
    }
}
