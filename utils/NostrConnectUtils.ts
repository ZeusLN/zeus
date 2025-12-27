import type {
    Nip47NotificationType,
    Nip47SingleMethod,
    Nip47Transaction
} from '@getalby/sdk/dist/nwc/types';

import {
    BudgetRenewalType,
    PermissionType,
    TimeUnit
} from '../models/NWCConnection';

import { localeString } from './LocaleUtils';
import dateTimeUtils from './DateTimeUtils';
import bolt11 from 'bolt11';

export interface PermissionOption {
    key: PermissionType;
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

    static get TIME_UNITS(): TimeUnit[] {
        return [
            localeString('time.hours'),
            localeString('time.days'),
            localeString('time.weeks'),
            localeString('time.months'),
            localeString('time.years')
        ];
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
            },
            {
                key: 'sign_message',
                title: localeString('views.Settings.signMessage.button'),
                description: localeString(
                    'views.Settings.NostrWalletConnect.permissions.signMessageDescription'
                )
            }
        ];
    }

    static getBudgetRenewalOptions(): BudgetRenewalOption[] {
        return [
            {
                key: BudgetRenewalType.Never,
                title: localeString('models.Invoice.never')
            },
            {
                key: BudgetRenewalType.Daily,
                title: localeString(
                    'views.Settings.NostrWalletConnect.budgetRenewal.daily'
                )
            },
            {
                key: BudgetRenewalType.Weekly,
                title: localeString(
                    'views.Settings.NostrWalletConnect.budgetRenewal.weekly'
                )
            },
            {
                key: BudgetRenewalType.Monthly,
                title: localeString(
                    'views.Settings.NostrWalletConnect.budgetRenewal.monthly'
                )
            },
            {
                key: BudgetRenewalType.Yearly,
                title: localeString(
                    'views.Settings.NostrWalletConnect.budgetRenewal.yearly'
                )
            }
        ];
    }

    static getPermissionTypes(): PermissionOption[] {
        return [
            {
                key: PermissionType.FullAccess,
                title: localeString(
                    'views.Settings.NostrWalletConnect.fullAccess'
                ),
                description: localeString(
                    'views.Settings.NostrWalletConnect.fullAccessDescription'
                )
            },
            {
                key: PermissionType.ReadOnly,
                title: localeString(
                    'views.Settings.NostrWalletConnect.readOnly'
                ),
                description: localeString(
                    'views.Settings.NostrWalletConnect.readOnlyDescription'
                )
            },
            {
                key: PermissionType.Custom,
                title: localeString('views.Settings.NostrWalletConnect.custom'),
                description: localeString(
                    'views.Settings.NostrWalletConnect.customDescription'
                )
            }
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

    static getExpiryPresetIndex(expiryAt: Date, createdAt: Date): number {
        const expiryDays = NostrConnectUtils.calculateExpiryDays(
            expiryAt,
            createdAt
        )?.toString();
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
    ): Date | undefined {
        const now = new Date();
        switch (presetIndex) {
            case PRESET_INDEX.FIRST:
                return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            case PRESET_INDEX.SECOND:
                return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            case PRESET_INDEX.THIRD:
                return new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
            case PRESET_INDEX.NEVER:
                return undefined;
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

    static calculateExpiryDays(expiresAt: Date, createdAt: Date): string {
        const expiry = new Date(expiresAt);
        expiry.setHours(0, 0, 0, 0);
        const created = new Date(createdAt);
        created.setHours(0, 0, 0, 0);
        const diffTime = expiry.getTime() - created.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
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
        permissionType: PermissionType,
        currentPermissions: Nip47SingleMethod[] = []
    ): { permissions: Nip47SingleMethod[] } {
        switch (permissionType) {
            case PermissionType.FullAccess:
                return {
                    permissions: NostrConnectUtils.getFullAccessPermissions()
                };
            case PermissionType.ReadOnly:
                return {
                    permissions: NostrConnectUtils.getReadOnlyPermissions()
                };
            case PermissionType.Custom:
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
    ): PermissionType {
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
            return PermissionType.FullAccess;
        } else if (
            JSON.stringify(connectionPermissions) ===
            JSON.stringify(readOnlySorted)
        ) {
            return PermissionType.ReadOnly;
        }
        return PermissionType.Custom;
    }

    static getBudgetRenewalIndex(budgetRenewal?: string): number {
        const options = NostrConnectUtils.getBudgetRenewalOptions();
        const index = options.findIndex(
            (option) => option.key === budgetRenewal
        );
        return index >= 0 ? index : 0;
    }

    static shouldShowBudget(
        permissionType: PermissionType | null,
        selectedPermissions: Nip47SingleMethod[]
    ): boolean {
        if (permissionType === PermissionType.FullAccess) {
            return true;
        }
        return (
            selectedPermissions.includes('pay_invoice') ||
            selectedPermissions.includes('pay_keysend')
        );
    }

    static hasPaymentPermissions(permissions: Nip47SingleMethod[]): boolean {
        return (
            permissions.includes('pay_invoice') ||
            permissions.includes('pay_keysend')
        );
    }

    /**
     * Decodes invoice and extracts payment hash, description hash, and expiry time
     * Used for NIP-47 transaction creation
     * @param paymentRequest - Bolt11 payment request string
     * @param fallbackExpirySeconds - Fallback expiry time in seconds (default: 3600)
     * @returns Object containing payment hash, description hash, and expiry time
     * @throws Error if invoice decoding fails
     */
    static decodeInvoiceTags(
        invoice: string,
        fallbackExpirySeconds: number = 3600
    ): {
        paymentHash: string;
        descriptionHash: string;
        expiryTime: number;
        createdAt: number | undefined;
        paymentRequest: string;
    } {
        let paymentHash = '';
        let descriptionHash = '';
        let expiryTime =
            dateTimeUtils.getCurrentTimestamp() + fallbackExpirySeconds;
        let createdAt;
        let paymentRequest: string = '';
        try {
            const decoded = bolt11.decode(invoice);
            if (!decoded || !decoded.tags) {
                throw new Error('Invalid payment request structure');
            }
            paymentRequest = decoded.paymentRequest!;
            for (const tag of decoded.tags) {
                if (tag.tagName === 'payment_hash') {
                    paymentHash = String(tag.data || '');
                } else if (tag.tagName === 'purpose_commit_hash') {
                    descriptionHash = String(tag.data || '');
                } else if (tag.tagName === 'expire_time') {
                    const invoiceExpiry = Number(tag.data);
                    if (invoiceExpiry > 0 && decoded.timestamp) {
                        expiryTime = decoded.timestamp + invoiceExpiry;
                        createdAt = decoded.timestamp;
                    }
                }
            }
        } catch (decodeError) {
            console.error('Failed to decode invoice:', decodeError);
            throw decodeError;
        }

        return {
            paymentHash,
            descriptionHash,
            expiryTime,
            createdAt,
            paymentRequest
        };
    }

    /**
     * Creates a NIP-47 transaction object with sensible defaults
     * @param params - Transaction parameters
     * @param params.type - Transaction type: 'incoming' or 'outgoing'
     * @param params.state - Transaction state: 'pending', 'settled', or 'failed'
     * @param params.invoice - Payment request/invoice string
     * @param params.payment_hash - Payment hash
     * @param params.amount - Amount in millisatoshis
     * @param params.description - Optional description
     * @param params.description_hash - Optional description hash
     * @param params.preimage - Optional preimage
     * @param params.fees_paid - Optional fees paid in millisatoshis (default: 0)
     * @param params.settled_at - Optional settlement timestamp (default: 0)
     * @param params.created_at - Optional creation timestamp (default: current time)
     * @param params.expires_at - Optional expiry timestamp (default: created_at + 3600)
     * @param params.metadata - Optional metadata object
     * @returns NIP-47 transaction object
     */
    static createNip47Transaction(params: {
        type: 'incoming' | 'outgoing';
        state: 'pending' | 'settled' | 'failed';
        invoice: string;
        payment_hash: string;
        amount: number;
        description?: string;
        description_hash?: string;
        preimage?: string;
        fees_paid?: number;
        settled_at?: number;
        created_at?: number;
        expires_at?: number;
        metadata?: any;
    }): Nip47Transaction {
        const now = dateTimeUtils.getCurrentTimestamp();
        const DEFAULT_EXPIRY_SECONDS = 3600;

        return {
            type: params.type,
            state: params.state,
            invoice: params.invoice || '',
            description: params.description || '',
            description_hash: params.description_hash || '',
            preimage: params.preimage || '',
            payment_hash: params.payment_hash,
            amount: params.amount,
            fees_paid: params.fees_paid ?? 0,
            settled_at: params.settled_at ?? 0,
            created_at: params.created_at ?? now,
            expires_at:
                params.expires_at ??
                (params.created_at ?? now) + DEFAULT_EXPIRY_SECONDS,
            ...(params.metadata && { metadata: params.metadata })
        };
    }
}
