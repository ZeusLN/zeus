import { computed } from 'mobx';
import BaseModel from './BaseModel';
import { localeString } from '../utils/LocaleUtils';
import DateTimeUtils from '../utils/DateTimeUtils';

export enum SwapState {
    Created = 'swap.created',
    InvoiceSet = 'invoice.set',
    TransactionClaimPending = 'transaction.claim.pending',
    TransactionMempool = 'transaction.mempool',
    TransactionFailed = 'transaction.failed',
    TransactionConfirmed = 'transaction.confirmed',
    TransactionClaimed = 'transaction.claimed',
    InvoiceSettled = 'invoice.settled',
    InvoicePending = 'invoice.pending',
    InvoicePaid = 'invoice.paid',
    TransactionRefunded = 'transaction.refunded',
    InvoiceFailedToPay = 'invoice.failedToPay',
    SwapExpired = 'swap.expired',
    InvoiceExpired = 'invoice.expired',
    TransactionLockupFailed = 'transaction.lockupFailed'
}

export enum SwapType {
    Submarine = 'Submarine',
    Reverse = 'Reverse'
}

export default class Swap extends BaseModel {
    id: string;
    type: SwapType;
    status: SwapState;
    createdAt: number | string;
    endpoint: string;
    implementation: string;
    invoice?: string;
    keys?: any;
    lockupAddress?: string;
    nodePubkey: string;
    onchainAmount?: number;
    amount?: number;
    preimage?: { data: number[]; type: string };
    refundPublicKey?: string;
    serviceProvider: string;
    swapTree?: any;
    timeoutBlockHeight: number;
    destinationAddress?: string;
    expectedAmount?: number;
    claimPublicKey?: string;
    refundPrivateKey?: string;
    acceptZeroConf?: boolean;
    address?: string;
    bip21?: string;
    // a reverse swap's claim fee in sats, and the sat/vB rate it was
    // decided at, both fixed when the swap is created
    claimMinerFee?: number;
    claimFeeRate?: number;
    failureReason?: string;
    imported?: boolean;
    // set once this wallet has sent a submarine swap's on-chain payment from
    // its pay button, so the swap is not offered for payment again
    funded?: boolean;
    claimAddressFromWallet?: boolean;
    onchainAmountVerified?: boolean;
    keyIndex?: number;
    preimageHash?: string;
    serverPublicKey?: string;
    symbol?: string;
    tree?: any;
    lockupTransaction?: any;
    txid?: string;
    // a reverse swap's signed claim, stored before it is first broadcast so
    // a failed broadcast is retried with the same transaction
    claimTransactionHex?: string;
    claimTxid?: string;

    @computed public get model(): string {
        return localeString('views.Swaps.title');
    }

    @computed get createdAtFormatted(): number | string {
        return typeof this.createdAt === 'number'
            ? this.createdAt * 1000
            : this.createdAt;
    }

    @computed get getTimestamp(): number {
        return typeof this.createdAt === 'number'
            ? this.createdAt
            : new Date(this.createdAt).getTime() / 1000;
    }

    @computed get getDate(): Date {
        return new Date(this.createdAtFormatted);
    }

    @computed get getDisplayTimeShort(): string {
        return DateTimeUtils.listFormattedDateShort(this.getTimestamp);
    }

    @computed get isSubmarineSwap(): boolean {
        return this.type === SwapType.Submarine;
    }

    @computed get isReverseSwap(): boolean {
        return this.type === SwapType.Reverse;
    }

    @computed get refundPubKey(): string | undefined {
        return this.refundPublicKey || this.serverPublicKey;
    }

    @computed get getAmount(): number | undefined {
        if (this.isSubmarineSwap) {
            return this.expectedAmount;
        }
        return this.onchainAmount || this.amount;
    }

    @computed get servicePubKey(): string | undefined {
        return this.claimPublicKey || this.serverPublicKey;
    }

    @computed get swapTreeDetails(): any {
        return this.swapTree || this.tree;
    }

    /**
     * The address a reverse swap's claim may pay out to. On a rescued swap
     * always resolve a fresh wallet address. Legacy rescues copied arbitrary
     * host fields, including claimAddressFromWallet, so no persisted marker
     * proves ownership, even after the preimage has been repaired.
     */
    @computed get claimDestinationAddress(): string | undefined {
        if (this.imported) return undefined;
        return this.destinationAddress;
    }

    @computed get effectiveLockupAddress(): string | undefined {
        return this.address || this.lockupAddress;
    }

    /**
     * What the pay button and QR code hand over. A rescued submarine swap has
     * none: /swap/restore returns no invoice, so nothing ties its address to
     * a payment to this wallet. It is only there to be refunded. Swaps saved
     * before bip21 was rebuilt on creation may lack it and fall back to the
     * lockup address.
     */
    @computed get qrCodeValue(): string | undefined {
        if (this.isSubmarineSwap) {
            return this.imported ? undefined : this.bip21 || this.lockupAddress;
        }
        if (this.isReverseSwap) {
            return this.invoice;
        }
        return undefined;
    }
}
