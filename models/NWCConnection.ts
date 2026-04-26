import { action, computed, observable } from 'mobx';
import type { Nip47SingleMethod } from '@getalby/sdk/dist/nwc/types';
import { localeString } from '../utils/LocaleUtils';

import BaseModel from './BaseModel';

import { Implementations } from '../stores/SettingsStore';

import Invoice from './Invoice';
import CashuInvoice from './CashuInvoice';
import Payment from './Payment';
import CashuPayment from './CashuPayment';
import NostrConnectUtils from '../utils/NostrConnectUtils';

export type ConnectionActivityType = 'pay_invoice' | 'make_invoice';

export type ConnectionPaymentSourceType = 'lightning' | 'cashu';

export enum PermissionType {
    FullAccess = 'full_access',
    ReadOnly = 'read_only',
    Custom = 'custom'
}
export interface ConnectionActivity {
    id: string; // lightning invoice
    type: ConnectionActivityType;
    payment_source: ConnectionPaymentSourceType;
    status: 'success' | 'pending' | 'failed';
    payment?: Payment | CashuPayment | null;
    invoice?: Invoice | CashuInvoice | null;
    error?: string;
    preimage?: string;
    paymentHash?: string;
    msatAmount?: number;
    satAmount?: number;
    createdAt?: Date;
    expiresAt?: Date;
    isExpired?: boolean;
    expiryLabel?: string;
    fees_paid?: number;
}

export enum BudgetRenewalType {
    Never = 'never',
    Daily = 'daily',
    Weekly = 'weekly',
    Monthly = 'monthly',
    Yearly = 'yearly'
}
export enum ConnectionWarningType {
    WalletBalanceLowerThanBudget = 'wallet_balance_lower_than_budget',
    BudgetLimitReached = 'budget_limit_reached'
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
    includeLightningAddress: boolean;
    activity?: ConnectionActivity[];
    metadata?: any;
}
export type StoredNWCConnectionData = Omit<
    NWCConnectionData,
    'includeLightningAddress'
> & {
    includeLightningAddress?: boolean;
};

export const normalizeNWCConnectionData = (
    connection: StoredNWCConnectionData
): NWCConnectionData => {
    // Auto-migrate includeLightningAddress: if lud16 is set in metadata,
    // enable it for existing connections (but only if not explicitly set)
    let includeLightningAddress = connection.includeLightningAddress;
    if (includeLightningAddress === undefined && connection.metadata?.lud16) {
        console.log(
            'Migrating NWC connection to v2 (enabling Lightning Address support)',
            { connectionId: connection.id, connectionName: connection.name }
        );
        includeLightningAddress = true;
    }

    const normalizedData = {
        ...connection,
        includeLightningAddress: includeLightningAddress ?? false
    };

    return normalizedData;
};
export interface ConnectionWarning {
    type: ConnectionWarningType;
    severity: 'info' | 'warning' | 'error';
    translationKey: string;
    metadata?: Record<string, any>;
}
export const WARNING_CONFIG: Record<
    ConnectionWarningType,
    Omit<ConnectionWarning, 'type' | 'metadata'>
> = {
    [ConnectionWarningType.WalletBalanceLowerThanBudget]: {
        severity: 'warning',
        translationKey:
            'views.Settings.NostrWalletConnect.warning.walletBalanceLowerThanBudget'
    },
    [ConnectionWarningType.BudgetLimitReached]: {
        severity: 'warning',
        translationKey:
            'views.Settings.NostrWalletConnect.warning.budgetLimitReached'
    }
};

const BUDGET_RENEWAL_MS = {
    daily: 24 * 60 * 60 * 1000,
    weekly: 7 * 24 * 60 * 60 * 1000,
    monthly: 30 * 24 * 60 * 60 * 1000,
    yearly: 365 * 24 * 60 * 60 * 1000
} as const;

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Prevents unbounded memory growth; retains up to 500 items with FIFO rotation (oldest dropped via shift)
// This balances memory efficiency with sufficient transaction history for user reference.
const MAX_ACTIVITY_ITEMS = 500;

/**
 * NWCConnection represents a Nostr Wallet Connect (NIP-47) connection with optional budget controls.
 *
 * IMPORTANT: Budget limits are enforced with best-effort semantics, NOT atomic guarantees.
 * In concurrent payment scenarios, multiple payments can increment totalSpendSats before
 * observing each other's increases, allowing temporary budget overages. The trackSpending()
 * method implements defense-in-depth clamping, but this does NOT provide hard atomic enforcement.
 *
 * For applications requiring strict budget isolation per payment, implement mutex/locking
 * at the application level before dispatching payments to this connection.
 *
 * @see trackSpending() for race condition documentation
 */
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
    @observable includeLightningAddress: boolean = false;
    @observable metadata?: any;
    @observable activity: ConnectionActivity[] = [];
    @observable private _warningTypes: ConnectionWarningType[] = [];

    constructor(data?: StoredNWCConnectionData) {
        super(data ? normalizeNWCConnectionData(data) : data);

        this.totalSpendSats = Math.floor(Number(this.totalSpendSats || 0));
        this.maxAmountSats =
            this.maxAmountSats !== undefined
                ? Math.floor(Number(this.maxAmountSats))
                : undefined;
        this.normalizeDates();
    }

    private coerceToDate(value: unknown): Date | undefined {
        if (!value) return undefined;
        if (value instanceof Date) return value;
        if (typeof value === 'string') {
            const d = new Date(value);
            return isNaN(d.getTime()) ? undefined : d;
        }
        if (typeof value === 'number') {
            const ms = value < 1_000_000_000_000 ? value * 1000 : value;
            const d = new Date(ms);
            return isNaN(d.getTime()) ? undefined : d;
        }
        return undefined;
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
            const coerced = this.coerceToDate(value);
            if (coerced) {
                (this as any)[field] = coerced;
            }
        });

        if (this.activity && this.activity.length > 0) {
            this.activity = this.activity.map((a: any) => {
                const createdAt = this.coerceToDate(a?.createdAt);
                const expiresAt = this.coerceToDate(a?.expiresAt);
                return {
                    ...a,
                    ...(createdAt ? { createdAt } : {}),
                    ...(expiresAt ? { expiresAt } : {})
                };
            });
        } else if (!this.activity) {
            this.activity = [];
        }
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
    @action
    public addWarning(warningType: ConnectionWarningType): void {
        if (!this._warningTypes.includes(warningType)) {
            this._warningTypes.push(warningType);
        }
    }
    @action
    public removeWarning(warningType: ConnectionWarningType): void {
        const index = this._warningTypes.indexOf(warningType);
        if (index > -1) {
            this._warningTypes.splice(index, 1);
        }
    }
    @action
    public clearWarnings(): void {
        this._warningTypes = [];
    }
    @computed public get warnings(): ConnectionWarning[] {
        return this._warningTypes.map((type) => ({
            type,
            ...WARNING_CONFIG[type],
            metadata: this.getWarningMetadata(type)
        }));
    }
    @computed public get hasWarnings(): boolean {
        return this._warningTypes.length > 0;
    }
    @computed public get hasErrors(): boolean {
        return this.warnings.some((w) => w.severity === 'error');
    }
    @computed public get primaryWarning(): ConnectionWarning | null {
        // Return highest severity warning (error > warning > info)
        const errors = this.warnings.filter((w) => w.severity === 'error');
        if (errors.length > 0) return errors[0];

        const warnings = this.warnings.filter((w) => w.severity === 'warning');
        if (warnings.length > 0) return warnings[0];

        const info = this.warnings.filter((w) => w.severity === 'info');
        if (info.length > 0) return info[0];

        return null;
    }
    private getWarningMetadata(
        warningType: ConnectionWarningType
    ): Record<string, any> | undefined {
        switch (warningType) {
            case ConnectionWarningType.WalletBalanceLowerThanBudget:
                return {
                    maxAmount: this.maxAmountSats
                };
            default:
                return undefined;
        }
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
        let changed = false;
        if (availableBalance !== undefined && this.maxAmountSats) {
            const normalizedAvailable = Math.max(
                0,
                Math.floor(Number(availableBalance))
            );
            if (this.maxAmountSats >= normalizedAvailable) {
                this.addWarning(
                    ConnectionWarningType.WalletBalanceLowerThanBudget
                );
                changed = true;
            } else if (this.maxAmountSats <= normalizedAvailable) {
                this.removeWarning(
                    ConnectionWarningType.WalletBalanceLowerThanBudget
                );
                changed = true;
            }
            if (this.budgetLimitReached) {
                this.addWarning(ConnectionWarningType.BudgetLimitReached);
                changed = true;
            }
        }
        if (!this.needsBudgetReset) {
            return changed;
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
    public trackSpending(amountSats: number): {
        success: boolean;
        errorMessage?: string;
    } {
        this.validateAmount(amountSats);

        // NOTE: Budget enforcement leverages a per-connection mutex at the
        // NostrWalletConnectStore level (`runPayInvoiceSerialized`), which
        // ensures `validateBudgetBeforePayment` and `trackSpending` execute
        // atomically. This guarantees a single payment cannot bypass validation.
        // However, this method MUST remain robust to edge cases:
        // 1. Caller may bypass mutex (bug/logic error)
        // 2. Amount may be inaccurate if multiple paths charge budget
        //
        // Defense-in-depth: if tracking would exceed budget limit, fail the
        // operation instead of silently clamping. This preserves the budget
        // invariant while providing clear error feedback for debugging.
        // Callers should log/monitor any trackSpending failures.
        if (
            this.hasBudgetLimit &&
            this.totalSpendSats + amountSats > (this.maxAmountSats ?? 0)
        ) {
            // Record the overage for telemetry/monitoring
            const totalBeforeAttempt = this.totalSpendSats;
            const remainingBeforeAttempt = Math.max(
                0,
                this.maxAmountSats! - totalBeforeAttempt
            );
            const overage = totalBeforeAttempt + amountSats - this.maxAmountSats!;

            console.warn(
                '[NWCConnection.trackSpending] Budget race detected: concurrent payment would exceed maxAmountSats',
                {
                    connectionId: this.id,
                    connectionName: this.name,
                    totalSpendSatsBefore: totalBeforeAttempt,
                    attemptedAmount: amountSats,
                    maxAmountSats: this.maxAmountSats,
                    remainingBefore: remainingBeforeAttempt,
                    overage
                }
            );

            // Clamp totalSpendSats to preserve invariant for future validation,
            // then return error. This prevents subtle budget-tracking corruption.
            this.totalSpendSats = this.maxAmountSats!;

            return {
                success: false,
                errorMessage: localeString(
                    'views.Settings.NostrWalletConnect.error.paymentExceedsBudget',
                    {
                        amount: amountSats.toString(),
                        remaining: remainingBeforeAttempt.toString()
                    }
                )
            };
        }
        this.totalSpendSats += amountSats;
        return { success: true };
    }

    @action
    public addActivity(item: ConnectionActivity): void {
        // Log warning for payment activities without valid paymentHash
        // per NIP-47 spec. paymentHash should be 64-char hex when present.
        if (item.type && ['pay_invoice', 'make_invoice'].includes(item.type)) {
            if (item.paymentHash && !/^[a-f0-9]{64}$/.test(item.paymentHash)) {
                console.warn(
                    '[NWCConnection.addActivity] Payment activity has invalid paymentHash format',
                    {
                        connectionId: this.id,
                        type: item.type,
                        paymentHash: item.paymentHash
                    }
                );
            }
        }

        if (this.activity.length >= MAX_ACTIVITY_ITEMS) {
            this.activity.shift(); // Remove oldest item
        }
        this.activity.push(item);
    }

    public hasPermission(permission: Nip47SingleMethod): boolean {
        return this.permissions?.includes(permission) || false;
    }
    public hasReadOnlyPermissions(): boolean {
        return (
            this.permissions?.some((permission) =>
                NostrConnectUtils.getReadOnlyPermissions().includes(permission)
            ) ?? false
        );
    }
    public hasPaymentPermissions(): boolean {
        return NostrConnectUtils.hasPaymentPermissions(this.permissions ?? []);
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
