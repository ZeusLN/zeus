import Long from 'long';

import { sendCommand, sendStreamCommand, decodeStreamResult } from './utils';
import { lnrpc, signrpc, walletrpc } from './../proto/lightning';

import Base64Utils from '../utils/Base64Utils';

// WalletKit

/**
 * @throws
 */
export const bumpFee = async ({
    outpoint,
    target_conf,
    force,
    sat_per_vbyte
}: {
    outpoint: lnrpc.OutPoint;
    target_conf?: number;
    force?: boolean;
    sat_per_vbyte?: Long;
}): Promise<walletrpc.BumpFeeResponse> => {
    const options: walletrpc.IBumpFeeRequest = {
        outpoint,
        target_conf,
        force,
        sat_per_vbyte: sat_per_vbyte ? Long.fromValue(sat_per_vbyte) : undefined
    };
    const response = await sendCommand<
        walletrpc.IBumpFeeRequest,
        walletrpc.BumpFeeRequest,
        walletrpc.BumpFeeResponse
    >({
        request: walletrpc.BumpFeeRequest,
        response: walletrpc.BumpFeeResponse,
        method: 'WalletKitBumpFee',
        options
    });
    return response;
};

/**
 * @throws
 */
export const fundPsbt = async ({
    account,
    psbt,
    raw,
    spend_unconfirmed,
    sat_per_vbyte
}: {
    account?: string;
    psbt?: Uint8Array;
    raw?: walletrpc.TxTemplate;
    spend_unconfirmed?: boolean;
    sat_per_vbyte?: Long;
}): Promise<walletrpc.FundPsbtResponse> => {
    const options: walletrpc.IFundPsbtRequest = {
        account,
        raw,
        psbt,
        spend_unconfirmed,
        sat_per_vbyte: sat_per_vbyte ? Long.fromValue(sat_per_vbyte) : undefined
    };
    const response = await sendCommand<
        walletrpc.IFundPsbtRequest,
        walletrpc.FundPsbtRequest,
        walletrpc.FundPsbtResponse
    >({
        request: walletrpc.FundPsbtRequest,
        response: walletrpc.FundPsbtResponse,
        method: 'WalletKitFundPsbt',
        options
    });
    return response;
};

/**
 * @throws
 */
export const signPsbt = async ({
    funded_psbt
}: {
    funded_psbt?: Uint8Array;
}): Promise<walletrpc.SignPsbtResponse> => {
    const options: walletrpc.ISignPsbtRequest = {
        funded_psbt
    };
    const response = await sendCommand<
        walletrpc.ISignPsbtRequest,
        walletrpc.SignPsbtRequest,
        walletrpc.SignPsbtResponse
    >({
        request: walletrpc.SignPsbtRequest,
        response: walletrpc.SignPsbtResponse,
        method: 'WalletKitSignPsbt',
        options
    });
    return response;
};

/**
 * @throws
 */
export const finalizePsbt = async ({
    funded_psbt
}: {
    funded_psbt: Uint8Array;
}): Promise<walletrpc.FinalizePsbtResponse> => {
    const options: walletrpc.IFinalizePsbtRequest = {
        funded_psbt
    };
    const response = await sendCommand<
        walletrpc.IFinalizePsbtRequest,
        walletrpc.FinalizePsbtRequest,
        walletrpc.FinalizePsbtResponse
    >({
        request: walletrpc.FinalizePsbtRequest,
        response: walletrpc.FinalizePsbtResponse,
        method: 'WalletKitFinalizePsbt',
        options
    });
    return response;
};

/**
 * @throws
 */
export const listAccounts =
    async (): Promise<walletrpc.ListAccountsResponse> => {
        const response = await sendCommand<
            walletrpc.IListAccountsRequest,
            walletrpc.ListAccountsRequest,
            walletrpc.ListAccountsResponse
        >({
            request: walletrpc.ListAccountsRequest,
            response: walletrpc.ListAccountsResponse,
            method: 'WalletKitListAccounts',
            options: {}
        });
        return response;
    };

/**
 * @throws
 */
export const importAccount = async ({
    name,
    extended_public_key,
    master_key_fingerprint,
    address_type,
    dry_run
}: {
    name: string;
    extended_public_key: string;
    master_key_fingerprint?: Uint8Array;
    address_type?: number;
    dry_run: boolean;
}): Promise<walletrpc.ImportAccountResponse> => {
    const options: walletrpc.IImportAccountRequest = {
        name,
        extended_public_key,
        master_key_fingerprint,
        address_type,
        dry_run
    };
    const response = await sendCommand<
        walletrpc.IImportAccountRequest,
        walletrpc.ImportAccountRequest,
        walletrpc.ImportAccountResponse
    >({
        request: walletrpc.ImportAccountRequest,
        response: walletrpc.ImportAccountResponse,
        method: 'WalletKitImportAccount',
        options
    });
    return response;
};

/**
 * @throws
 */
export const publishTransaction = async ({
    tx_hex
}: {
    tx_hex: Uint8Array;
}): Promise<walletrpc.PublishResponse> => {
    const options: walletrpc.ITransaction = {
        tx_hex
    };
    const response = await sendCommand<
        walletrpc.ITransaction,
        walletrpc.Transaction,
        walletrpc.PublishResponse
    >({
        request: walletrpc.Transaction,
        response: walletrpc.PublishResponse,
        method: 'WalletKitPublishTransaction',
        options
    });
    return response;
};

// Base wallet

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
                multi_chan_backup:
                    Base64Utils.base64ToBytes(channelBackupsBase64)
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
export const deriveKey = async (): Promise<signrpc.KeyDescriptor> => {
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
        method: 'DerivePrivateKey',
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
    try {
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
    } catch (error) {
        console.error('Error in verifyMessageNodePubkey:', error);
        throw error;
    }
};

/**
 * @throws
 */

export const signMessageNodePubkey = async (
    msg: Uint8Array
): Promise<lnrpc.SignMessageResponse> => {
    try {
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
    } catch (error) {
        console.error('Error in signMessageNodePubkey:', error);
        throw error;
    }
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
