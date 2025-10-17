import type {
    Nip47NotificationType,
    Nip47SingleMethod
} from '@getalby/sdk/dist/nwc/types';

import {
    BudgetRenewalType,
    PermissionsType,
    TimeUnit
} from '../models/NWCConnection';

import { localeString } from './LocaleUtils';

export interface PermissionOption {
    key: PermissionsType;
    title: string;
    description: string;
}

export interface IndividualPermissionOption {
    key: Nip47SingleMethod;
    title: string;
    description: string;
}

export interface BudgetRenewalOption {
    key: BudgetRenewalType;
    title: string;
}

const BUDGET_PRESETS = {
    TEN_K: 10000,
    HUNDRED_K: 100000,
    ONE_MILLION: 1000000,
    UNLIMITED: -1
} as const;

const PRESET_INDEX = {
    FIRST: 0,
    SECOND: 1,
    THIRD: 2,
    NEVER: 3,
    CUSTOM: 4
} as const;

export default class NostrConnectUtils {
    static getNotifications(): Nip47NotificationType[] {
        return ['payment_received', 'payment_sent', 'hold_invoice_accepted'];
    }

    static getAvailablePermissions(): IndividualPermissionOption[] {
        return [
            {
                key: 'get_info',
                title: localeString(
                    'views.Settings.NostrWalletConnect.permissions.getInfo'
                ),
                description: localeString(
                    'views.Settings.NostrWalletConnect.permissions.getInfoDescription'
                )
            },
            {
                key: 'get_balance',
                title: localeString(
                    'views.Settings.NostrWalletConnect.permissions.getBalance'
                ),
                description: localeString(
                    'views.Settings.NostrWalletConnect.permissions.getBalanceDescription'
                )
            },
            {
                key: 'pay_invoice',
                title: localeString(
                    'views.Settings.NostrWalletConnect.permissions.payInvoice'
                ),
                description: localeString(
                    'views.Settings.NostrWalletConnect.permissions.payInvoiceDescription'
                )
            },
            {
                key: 'make_invoice',
                title: localeString(
                    'views.Settings.NostrWalletConnect.permissions.makeInvoice'
                ),
                description: localeString(
                    'views.Settings.NostrWalletConnect.permissions.makeInvoiceDescription'
                )
            },
            {
                key: 'lookup_invoice',
                title: localeString(
                    'views.Settings.NostrWalletConnect.permissions.lookupInvoice'
                ),
                description: localeString(
                    'views.Settings.NostrWalletConnect.permissions.lookupInvoiceDescription'
                )
            },
            {
                key: 'list_transactions',
                title: localeString(
                    'views.Settings.NostrWalletConnect.permissions.listTransactions'
                ),
                description: localeString(
                    'views.Settings.NostrWalletConnect.permissions.listTransactionsDescription'
                )
            },
            {
                key: 'pay_keysend',
                title: localeString(
                    'views.Settings.NostrWalletConnect.permissions.payKeysend'
                ),
                description: localeString(
                    'views.Settings.NostrWalletConnect.permissions.payKeysendDescription'
                )
            }
        ];
    }

    static getBudgetRenewalOptions(): BudgetRenewalOption[] {
        return [
            {
                key: 'never',
                title: localeString('models.Invoice.never')
            },
            {
                key: 'daily',
                title: localeString(
                    'views.Settings.NostrWalletConnect.budgetRenewal.daily'
                )
            },
            {
                key: 'weekly',
                title: localeString(
                    'views.Settings.NostrWalletConnect.budgetRenewal.weekly'
                )
            },
            {
                key: 'monthly',
                title: localeString(
                    'views.Settings.NostrWalletConnect.budgetRenewal.monthly'
                )
            },
            {
                key: 'yearly',
                title: localeString(
                    'views.Settings.NostrWalletConnect.budgetRenewal.yearly'
                )
            }
        ];
    }

    static getPermissionTypes(): PermissionOption[] {
        return [
            {
                key: 'full_access',
                title: localeString(
                    'views.Settings.NostrWalletConnect.fullAccess'
                ),
                description: localeString(
                    'views.Settings.NostrWalletConnect.fullAccessDescription'
                )
            },
            {
                key: 'read_only',
                title: localeString(
                    'views.Settings.NostrWalletConnect.readOnly'
                ),
                description: localeString(
                    'views.Settings.NostrWalletConnect.readOnlyDescription'
                )
            },
            {
                key: 'custom',
                title: localeString('views.Settings.NostrWalletConnect.custom'),
                description: localeString(
                    'views.Settings.NostrWalletConnect.customDescription'
                )
            }
        ];
    }

    static getBudgetPresetButtons(): string[] {
        return [
            '10K',
            '100K',
            '1M',
            localeString('views.Settings.NostrWalletConnect.unlimited'),
            localeString('general.custom')
        ];
    }

    static getBudgetPresetIndex(maxAmountSats?: number): number {
        if (!maxAmountSats) return PRESET_INDEX.FIRST;
        if (maxAmountSats === BUDGET_PRESETS.TEN_K) return PRESET_INDEX.FIRST;
        if (maxAmountSats === BUDGET_PRESETS.HUNDRED_K)
            return PRESET_INDEX.SECOND;
        if (maxAmountSats === BUDGET_PRESETS.ONE_MILLION)
            return PRESET_INDEX.THIRD;
        if (maxAmountSats === BUDGET_PRESETS.UNLIMITED)
            return PRESET_INDEX.NEVER;
        return PRESET_INDEX.CUSTOM;
    }

    static getExpiryPresetButtons(): string[] {
        return [
            localeString('time.1W'),
            localeString('time.1mo'),
            localeString('time.12mo'),
            localeString('models.Invoice.never'),
            localeString('general.custom')
        ];
    }

    static getExpiryPresetIndex(expiryAt?: Date): number {
        const expiryDays =
            NostrConnectUtils.calculateExpiryDays(expiryAt)?.toString();
        if (!expiryDays) return PRESET_INDEX.NEVER;
        if (expiryDays === '7') return PRESET_INDEX.FIRST;
        if (expiryDays === '30') return PRESET_INDEX.SECOND;
        if (expiryDays === '365') return PRESET_INDEX.THIRD;
        return PRESET_INDEX.CUSTOM;
    }

    static getExpiryDateFromPreset(
        presetIndex: number,
        customExpiryValue?: number,
        customExpiryUnit?: TimeUnit
    ): Date {
        const now = new Date();
        switch (presetIndex) {
            case PRESET_INDEX.FIRST:
                return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            case PRESET_INDEX.SECOND:
                return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            case PRESET_INDEX.THIRD:
                return new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
            case PRESET_INDEX.NEVER:
                return new Date(now.getTime() + 1000 * 60 * 60 * 24 * 365);
            case PRESET_INDEX.CUSTOM:
                if (customExpiryValue && customExpiryUnit) {
                    return NostrConnectUtils.calculateCustomExpiryDate(
                        customExpiryValue,
                        customExpiryUnit
                    );
                }
                return new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
            default:
                return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        }
    }

    static calculateCustomExpiryDate(value: number, unit: TimeUnit): Date {
        const now = new Date();
        const unitLower = unit.toLowerCase();

        if (unitLower.includes('hours')) {
            return new Date(now.getTime() + value * 60 * 60 * 1000);
        } else if (unitLower.includes('days')) {
            return new Date(now.getTime() + value * 24 * 60 * 60 * 1000);
        } else if (unitLower.includes('weeks')) {
            return new Date(now.getTime() + value * 7 * 24 * 60 * 60 * 1000);
        } else if (unitLower.includes('months')) {
            const newDate = new Date(now);
            newDate.setMonth(newDate.getMonth() + value);
            return newDate;
        } else if (unitLower.includes('years')) {
            const newDate = new Date(now);
            newDate.setFullYear(newDate.getFullYear() + value);
            return newDate;
        }

        return new Date(now.getTime() + value * 24 * 60 * 60 * 1000);
    }

    static calculateExpiryDays(expiresAt?: Date): string {
        if (!expiresAt) return '';

        const now = new Date();
        const expiry = new Date(expiresAt);
        const diffTime = expiry.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        return diffDays > 0 ? diffDays.toString() : '';
    }

    static getFullAccessPermissions(): Nip47SingleMethod[] {
        return [
            'get_info',
            'get_balance',
            'pay_invoice',
            'make_invoice',
            'lookup_invoice',
            'list_transactions',
            'pay_keysend',
            'sign_message'
        ];
    }

    static getReadOnlyPermissions(): Nip47SingleMethod[] {
        return [
            'get_info',
            'get_balance',
            'make_invoice',
            'lookup_invoice',
            'list_transactions'
        ];
    }

    static getPermissionShortDescription(
        permission: Nip47SingleMethod
    ): string {
        const descriptions: { [key: string]: string } = {
            get_info: localeString(
                'views.Settings.NostrWalletConnect.permissions.getInfoShort'
            ),
            get_balance: localeString(
                'views.Settings.NostrWalletConnect.permissions.getBalanceShort'
            ),
            pay_invoice: localeString(
                'views.Settings.NostrWalletConnect.permissions.payInvoiceShort'
            ),
            make_invoice: localeString(
                'views.Settings.NostrWalletConnect.permissions.makeInvoiceShort'
            ),
            lookup_invoice: localeString(
                'views.Settings.NostrWalletConnect.permissions.lookupInvoiceShort'
            ),
            list_transactions: localeString(
                'views.Settings.NostrWalletConnect.permissions.listTransactionsShort'
            ),
            pay_keysend: localeString(
                'views.Settings.NostrWalletConnect.permissions.payKeysendShort'
            )
        };
        return descriptions[permission] || permission.replace(/_/g, ' ');
    }

    static getPermissionsForType(
        permissionType: PermissionsType,
        currentPermissions: Nip47SingleMethod[] = []
    ): { permissions: string[] } {
        switch (permissionType) {
            case 'full_access':
                return {
                    permissions: NostrConnectUtils.getFullAccessPermissions()
                };
            case 'read_only':
                return {
                    permissions: NostrConnectUtils.getReadOnlyPermissions()
                };
            case 'custom':
                return {
                    permissions: currentPermissions
                };
            default:
                return {
                    permissions: []
                };
        }
    }

    static determinePermissionType(
        permissions: Nip47SingleMethod[]
    ): PermissionsType {
        const connectionPermissions = permissions.slice().sort();
        const fullAccessSorted = NostrConnectUtils.getFullAccessPermissions()
            .slice()
            .sort();
        const readOnlySorted = NostrConnectUtils.getReadOnlyPermissions()
            .slice()
            .sort();
        if (
            JSON.stringify(connectionPermissions) ===
            JSON.stringify(fullAccessSorted)
        ) {
            return 'full_access';
        } else if (
            JSON.stringify(connectionPermissions) ===
            JSON.stringify(readOnlySorted)
        ) {
            return 'read_only';
        }
        return 'custom';
    }

    static getBudgetRenewalIndex(budgetRenewal?: string): number {
        const options = NostrConnectUtils.getBudgetRenewalOptions();
        const index = options.findIndex(
            (option) => option.key === budgetRenewal
        );
        return index >= 0 ? index : 0;
    }
}
