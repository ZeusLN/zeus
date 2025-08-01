import { computed } from 'mobx';
import BaseModel from './BaseModel';

export default class Swap extends BaseModel {
    id: string;
    type: 'Submarine' | 'Reverse';
    status: string;
    createdAt: number | string;
    endpoint: string;
    implementation: string;
    invoice?: string;
    keys?: any;
    lockupAddress?: string;
    nodePubkey: string;
    onchainAmount?: number;
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
        return this.type === 'Submarine';
    }

    @computed get isNewSubmarineSwap(): boolean {
        return this.isSubmarineSwap && this.bip21 !== undefined;
    }

    @computed get isReverseSwap(): boolean {
        return this.type === 'Reverse' && this.lockupAddress !== undefined;
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
        if (this.isNewSubmarineSwap) {
            return this.bip21;
        }
        if (this.isSubmarineSwap && !!this.lockupAddress) {
            return this.lockupAddress;
        }
        if (this.isReverseSwap) {
            return this.invoice;
        }
        return undefined;
    }
}
