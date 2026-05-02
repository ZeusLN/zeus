import BaseModel from './BaseModel';
import Swap from './Swap';

function privateKeyFromKeys(
    keys: { __D?: number[] | { data?: number[] } } | null | undefined
): string | null {
    const raw = keys?.__D;
    if (!raw) {
        console.error('ClaimTransaction: keys.__D is missing');
        return null;
    }

    const bytes: number[] | null = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.data)
        ? raw.data
        : null;

    if (!bytes) {
        console.error('ClaimTransaction: unexpected key format', typeof raw);
        return null;
    }

    return Buffer.from(bytes).toString('hex');
}

function preimageHexFrom(
    preimage: string | Buffer | { data?: number[] } | null | undefined
): string {
    if (typeof preimage === 'string') return preimage;
    if (Buffer.isBuffer(preimage)) return preimage.toString('hex');
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
        const privateKey = privateKeyFromKeys(swap.keys);
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
        const privateKey = privateKeyFromKeys(swap.keys);
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
