import { NativeModules } from 'react-native';
import * as $protobuf from 'protobufjs';
import Base64Utils from '../utils/Base64Utils';

const { LndMobile } = NativeModules;

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

export interface IWriteStreamOptions<IReq, Req> {
    request: ISendRequestClass<IReq, Req>;
    method: string;
    options: IReq;
}

export interface IStreamCommandOptions<IReq, Req> {
    request: ISendRequestClass<IReq, Req>;
    method: string;
    options: IReq;
}

export interface IStreamResultOptions<Res> {
    base64Result: string;
    response: ISendResponseClass<Res>;
}

/**
 * @throws
 */
export const sendCommand = async <IReq, Req, Res>({
    request,
    response,
    method,
    options
}: ISyncCommandOptions<IReq, Req, Res>): Promise<Res> => {
    try {
        const instance = request.create(options);
        const b64 = await LndMobile.sendCommand(
            method,
            Base64Utils.bytesToBase64(request.encode(instance).finish())
        );
        return response.decode(Base64Utils.base64ToBytes(b64.data || ''));
    } catch (e) {
        throw e;
    }
};

export const sendStreamCommand = async <IReq, Req>(
    { request, method, options }: IStreamCommandOptions<IReq, Req>,
    streamOnlyOnce: boolean = false
): Promise<string> => {
    const instance = request.create(options);
    const response = await LndMobile.sendStreamCommand(
        method,
        Base64Utils.bytesToBase64(request.encode(instance).finish()),
        streamOnlyOnce
    );
    return response;
};

export const sendBidiStreamCommand = async (
    method: string,
    streamOnlyOnce: boolean = false
): Promise<string> => {
    const response = await LndMobile.sendBidiStreamCommand(
        method,
        streamOnlyOnce
    );
    return response;
};

export const writeToStream = async <IReq, Req>({
    request,
    method,
    options
}: IWriteStreamOptions<IReq, Req>) => {
    const instance = request.create(options);
    await LndMobile.writeToStream(
        method,
        Base64Utils.bytesToBase64(request.encode(instance).finish())
    );
};

export const decodeStreamResult = <Res>({
    base64Result,
    response
}: IStreamResultOptions<Res>): Res => {
    return response.decode(Base64Utils.base64ToBytes(base64Result));
};
