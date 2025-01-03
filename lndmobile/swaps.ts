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
