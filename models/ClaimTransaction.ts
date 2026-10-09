import BaseModel from './BaseModel';
import Swap from './Swap';

// JSON.stringify turns a plain Uint8Array into { "0": b0, "1": b1, ... }
function bytesFromIndexedObject(raw: any): number[] | null {
    if (!raw || typeof raw !== 'object') return null;
    const keys = Object.keys(raw);
    if (keys.length === 0) return null;
    const bytes: number[] = [];
    for (let i = 0; i < keys.length; i++) {
        const byte = raw[i];
        if (!Number.isInteger(byte) || byte < 0 || byte > 255) return null;
        bytes.push(byte);
    }
    return bytes;
}

export function privateKeyFromKeys(
    keys:
        | { __D?: Uint8Array | number[] | { data?: number[] } }
        | null
        | undefined
): string | null {
    const raw: any = keys?.__D;
    if (!raw) {
        console.error('ClaimTransaction: keys.__D is missing');
        return null;
    }

    // A live ECPair (the swap screen right after creation) holds a
    // Buffer/Uint8Array; a stored swap holds its JSON form.
    const bytes: Uint8Array | number[] | null =
        raw instanceof Uint8Array || Array.isArray(raw)
            ? raw
            : Array.isArray(raw?.data)
            ? raw.data
            : bytesFromIndexedObject(raw);

    if (!bytes) {
        console.error('ClaimTransaction: unexpected key format', typeof raw);
        return null;
    }

    return Buffer.from(bytes).toString('hex');
}

export function preimageHexFrom(
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
        // A reverse claim spends the lockup by revealing the preimage, so
        // an empty one can never produce a valid claim. Fail closed rather
        // than broadcasting attempts that are guaranteed to be rejected.
        const preimageHex = preimageHexFrom(swap.preimage);

        if (
            !privateKey ||
            !claimLeaf ||
            !refundLeaf ||
            !servicePubKey ||
            !lockupAddress ||
            !destinationAddress ||
            !preimageHex
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
            preimageHex,
            transactionHex,
            lockupAddress,
            destinationAddress,
            feeRate,
            minerFee,
            isTestnet
        });
    }
}
