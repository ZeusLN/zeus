import { localeString } from './LocaleUtils';
import type { Nip47SingleMethod } from '@getalby/sdk/dist/nwc/types';

export interface PermissionOption {
    key: string;
    title: string;
    description: string;
}

export type BudgetRenewalType =
    | 'never'
    | 'daily'
    | 'weekly'
    | 'monthly'
    | 'yearly';

export interface BudgetRenewalOption {
    key: BudgetRenewalType;
    title: string;
}

export type PermissionsType =
    | 'full_access'
    | 'read_only'
    | 'isolated'
    | 'custom';

export interface PermissionType {
    key: PermissionsType;
    title: string;
    description: string;
}

export const getAvailablePermissions = (): PermissionOption[] => [
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

export const getBudgetRenewalOptions = (): BudgetRenewalOption[] => [
    {
        key: 'never',
        title: localeString(
            'views.Settings.NostrWalletConnect.budgetRenewal.never'
        )
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

export const getPermissionTypes = (): PermissionType[] => [
    {
        key: 'full_access',
        title: localeString('views.Settings.NostrWalletConnect.fullAccess'),
        description: localeString(
            'views.Settings.NostrWalletConnect.fullAccessDescription'
        )
    },
    {
        key: 'read_only',
        title: localeString('views.Settings.NostrWalletConnect.readOnly'),
        description: localeString(
            'views.Settings.NostrWalletConnect.readOnlyDescription'
        )
    },
    {
        key: 'isolated',
        title: localeString('views.Settings.NostrWalletConnect.isolated'),
        description: localeString(
            'views.Settings.NostrWalletConnect.isolatedDescription'
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

export const getFullAccessPermissions = (): Nip47SingleMethod[] => [
    'get_info',
    'get_balance',
    'pay_invoice',
    'make_invoice',
    'lookup_invoice',
    'list_transactions',
    'pay_keysend',
    'sign_message'
];

export const getReadOnlyPermissions = (): string[] => [
    'get_info',
    'get_balance',
    'make_invoice',
    'lookup_invoice',
    'list_transactions'
];

export const getPermissionDescription = (
    permission: Nip47SingleMethod
): string => {
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
};

export const getPermissionsForType = (
    permissionType: 'full_access' | 'read_only' | 'isolated' | 'custom',
    currentPermissions: Nip47SingleMethod[] = []
): { permissions: string[]; isIsolated: boolean } => {
    switch (permissionType) {
        case 'full_access':
            return {
                permissions: getFullAccessPermissions(),
                isIsolated: false
            };
        case 'read_only':
            return {
                permissions: getReadOnlyPermissions(),
                isIsolated: false
            };
        case 'isolated':
            return {
                permissions: getReadOnlyPermissions(),
                isIsolated: true
            };
        case 'custom':
            return {
                permissions: currentPermissions,
                isIsolated: false
            };
        default:
            return {
                permissions: [],
                isIsolated: false
            };
    }
};

export const determinePermissionType = (
    permissions: string[],
    isIsolated: boolean = false
): 'full_access' | 'read_only' | 'isolated' | 'custom' => {
    const connectionPermissions = permissions.sort();
    const fullAccessSorted = getFullAccessPermissions().sort();
    const readOnlySorted = getReadOnlyPermissions().sort();

    if (
        JSON.stringify(connectionPermissions) ===
        JSON.stringify(fullAccessSorted)
    ) {
        return 'full_access';
    } else if (
        JSON.stringify(connectionPermissions) === JSON.stringify(readOnlySorted)
    ) {
        return isIsolated ? 'isolated' : 'read_only';
    } else {
        return 'custom';
    }
};

export const calculateExpiryDays = (expiresAt?: Date): string => {
    if (!expiresAt) return '';

    const now = new Date();
    const expiry = new Date(expiresAt);
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays.toString() : '';
};

export const getBudgetRenewalIndex = (budgetRenewal?: string): number => {
    const options = getBudgetRenewalOptions();
    const index = options.findIndex((option) => option.key === budgetRenewal);
    return index >= 0 ? index : 0;
};
