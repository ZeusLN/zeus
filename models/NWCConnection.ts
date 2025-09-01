import { computed } from 'mobx';
import type { Nip47SingleMethod } from '@getalby/sdk/dist/nwc/types';
import { localeString } from '../utils/LocaleUtils';

import BaseModel from './BaseModel';

export type PermissionsType = 'full_access' | 'read_only' | 'custom';
export type BudgetRenewalType =
    | 'never'
    | 'daily'
    | 'weekly'
    | 'monthly'
    | 'yearly';

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
    metadata?: any;

    constructor(data?: NWCConnectionData) {
        super(data);

        this.totalSpendSats = Number(this.totalSpendSats || 0);
        this.maxAmountSats =
            this.maxAmountSats !== undefined
                ? Number(this.maxAmountSats)
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

    public resetBudget(): void {
        this.totalSpendSats = 0;
        this.lastBudgetReset = new Date();
    }

    public addSpending(amountSats: number): void {
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
