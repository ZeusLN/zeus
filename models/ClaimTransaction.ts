import BaseModel from './BaseModel';
import Swap from './Swap';
import { privateKeyFromSwapKeys } from '../utils/SwapUtils';

function preimageHexFrom(
    preimage:
        | string
        | Buffer
        | Uint8Array
        | { data?: number[] | Uint8Array }
        | null
        | undefined
): string {
    if (typeof preimage === 'string') return preimage;
    if (Buffer.isBuffer(preimage)) return preimage.toString('hex');
    if (preimage instanceof Uint8Array)
        return Buffer.from(preimage).toString('hex');
    if (preimage?.data) return Buffer.from(preimage.data).toString('hex');
    return '';
}

export default class ClaimTransaction extends BaseModel {
    endpoint: string;
    swapId: string;
    claimLeaf: string;
    refundLeaf: string;
    privateKey: string;
    servicePubKey: string;
}

export class SubmarineClaimTransaction extends ClaimTransaction {
    transactionHash: string;
    pubNonce: string;

    static build({
        swap,
        endpoint,
        claimTxDetails
    }: {
        swap: Swap;
        endpoint: string;
        claimTxDetails: { transactionHash: string; pubNonce: string };
    }): SubmarineClaimTransaction | null {
        const privateKey = privateKeyFromSwapKeys(swap.keys);
        const claimLeaf = swap.swapTreeDetails?.claimLeaf?.output;
        const refundLeaf = swap.swapTreeDetails?.refundLeaf?.output;
        const { servicePubKey } = swap;

        if (!privateKey || !claimLeaf || !refundLeaf || !servicePubKey) {
            console.error(
                'SubmarineClaimTransaction: swap is missing required fields'
            );
            return null;
        }

        return new SubmarineClaimTransaction({
            endpoint,
            swapId: swap.id,
            claimLeaf,
            refundLeaf,
            privateKey,
            servicePubKey,
            transactionHash: claimTxDetails.transactionHash,
            pubNonce: claimTxDetails.pubNonce
        });
    }
}

export class ReverseClaimTransaction extends ClaimTransaction {
    preimageHex: string;
    transactionHex: string;
    lockupAddress: string;
    destinationAddress: string;
    feeRate: number;
    minerFee: number;
    isTestnet: boolean;

    static build({
        swap,
        endpoint,
        transactionHex,
        feeRate,
        minerFee,
        isTestnet
    }: {
        swap: Swap;
        endpoint: string;
        transactionHex: string;
        feeRate: number;
        minerFee: number;
        isTestnet: boolean;
    }): ReverseClaimTransaction | null {
        const privateKey = privateKeyFromSwapKeys(swap.keys);
        const claimLeaf = swap.swapTreeDetails?.claimLeaf?.output;
        const refundLeaf = swap.swapTreeDetails?.refundLeaf?.output;
        const servicePubKey = swap.refundPubKey;
        const lockupAddress = swap.effectiveLockupAddress;
        const { destinationAddress } = swap;

        if (
            !privateKey ||
            !claimLeaf ||
            !refundLeaf ||
            !servicePubKey ||
            !lockupAddress ||
            !destinationAddress
        ) {
            console.error(
                'ReverseClaimTransaction: swap is missing required fields'
            );
            return null;
        }

        return new ReverseClaimTransaction({
            endpoint,
            swapId: swap.id,
            claimLeaf,
            refundLeaf,
            privateKey,
            servicePubKey,
            preimageHex: preimageHexFrom(swap.preimage),
            transactionHex,
            lockupAddress,
            destinationAddress,
            feeRate,
            minerFee,
            isTestnet
        });
    }
}
