import LND from './LND';
import OpenChannelRequest from '../models/OpenChannelRequest';
import Base64Utils from './../utils/Base64Utils';

import lndMobile from '../lndmobile/LndMobileInjection';

import {
    checkLndStreamErrorResponse,
    LndMobileEventEmitter
} from '../utils/LndMobileUtils';

const {
    addInvoice,
    getInfo,
    connectPeer,
    listInvoices,
    listUnspent,
    getNodeInfo,
    decodePayReq,
    sendPaymentV2Sync,
    sendKeysendPaymentV2,
    listPayments,
    getNetworkInfo,
    getRecoveryInfo,
    queryRoutes,
    lookupInvoice,
    fundingStateStep,
    sendCustomMessage,
    subscribeCustomMessages
} = lndMobile.index;
const {
    channelBalance,
    getChanInfo,
    listChannels,
    pendingChannels,
    closedChannels,
    closeChannel,
    openChannel,
    openChannelSync,
    decodeOpenStatusUpdate
} = lndMobile.channel;
const {
    signMessageNodePubkey,
    verifyMessageNodePubkey,
    bumpFee,
    bumpForceCloseFee,
    fundPsbt,
    signPsbt,
    finalizePsbt,
    publishTransaction,
    listAccounts,
    listAddresses,
    importAccount,
    rescan
} = lndMobile.wallet;
const {
    walletBalance,
    newAddress,
    newChangeAddress,
    getTransactions,
    sendCoins
} = lndMobile.onchain;

import {
    signMessageWithAddr as signMsgWithAddr,
    verifyMessageWithAddr as verifyMsgWithAddr
} from '../lndmobile/wallet';

export default class EmbeddedLND extends LND {
    openChannelListener: any;

    getTransactions = async () => await getTransactions();
    getChannels = async () => await listChannels();
    getPendingChannels = async () => await pendingChannels();
    getClosedChannels = async () => await closedChannels();
    getChannelInfo = async (chanId: string) => await getChanInfo(chanId);
    getBlockchainBalance = async (data: any) => await walletBalance(data);
    getLightningBalance = async () => await channelBalance();
    sendCoins = async (data: any) =>
        await sendCoins(
            data.addr,
            data.amount,
            data.sat_per_vbyte,
            data.spend_unconfirmed,
            data.send_all,
            data.outpoints
        );
    sendCustomMessage = async (data: any) =>
        await sendCustomMessage(data.peer, data.type, data.data);
    subscribeCustomMessages = async () => await subscribeCustomMessages();
    getMyNodeInfo = async () => await getInfo();
    getNetworkInfo = async () => await getNetworkInfo();
    getRecoveryInfo = async () => await getRecoveryInfo();
    getInvoices = async () => await listInvoices();
    createInvoice = async (data: any) =>
        await addInvoice({
            amount: data.value ? Number(data.value) : undefined,
            amount_msat: data.value_msat ? Number(data.value_msat) : undefined,
            memo: data.memo,
            expiry: data.expiry,
            is_amp: data.is_amp,
            is_blinded: data.is_blinded,
            is_private: data.private,
            preimage: data.preimage,
            route_hints: data.route_hints
        });
    getPayments = async (params?: {
        maxPayments?: number;
        reversed?: boolean;
    }) => await listPayments(params);
    getNewAddress = async (data: any) =>
        await newAddress(data.type, data.account);
    getNewChangeAddress = async (data: any) =>
        await newChangeAddress(data.type, data.account);
    openChannelSync = async (data: OpenChannelRequest) =>
        await openChannelSync(
            data.node_pubkey_string,
            Number(data.local_funding_amount),
            data.privateChannel || false,
            data.sat_per_vbyte ? Number(data.sat_per_vbyte) : undefined,
            data.scidAlias,
            data.min_confs,
            data.spend_unconfirmed,
            data.simpleTaprootChannel,
            data.fundMax,
            data.utxos
        );
    openChannelStream = async (data: OpenChannelRequest) => {
        return await new Promise((resolve, reject) => {
            LndMobileEventEmitter.addListener('OpenChannel', (e: any) => {
                try {
                    const error = checkLndStreamErrorResponse('OpenChannel', e);
                    if (error === 'EOF') {
                        return;
                    } else if (error) {
                        console.error('Got error from OpenChannel', [error]);
                        reject(error);
                        return;
                    }

                    const result = decodeOpenStatusUpdate(e.data);
                    if (result?.psbt_fund) {
                        resolve({ result });
                    }
                } catch (error) {
                    console.error(error);
                }
            });

            openChannel(
                data.node_pubkey_string,
                Number(data.local_funding_amount),
                data.privateChannel || false,
                data.sat_per_vbyte && !data.funding_shim
                    ? Number(data.sat_per_vbyte)
                    : undefined,
                data.scidAlias,
                data.min_confs,
                data.spend_unconfirmed,
                data.simpleTaprootChannel,
                data.fundMax,
                data.utxos,
                data.funding_shim
            );
        });
    };
    connectPeer = async (data: any) =>
        await connectPeer(data.addr.pubkey, data.addr.host, data.perm);
    decodePaymentRequest = async (urlParams?: string[]) =>
        await decodePayReq((urlParams && urlParams[0]) || '');
    payLightningInvoice = async (data: any) => {
        const sendPaymentReq = {
            payment_request: data.payment_request,
            payment_hash: data.payment_hash,
            amt: data?.amt,
            max_parts: data?.max_parts,
            max_shard_amt: data?.max_shard_amt,
            fee_limit_sat: data?.fee_limit_sat || 0,
            outgoing_chan_id: data?.outgoing_chan_id,
            last_hop_pubkey: data?.last_hop_pubkey,
            message: data?.message
                ? Base64Utils.hexToBase64(Base64Utils.utf8ToHex(data?.message))
                : undefined,
            amp: data?.amp,
            timeout_seconds: data?.timeout_seconds || 60,
            allow_self_payment: true,
            multi_path: data?.multi_path,
            max_shard_size_msat: data?.max_shard_size_msat,
            dest: data.dest
        };

        return await sendPaymentV2Sync(sendPaymentReq);
    };
    sendKeysend = async (data: any) =>
        await sendKeysendPaymentV2({
            dest: data.pubkey,
            amt: data.amt,
            dest_custom_records: data.dest_custom_records,
            payment_hash: data.payment_hash,
            fee_limit_sat: data.fee_limit_sat,
            max_shard_size_msat: data.max_shard_size_msat,
            max_parts: data.max_parts,
            cltv_limit: data.cltv_limit,
            amp: data.amp
        });
    closeChannel = async (urlParams?: Array<string>) => {
        const fundingTxId = (urlParams && urlParams[0]) || '';
        const outputIndex =
            urlParams && urlParams[1] ? Number(urlParams[1]) : 0;
        const force = urlParams && urlParams[2] ? true : false;
        const sat_per_vbyte =
            urlParams && urlParams[3] && !urlParams[2]
                ? Number(urlParams[3])
                : undefined;
        const delivery_address =
            urlParams && urlParams[4] ? urlParams[4] : undefined;

        return await closeChannel(
            fundingTxId,
            outputIndex,
            force,
            sat_per_vbyte,
            delivery_address
        );
    };

    getNodeInfo = async (urlParams?: Array<string>) =>
        await getNodeInfo((urlParams && urlParams[0]) || '');
    signMessage = async (msg: any) => {
        return await signMessageNodePubkey(Base64Utils.stringToUint8Array(msg));
    };
    verifyMessage = async (data: any) => {
        const { signature, msg } = data;
        return await verifyMessageNodePubkey(
            signature,
            Base64Utils.stringToUint8Array(msg)
        );
    };

    signMessageWithAddr = async (message: string, address: string) => {
        return await signMsgWithAddr(
            Base64Utils.stringToUint8Array(message),
            address
        );
    };
    verifyMessageWithAddr = async (
        message: string,
        signature: string,
        address: string
    ) => {
        return await verifyMsgWithAddr(
            Base64Utils.stringToUint8Array(message),
            signature,
            address
        );
    };

    getRoutes = async (urlParams?: Array<any>) =>
        urlParams && (await queryRoutes(urlParams[0], urlParams[1]));
    // getForwardingHistory = () => N/A
    // // Coin Control
    fundPsbt = async (data: any) => await fundPsbt(data);
    signPsbt = async (data: any) => await signPsbt(data);
    finalizePsbt = async (data: any) => await finalizePsbt(data);
    publishTransaction = async (data: any) => {
        if (data.tx_hex) data.tx_hex = Base64Utils.hexToBase64(data.tx_hex);
        return await publishTransaction(data);
    };
    fundingStateStep = async (data: any) => {
        // Verify
        if (
            data.psbt_finalize?.funded_psbt &&
            Base64Utils.isHex(data.psbt_finalize?.funded_psbt)
        )
            data.psbt_finalize.funded_psbt = Base64Utils.hexToBase64(
                data.psbt_finalize.funded_psbt
            );
        // Finalize
        if (
            data.psbt_finalize?.final_raw_tx &&
            Base64Utils.isHex(data.psbt_finalize?.final_raw_tx)
        )
            data.psbt_finalize.final_raw_tx = Base64Utils.hexToBase64(
                data.psbt_finalize.final_raw_tx
            );
        if (
            data.psbt_finalize?.signed_psbt &&
            Base64Utils.isHex(data.psbt_finalize?.signed_psbt)
        )
            data.psbt_finalize.signed_psbt = Base64Utils.hexToBase64(
                data.psbt_finalize.signed_psbt
            );
        return await fundingStateStep(data);
    };

    getUTXOs = async (data: any) => await listUnspent(data);
    bumpFee = async (data: any) => await bumpFee(data);
    bumpForceCloseFee = async (data: any) => await bumpForceCloseFee(data);
    lookupInvoice = async (data: any) => await lookupInvoice(data.r_hash);

    listAccounts = async () => await listAccounts();
    listAddresses = async () => await listAddresses();
    importAccount = async (data: any) => await importAccount(data);
    rescan = async (data: any) => await rescan(data);

    // TODO rewrite subscription logic, starting on Receive view
    // subscribeInvoice = (r_hash: string) =>
    //     this.getRequest(`/v2/invoices/subscribe/${r_hash}`);
    // subscribeTransactions = () => this.getRequest('/v1/transactions/subscribe');
    // initChannelAcceptor = async (callback: any) =>
    //     await channelAcceptor(callback);

    supportsAddressMessageSigning = () => true;
    supportsMessageSigning = () => true;
    supportsLnurlAuth = () => true;
    supportsOnchainSends = () => true;
    supportsOnchainReceiving = () => true;
    supportsLightningSends = () => true;
    supportsKeysend = () => true;
    supportsChannelManagement = () => true;
    supportsPendingChannels = () => true;
    supportsMPP = () => this.supports('v0.10.0');
    supportsAMP = () => this.supports('v0.13.0');
    supportsCoinControl = () => this.supports('v0.12.0');
    supportsChannelCoinControl = () => this.supports('v0.17.0');
    supportsHopPicking = () => this.supports('v0.11.0');
    supportsAccounts = () => true;
    supportsRouting = () => false;
    supportsNodeInfo = () => true;
    singleFeesEarnedTotal = () => false;
    supportsAddressTypeSelection = () => true;
    supportsTaproot = () => this.supports('v0.15.0');
    supportsBumpFee = () => true;
    supportsFlowLSP = () => true;
    supportsNetworkInfo = () => true;
    supportsSimpleTaprootChannels = () => this.supports('v0.17.0');
    supportsCustomPreimages = () => true;
    supportsSweep = () => true;
    supportsOnchainSendMax = () => this.supports('v0.18.3');
    supportsOnchainBatching = () => true;
    supportsChannelBatching = () => true;
    supportsChannelFundMax = () => true;
    supportsLSPScustomMessage = () => true;
    supportsLSPS1rest = () => false;
    supportsOffers = () => false;
    supportsBolt11BlindedRoutes = () => this.supports('v0.18.3');
    supportsAddressesWithDerivationPaths = () => this.supports('v0.18.0');
    isLNDBased = () => true;
    supportInboundFees = () => this.supports('v0.18.0');
    supportsCashuWallet = () => true;
}
