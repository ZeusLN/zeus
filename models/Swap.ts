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

    @computed get createdAtFormatted(): number | string {
        return typeof this.createdAt === 'number'
            ? this.createdAt * 1000
            : this.createdAt;
    }
}
