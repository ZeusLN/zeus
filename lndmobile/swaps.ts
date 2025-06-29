import { NativeModules } from 'react-native';
import * as $protobuf from 'protobufjs';

const { LncModule } = NativeModules;

export interface ISendRequestClass<IReq, Req> {
    create: (options: IReq) => Req;
    encode: (request: Req) => $protobuf.Writer;
}

export interface ISendResponseClass<Res> {
    decode: (reader: $protobuf.Reader | Uint8Array) => Res;
    toObject(
        message: Res,
        options?: $protobuf.IConversionOptions
    ): { [k: string]: any };
}

export interface ISyncCommandOptions<IReq, Req, Res> {
    request: ISendRequestClass<IReq, Req>;
    response: ISendResponseClass<Res>;
    method: string;
    options: IReq;
}

/**
 * @throws
 */
export const createClaimTransaction = async ({
    endpoint,
    swapId,
    claimLeaf,
    refundLeaf,
    privateKey,
    servicePubKey,
    transactionHash,
    pubNonce
}: {
    endpoint: string;
    swapId: string;
    claimLeaf: string;
    refundLeaf: string;
    privateKey: string;
    servicePubKey: string;
    transactionHash: string;
    pubNonce: string;
}): Promise<string> => {
    try {
        const error: string = await LncModule.createClaimTransaction(
            endpoint,
            swapId,
            claimLeaf,
            refundLeaf,
            privateKey,
            servicePubKey,
            transactionHash,
            pubNonce
        );
        return error;
    } catch (e) {
        throw e;
    }
};

/**
 * @throws
 */
export const createReverseClaimTransaction = async ({
    endpoint,
    swapId,
    claimLeaf,
    refundLeaf,
    privateKey,
    servicePubKey,
    preimageHex,
    transactionHex,
    lockupAddress,
    destinationAddress,
    feeRate,
    isTestnet
}: {
    endpoint: string;
    swapId: string;
    claimLeaf: string;
    refundLeaf: string;
    privateKey: string;
    servicePubKey: string;
    preimageHex: string;
    transactionHex: string;
    lockupAddress: string;
    destinationAddress: string;
    feeRate: number;
    isTestnet?: boolean;
}): Promise<string> => {
    try {
        const error: string = await LncModule.createReverseClaimTransaction(
            endpoint,
            swapId,
            claimLeaf,
            refundLeaf,
            privateKey,
            servicePubKey,
            preimageHex,
            transactionHex,
            lockupAddress,
            destinationAddress,
            feeRate,
            isTestnet
        );
        return error;
    } catch (e) {
        throw e;
    }
};

/**
 * @throws
 */
export const createRefundTransaction = async ({
    endpoint,
    swapId,
    claimLeaf,
    refundLeaf,
    transactionHex,
    privateKey,
    servicePubKey,
    feeRate,
    timeoutBlockHeight,
    destinationAddress,
    lockupAddress,
    cooperative = false,
    isTestnet
}: {
    endpoint: string;
    swapId: string;
    claimLeaf: string;
    refundLeaf: string;
    transactionHex: string;
    privateKey: string;
    servicePubKey: string;
    feeRate: number;
    timeoutBlockHeight: number;
    destinationAddress: string;
    lockupAddress: string;
    cooperative: boolean;
    isTestnet?: boolean;
}): Promise<string> => {
    try {
        const txid: string = await LncModule.createRefundTransaction(
            endpoint,
            swapId,
            claimLeaf,
            refundLeaf,
            transactionHex,
            privateKey,
            servicePubKey,
            feeRate,
            timeoutBlockHeight,
            destinationAddress,
            lockupAddress,
            cooperative,
            isTestnet
        );
        return txid;
    } catch (e) {
        throw e;
    }
};
