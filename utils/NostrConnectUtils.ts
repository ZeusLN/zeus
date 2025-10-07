import { BudgetRenewalType, PermissionsType } from '../models/NWCConnection';
import { localeString } from './LocaleUtils';
import type {
    Nip47NotificationType,
    Nip47SingleMethod
} from '@getalby/sdk/dist/nwc/types';

export interface PermissionOption {
    key: string;
    title: string;
    description: string;
}

export interface BudgetRenewalOption {
    key: BudgetRenewalType;
    title: string;
}

export interface PermissionType {
    key: PermissionsType;
    title: string;
    description: string;
}
export default class NostrConnectUtils {
    static getNotifications(): Nip47NotificationType[] {
        return ['payment_received', 'payment_sent', 'hold_invoice_accepted'];
    }
    static getAvailablePermissions(): PermissionOption[] {
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

    static getPermissionTypes(): PermissionType[] {
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

    static getExpiryPresetButtons(): string[] {
        return [
            localeString('time.1W'),
            localeString('time.1mo'),
            localeString('time.12mo'),
            localeString('models.Invoice.never'),
            localeString('general.custom')
        ];
    }

    static getExpiryPresetIndex(expiryDays?: number): number {
        if (!expiryDays) return 3;
        if (expiryDays === 7) return 0;
        if (expiryDays === 30) return 1;
        if (expiryDays === 365) return 2;
        return 4;
    }

    static getExpiryDaysFromPreset(presetIndex: number): number | undefined {
        switch (presetIndex) {
            case 0:
                return 7;
            case 1:
                return 30;
            case 2:
                return 365;
            case 3:
                return undefined;
            case 4:
                return undefined;
            default:
                return undefined;
        }
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

    static getPermissionDescription(permission: Nip47SingleMethod): string {
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
        const connectionPermissions = permissions.sort();
        const fullAccessSorted =
            NostrConnectUtils.getFullAccessPermissions().sort();
        const readOnlySorted =
            NostrConnectUtils.getReadOnlyPermissions().sort();

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

    static calculateExpiryDays(expiresAt?: Date): string {
        if (!expiresAt) return '';

        const now = new Date();
        const expiry = new Date(expiresAt);
        const diffTime = expiry.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays > 0 ? diffDays.toString() : '';
    }

    static getBudgetRenewalIndex(budgetRenewal?: string): number {
        const options = NostrConnectUtils.getBudgetRenewalOptions();
        const index = options.findIndex(
            (option) => option.key === budgetRenewal
        );
        return index >= 0 ? index : 0;
    }

    static getBudgetPresetIndex(maxAmountSats?: number): number {
        if (!maxAmountSats) return 0;
        if (maxAmountSats === 10000) return 0;
        if (maxAmountSats === 100000) return 1;
        if (maxAmountSats === 1000000) return 2;
        if (maxAmountSats === -1) return 3;
        return 4;
    }
}
