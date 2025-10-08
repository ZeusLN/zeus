import { computed } from 'mobx';
import BaseModel from './BaseModel';

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
    failureReason?: string;
    imported?: boolean;
    keyIndex?: number;
    preimageHash?: string;
    serverPublicKey?: string;
    symbol?: string;
    tree?: any;
    lockupTransaction?: any;
    txid?: string;

    @computed get createdAtFormatted(): number | string {
        return typeof this.createdAt === 'number'
            ? this.createdAt * 1000
            : this.createdAt;
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
        return this.onchainAmount || this.amount;
    }

    @computed get servicePubKey(): string | undefined {
        return this.claimPublicKey || this.serverPublicKey;
    }

    @computed get swapTreeDetails(): any {
        return this.swapTree || this.tree;
    }

    @computed get effectiveLockupAddress(): string | undefined {
        return this.address || this.lockupAddress;
    }

    @computed get qrCodeValue(): string | undefined {
        if (this.isSubmarineSwap) {
            return this.bip21 || this.lockupAddress;
        }
        if (this.isReverseSwap) {
            return this.invoice;
        }
        return undefined;
    }
}
