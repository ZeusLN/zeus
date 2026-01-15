import type {
    Nip47NotificationType,
    Nip47SingleMethod,
    Nip47Transaction,
    Nip47ListTransactionsRequest
} from '@getalby/sdk/dist/nwc/types';

import {
    BudgetRenewalType,
    PermissionType,
    TimeUnit,
    ConnectionActivity
} from '../models/NWCConnection';
import Invoice from '../models/Invoice';
import Payment from '../models/Payment';
import CashuPayment from '../models/CashuPayment';
import CashuInvoice from '../models/CashuInvoice';
import CashuToken from '../models/CashuToken';
import Transaction from '../models/Transaction';

import { localeString } from './LocaleUtils';
import dateTimeUtils from './DateTimeUtils';
import bolt11 from 'bolt11';
import Base64Utils from './Base64Utils';
import BackendUtils from './BackendUtils';
import { millisatsToSats, satsToMillisats } from './AmountUtils';

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
    static async decodeInvoiceTags(
        invoice: string,
        checkForPaidStatus: boolean = false
    ): Promise<{
        paymentHash: string;
        descriptionHash: string;
        description: string;
        amount: number;
        expiryTime: number;
        createdAt: number;
        isExpired: boolean;
        paymentRequest: string;
        network: string;
        isPaid?: boolean;
    }> {
        try {
            const decoded = bolt11.decode(invoice);
            if (!decoded || !decoded.tags) {
                throw new Error('Invalid payment request structure');
            }
            let paymentHash = '';
            let descriptionHash = '';
            let description = '';

            for (const tag of decoded.tags) {
                if (tag.tagName === 'payment_hash') {
                    paymentHash = String(tag.data || '');
                } else if (tag.tagName === 'purpose_commit_hash') {
                    descriptionHash = String(tag.data || '');
                } else if (tag.tagName === 'description') {
                    description = String(tag.data || '');
                }
            }
            const createdAt = decoded.timestamp || 0;
            const expireTime = decoded.timeExpireDate || 0;
            const currentTime = Math.floor(Date.now() / 1000);
            const isExpired = expireTime > 0 && currentTime > expireTime;
            let isPaid = false;
            if (paymentHash && checkForPaidStatus) {
                try {
                    const result = await BackendUtils.lookupInvoice({
                        r_hash: paymentHash
                    });
                    isPaid = new Invoice(result).isPaid;
                } catch (e) {}
            }
            return {
                paymentHash,
                descriptionHash,
                description,
                amount:
                    decoded.satoshis ||
                    millisatsToSats(Number(decoded?.millisatoshis)) ||
                    0,
                expiryTime: expireTime,
                createdAt,
                isExpired,
                paymentRequest: decoded.paymentRequest!,
                network: decoded.network?.toString() || 'bitcoin',
                isPaid
            };
        } catch (decodeError) {
            console.error('Failed to decode invoice:', decodeError);
            throw decodeError;
        }
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

    static convertPaymentHashToHex(
        paymentHash: string | number[] | Uint8Array
    ): string | undefined {
        try {
            if (paymentHash instanceof Uint8Array) {
                return Base64Utils.bytesToHex(Array.from(paymentHash));
            }

            if (Array.isArray(paymentHash)) {
                return Base64Utils.bytesToHex(paymentHash);
            }

            if (!paymentHash || typeof paymentHash !== 'string') {
                console.warn(
                    'convertPaymentHashToHex: Invalid payment hash input:',
                    paymentHash
                );
                return undefined;
            }
            if (paymentHash.startsWith('{')) {
                let hashObj;
                if (paymentHash.includes('=>')) {
                    const jsonString = paymentHash
                        .replace(/=>/g, ':')
                        .replace(/"(\d+)":/g, '$1:')
                        .replace(/(\d+):/g, '"$1":');
                    hashObj = JSON.parse(jsonString);
                } else {
                    hashObj = JSON.parse(paymentHash);
                }

                const hashArray = Object.keys(hashObj)
                    .sort((a, b) => parseInt(a) - parseInt(b))
                    .map((key) => hashObj[key])
                    .filter((value) => value !== undefined && value !== null); // Filter out undefined/null values

                if (hashArray.length === 0) {
                    console.warn(
                        'convertPaymentHashToHex: Empty hash array after filtering'
                    );
                    return undefined;
                }

                return Base64Utils.bytesToHex(hashArray);
            }

            if (
                paymentHash.includes('+') ||
                paymentHash.includes('/') ||
                paymentHash.includes('=')
            ) {
                return Base64Utils.base64ToHex(paymentHash);
            }

            return paymentHash;
        } catch (error) {
            console.warn('Failed to convert payment hash to hex:', error);
            return undefined;
        }
    }
    static isIgnorableError(error: string): boolean {
        const msg = error.toLowerCase();
        return (
            msg.includes('already paid') ||
            msg.includes('already been settled') ||
            msg.includes('invoice expired') ||
            msg.includes('has expired') ||
            msg.includes('not payable') ||
            msg.includes('invoice canceled') ||
            msg.includes('invoice cancelled')
        );
    }

    /**
     * Checks if a connection has full access permissions
     * @param permissions - Array of permissions to check
     * @returns true if permissions match full access permissions
     */
    static hasFullPermissions(permissions: Nip47SingleMethod[]): boolean {
        const fullAccessPermissions =
            NostrConnectUtils.getFullAccessPermissions().slice().sort();
        const connectionPermissions = [...permissions].sort();
        return (
            JSON.stringify(connectionPermissions) ===
            JSON.stringify(fullAccessPermissions)
        );
    }

    /**
     * Converts a ConnectionActivity to a NIP-47 transaction
     * @param activity - Connection activity to convert
     * @returns NIP-47 transaction object
     */
    static convertConnectionActivityToNip47Transaction(
        activity: ConnectionActivity
    ): Nip47Transaction {
        let type: 'incoming' | 'outgoing' = 'outgoing';
        if (activity.type === 'make_invoice') {
            type = 'incoming';
        } else if (
            activity.type === 'pay_invoice' ||
            activity.type === 'pay_keysend'
        ) {
            type = 'outgoing';
        }

        let state: 'settled' | 'pending' | 'failed' = 'pending';
        if (activity.status === 'success') {
            state = 'settled';
        } else if (activity.status === 'failed') {
            state = 'failed';
        }

        let invoice = '';
        if (activity.invoice) {
            invoice = activity.invoice.getPaymentRequest || '';
        }

        let paymentHash = activity.paymentHash || '';
        if (!paymentHash && activity.payment) {
            paymentHash = activity.payment.paymentHash || '';
        }
        if (!paymentHash && activity.invoice) {
            paymentHash = (activity.invoice as Invoice).payment_hash || '';
        }
        if (!paymentHash) {
            paymentHash = activity.id || '';
        }

        let amount = 0;
        if (activity.satAmount) {
            amount = satsToMillisats(activity.satAmount);
        } else if (activity.payment) {
            const paymentAmount = activity.payment.getAmount;
            amount = satsToMillisats(Number(paymentAmount) || 0);
        } else if (activity.invoice) {
            amount = satsToMillisats(Number(activity.invoice.getAmount) || 0);
        }

        const feesPaid = activity.fees_paid
            ? satsToMillisats(activity.fees_paid)
            : activity.payment
            ? satsToMillisats(Number(activity.payment.getFee) || 0)
            : 0;

        const lastProcessAt = activity.lastprocessAt
            ? Math.floor(activity.lastprocessAt.getTime() / 1000)
            : Date.now() / 1000;
        const expiresAt = activity.expiresAt
            ? Math.floor(activity.expiresAt.getTime() / 1000)
            : activity.invoice
            ? Number(activity.invoice.expires_at) || 0
            : 0;

        let description = '';
        if (activity.invoice) {
            description = activity.invoice.getMemo || '';
        } else if (activity.payment) {
            description = activity.payment.getMemo || '';
        }

        const preimage =
            activity.preimage ||
            (activity.payment ? activity.payment.getPreimage || '' : '');

        return NostrConnectUtils.createNip47Transaction({
            type,
            state,
            invoice,
            payment_hash: paymentHash,
            amount,
            description,
            preimage,
            fees_paid: feesPaid,
            settled_at: state === 'settled' ? lastProcessAt : 0,
            created_at: lastProcessAt,
            expires_at: expiresAt
        });
    }

    /**
     * Converts Cashu payments, invoices, and tokens to NIP-47 transactions
     * @param cashuData - Object containing Cashu payments, invoices, and tokens
     * @returns Array of NIP-47 transactions
     */
    static convertCashuDataToNip47Transactions(cashuData: {
        payments?: CashuPayment[];
        invoices?: CashuInvoice[];
        receivedTokens?: CashuToken[];
        sentTokens?: CashuToken[];
    }): Nip47Transaction[] {
        const transactions: Nip47Transaction[] = [];

        // Convert Cashu payments
        if (cashuData.payments) {
            const paymentTransactions = cashuData.payments.map((payment) => {
                const timestamp =
                    Number(payment.getTimestamp) || Date.now() / 1000;
                return NostrConnectUtils.createNip47Transaction({
                    type: 'outgoing',
                    state: 'settled',
                    invoice: payment.getPaymentRequest || '',
                    payment_hash: payment.paymentHash || '',
                    amount: satsToMillisats(Number(payment.getAmount) || 0),
                    description: payment.getMemo,
                    fees_paid: satsToMillisats(Number(payment.getFee) || 0),
                    settled_at: Math.floor(timestamp),
                    created_at: Math.floor(timestamp),
                    expires_at: 0
                });
            });
            transactions.push(...paymentTransactions);
        }

        // Convert Cashu invoices
        if (cashuData.invoices) {
            const invoiceTransactions = cashuData.invoices.map((invoice) => {
                const timestamp =
                    Number(invoice.getTimestamp) || Date.now() / 1000;
                const expiresAt = Number(invoice.expires_at) || 0;
                return NostrConnectUtils.createNip47Transaction({
                    type: 'incoming',
                    state: invoice.isPaid ? 'settled' : 'pending',
                    invoice: invoice.getPaymentRequest || '',
                    payment_hash: invoice.quote || '',
                    amount: satsToMillisats(invoice.getAmount || 0),
                    description: invoice.getMemo,
                    settled_at: invoice.isPaid
                        ? Math.floor(
                              invoice.settleDate?.getTime()
                                  ? invoice.settleDate.getTime() / 1000
                                  : Number(invoice.getTimestamp) ||
                                        Date.now() / 1000
                          )
                        : 0,
                    created_at: Math.floor(timestamp),
                    expires_at: Math.floor(expiresAt)
                });
            });
            transactions.push(...invoiceTransactions);
        }

        // Convert received tokens
        if (cashuData.receivedTokens) {
            const receivedTokenTransactions = cashuData.receivedTokens.map(
                (token) => {
                    const receivedAt =
                        Number(token.received_at) || Date.now() / 1000;
                    const createdAt = Number(token.created_at) || receivedAt;
                    return NostrConnectUtils.createNip47Transaction({
                        type: 'incoming',
                        state: 'settled',
                        invoice: '',
                        payment_hash: token.encodedToken || '',
                        amount: satsToMillisats(token.getAmount || 0),
                        description:
                            token.memo ||
                            localeString(
                                'stores.NostrWalletConnectStore.receivedCashuToken'
                            ),
                        settled_at: Math.floor(receivedAt),
                        created_at: Math.floor(createdAt),
                        expires_at: 0
                    });
                }
            );
            transactions.push(...receivedTokenTransactions);
        }

        // Convert sent tokens
        if (cashuData.sentTokens) {
            const sentTokenTransactions = cashuData.sentTokens.map((token) => {
                const createdAt = Number(token.created_at) || Date.now() / 1000;
                return NostrConnectUtils.createNip47Transaction({
                    type: 'outgoing',
                    state: token.spent ? 'settled' : 'pending',
                    invoice: '',
                    payment_hash: token.encodedToken || '',
                    amount: satsToMillisats(token.getAmount || 0),
                    description:
                        token.memo ||
                        localeString(
                            'stores.NostrWalletConnectStore.sentCashuToken'
                        ),
                    settled_at: token.spent
                        ? Math.floor(
                              Number(token.received_at) ||
                                  Number(token.created_at) ||
                                  Date.now() / 1000
                          )
                        : 0,
                    created_at: Math.floor(createdAt),
                    expires_at: 0
                });
            });
            transactions.push(...sentTokenTransactions);
        }

        return transactions;
    }

    /**
     * Converts Lightning payments to NIP-47 transactions
     * @param payments - Array of Lightning payments
     * @returns Array of NIP-47 transactions
     */
    static convertLightningPaymentsToNip47Transactions(
        payments: Payment[]
    ): Nip47Transaction[] {
        return (payments || []).map((payment: Payment) => {
            const amount = Number(payment.getAmount) || 0;
            const timestamp = Number(payment.getTimestamp) || Date.now() / 1000;
            const paymentHash = payment.paymentHash || '';
            const invoice = payment.getPaymentRequest || '';
            const feesPaid = satsToMillisats(Number(payment.getFee) || 0);
            const description = payment.getMemo || '';
            const preimage = payment.getPreimage || '';

            // Determine state based on payment status
            let state: 'settled' | 'pending' | 'failed' = 'pending';
            if (payment.isFailed) {
                state = 'failed';
            } else if (!payment.isIncomplete) {
                state = 'settled';
            }

            return NostrConnectUtils.createNip47Transaction({
                type: 'outgoing',
                state,
                invoice,
                payment_hash: paymentHash,
                amount: satsToMillisats(amount),
                description,
                preimage,
                fees_paid: feesPaid,
                settled_at: state === 'settled' ? timestamp : 0,
                created_at: timestamp,
                expires_at: 0
            });
        });
    }

    /**
     * Converts Lightning invoices to NIP-47 transactions
     * @param invoices - Array of Lightning invoices
     * @returns Array of NIP-47 transactions
     */
    static convertLightningInvoicesToNip47Transactions(
        invoices: Invoice[]
    ): Nip47Transaction[] {
        return (invoices || []).map((invoice: Invoice) => {
            const amount = Number(invoice.getAmount) || 0;
            const timestamp = Number(invoice.getTimestamp) || Date.now() / 1000;
            const paymentHash = invoice.payment_hash || '';
            const invoiceString = invoice.getPaymentRequest || '';
            const description = invoice.getMemo || '';
            const expiresAt = Number(invoice.expires_at) || 0;

            let state: 'settled' | 'pending' | 'failed' = 'pending';
            if (invoice.isPaid) {
                state = 'settled';
            }

            return NostrConnectUtils.createNip47Transaction({
                type: 'incoming',
                state,
                invoice: invoiceString,
                payment_hash: paymentHash,
                amount: satsToMillisats(amount),
                description,
                fees_paid: 0,
                settled_at: state === 'settled' ? timestamp : 0,
                created_at: timestamp,
                expires_at: expiresAt
            });
        });
    }

    /**
     * Converts on-chain transactions to NIP-47 transactions
     * @param transactions - Array of on-chain transactions
     * @returns Array of NIP-47 transactions
     */
    static convertOnChainTransactionsToNip47Transactions(
        transactions: Transaction[]
    ): Nip47Transaction[] {
        return (transactions || []).map((tx: Transaction) => {
            const amount = Number(tx.amount);
            const type: 'incoming' | 'outgoing' =
                amount >= 0 ? 'incoming' : 'outgoing';

            let state: 'settled' | 'pending' | 'failed' = 'pending';
            if (
                tx.status &&
                (tx.status === 'failed' ||
                    tx.status === 'FAILED' ||
                    tx.status.toLowerCase().includes('fail'))
            ) {
                state = 'failed';
            } else if (tx.num_confirmations > 0) {
                state = 'settled';
            }

            const amountMsats = satsToMillisats(Math.abs(amount));
            const feesMsats = satsToMillisats(Number(tx.total_fees) || 0);
            const timestamp = Number(tx.time_stamp) || 0;
            const txHash = tx.tx_hash || tx.txid || '';

            return NostrConnectUtils.createNip47Transaction({
                type,
                state,
                invoice: '',
                payment_hash: txHash,
                amount: amountMsats,
                description: tx.note || undefined,
                fees_paid: feesMsats,
                settled_at: state === 'settled' ? timestamp : 0,
                created_at: timestamp,
                expires_at: 0, // On-chain transactions don't expire
                metadata: {
                    block_height: tx.block_height,
                    block_hash: tx.block_hash,
                    num_confirmations: tx.num_confirmations,
                    dest_addresses: tx.dest_addresses,
                    raw_tx_hex: tx.raw_tx_hex
                }
            });
        });
    }

    /**
     * Filters and paginates NIP-47 transactions based on request parameters
     * @param transactions - Array of transactions to filter
     * @param request - Filter and pagination parameters
     * @returns Filtered and paginated transactions with total count
     */
    static filterAndPaginateTransactions(
        transactions: Nip47Transaction[],
        request: Nip47ListTransactionsRequest
    ): {
        transactions: Nip47Transaction[];
        totalCount: number;
    } {
        let filtered = [...transactions];

        // Filter by type
        if (request.type && request.type.trim() !== '') {
            filtered = filtered.filter((tx) => tx.type === request.type);
        }

        // Filter by from timestamp
        if (request.from) {
            filtered = filtered.filter((tx) => tx.created_at >= request.from!);
        }

        // Filter by until timestamp
        if (request.until) {
            filtered = filtered.filter((tx) => tx.created_at <= request.until!);
        }

        // Filter by unpaid status
        if (request.unpaid !== undefined) {
            if (request.unpaid) {
                filtered = filtered.filter((tx) => tx.state === 'pending');
            } else {
                filtered = filtered.filter((tx) => tx.state === 'settled');
            }
        }

        // Calculate pagination
        const totalCount = filtered.length;
        const offset = Math.max(0, request.offset || 0);
        const MAX_LIMIT = 1000;
        const limit = request.limit
            ? Math.min(request.limit, MAX_LIMIT)
            : Math.min(totalCount, MAX_LIMIT);

        // Apply pagination
        const paginated = filtered.slice(offset, offset + limit);

        return {
            transactions: paginated,
            totalCount
        };
    }
}
