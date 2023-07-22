import * as base64 from 'base64-js';

import { sendCommand, sendStreamCommand, decodeStreamResult } from './utils';
import { lnrpc, signrpc } from './../proto/lightning';

import Base64Utils from '../utils/Base64Utils';

/**
 * @throws
 * TODO test
 */
export const genSeed = async (
    passphrase: string | undefined
): Promise<lnrpc.GenSeedResponse> => {
    const response = await sendCommand<
        lnrpc.IGenSeedRequest,
        lnrpc.GenSeedRequest,
        lnrpc.GenSeedResponse
    >({
        request: lnrpc.GenSeedRequest,
        response: lnrpc.GenSeedResponse,
        method: 'GenSeed',
        options: {
            aezeed_passphrase: passphrase
                ? Base64Utils.stringToUint8Array(passphrase)
                : undefined
        }
    });
    return response;
};

export const initWallet = async (
    seed: string[],
    password: string,
    recoveryWindow?: number,
    channelBackupsBase64?: string,
    aezeedPassphrase?: string
): Promise<lnrpc.InitWalletResponse> => {
    // await NativeModules.LndMobile.initWallet(seed, password, recoveryWindow ?? 0, channelBackupsBase64 ?? null);
    const options: lnrpc.IInitWalletRequest = {
        cipher_seed_mnemonic: seed,
        wallet_password: Base64Utils.stringToUint8Array(password),
        aezeed_passphrase: aezeedPassphrase
            ? Base64Utils.stringToUint8Array(aezeedPassphrase)
            : undefined
    };
    if (recoveryWindow) {
        options.recovery_window = recoveryWindow;
    }
    if (channelBackupsBase64) {
        options.channel_backups = {
            multi_chan_backup: {
                multi_chan_backup: base64.toByteArray(channelBackupsBase64)
            }
        };
    }

    const response = await sendCommand<
        lnrpc.IInitWalletRequest,
        lnrpc.InitWalletRequest,
        lnrpc.InitWalletResponse
    >({
        request: lnrpc.InitWalletRequest,
        response: lnrpc.InitWalletResponse,
        method: 'InitWallet',
        options
    });
    return response;
};

/**
 * @throws
 */
export const unlockWallet = async (
    password: string
): Promise<lnrpc.UnlockWalletResponse> => {
    const start = new Date().getTime();
    // await NativeModules.LndMobile.unlockWallet(password);
    const response = await sendCommand<
        lnrpc.IUnlockWalletRequest,
        lnrpc.UnlockWalletRequest,
        lnrpc.UnlockWalletResponse
    >({
        request: lnrpc.UnlockWalletRequest,
        response: lnrpc.UnlockWalletResponse,
        method: 'UnlockWallet',
        options: {
            wallet_password: Base64Utils.stringToUint8Array(password)
        }
    });
    console.log('unlock time: ' + (new Date().getTime() - start) / 1000 + 's');
    return response;
};

/**
 * @throws
 */
export const deriveKey = async (
    key_family: number,
    key_index: number
): Promise<signrpc.KeyDescriptor> => {
    const response = await sendCommand<
        signrpc.IKeyLocator,
        signrpc.KeyLocator,
        signrpc.KeyDescriptor
    >({
        request: signrpc.KeyLocator,
        response: signrpc.KeyDescriptor,
        method: 'WalletKitDeriveKey',
        options: {
            key_family: 138,
            key_index: 0
        }
    });
    return response;
};

/**
 * @throws
 */
export const derivePrivateKey = async (
    key_family: number,
    key_index: number
): Promise<signrpc.KeyDescriptor> => {
    const response = await sendCommand<
        signrpc.IKeyDescriptor,
        signrpc.KeyDescriptor,
        signrpc.KeyDescriptor
    >({
        request: signrpc.KeyDescriptor,
        response: signrpc.KeyDescriptor,
        method: 'WalletKitDerivePrivateKey',
        options: {
            key_loc: {
                key_family,
                key_index
            }
        }
    });
    return response;
};

/**
 * @throws
 */
export const verifyMessageNodePubkey = async (
    signature: string,
    msg: Uint8Array
): Promise<lnrpc.VerifyMessageResponse> => {
    const response = await sendCommand<
        lnrpc.IVerifyMessageRequest,
        lnrpc.VerifyMessageRequest,
        lnrpc.VerifyMessageResponse
    >({
        request: lnrpc.VerifyMessageRequest,
        response: lnrpc.VerifyMessageResponse,
        method: 'VerifyMessage',
        options: {
            signature,
            msg
        }
    });
    return response;
};

/**
 * @throws
 */
export const signMessageNodePubkey = async (
    msg: Uint8Array
): Promise<lnrpc.SignMessageResponse> => {
    const response = await sendCommand<
        lnrpc.ISignMessageRequest,
        lnrpc.SignMessageRequest,
        lnrpc.SignMessageResponse
    >({
        request: lnrpc.SignMessageRequest,
        response: lnrpc.SignMessageResponse,
        method: 'SignMessage',
        options: {
            msg
        }
    });
    return response;
};

/**
 * @throws
 */
export const signMessage = async (
    key_family: number,
    key_index: number,
    msg: Uint8Array
): Promise<signrpc.SignMessageResp> => {
    const response = await sendCommand<
        signrpc.ISignMessageReq,
        signrpc.SignMessageReq,
        signrpc.SignMessageResp
    >({
        request: signrpc.SignMessageReq,
        response: signrpc.SignMessageResp,
        method: 'SignerSignMessage',
        options: {
            key_loc: {
                key_family,
                key_index
            },
            msg
            // no_hashing: true
        }
    });
    return response;
};

// TODO exception?
// TODO move to a more appropiate file?
export const subscribeInvoices = async (): Promise<string> => {
    try {
        const response = await sendStreamCommand<
            lnrpc.IInvoiceSubscription,
            lnrpc.InvoiceSubscription
        >(
            {
                request: lnrpc.InvoiceSubscription,
                method: 'SubscribeInvoices',
                options: {}
            },
            false
        );
        return response;
    } catch (e) {
        throw e.message;
    }
};

// TODO error handling
export const decodeInvoiceResult = (data: string): lnrpc.Invoice => {
    return decodeStreamResult<lnrpc.Invoice>({
        response: lnrpc.Invoice,
        base64Result: data
    });
};
