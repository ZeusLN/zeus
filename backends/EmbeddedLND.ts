import LND from './LND';
import OpenChannelRequest from '../models/OpenChannelRequest';
import Base64Utils from './../utils/Base64Utils';

import lndMobile from '../lndmobile/LndMobileInjection';

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
    queryRoutes
} = lndMobile.index;
const {
    channelBalance,
    getChanInfo,
    listChannels,
    pendingChannels,
    closedChannels,
    closeChannel,
    openChannel
} = lndMobile.channel;
const { signMessageNodePubkey, verifyMessageNodePubkey, bumpFee } =
    lndMobile.wallet;
const { walletBalance, newAddress, getTransactions, sendCoins } =
    lndMobile.onchain;

export default class EmbeddedLND extends LND {
    getTransactions = async () => await getTransactions();
    getChannels = async () => await listChannels();
    getPendingChannels = async () => await pendingChannels();
    getClosedChannels = async () => await closedChannels();
    getChannelInfo = async (chanId: string) => await getChanInfo(chanId);
    getBlockchainBalance = async () => await walletBalance();
    getLightningBalance = async () => await channelBalance();
    sendCoins = async (data: any) =>
        await sendCoins(
            data.addr,
            data.amount,
            data.sat_per_vbyte,
            data.spend_unconfirmed
        );
    getMyNodeInfo = async () => await getInfo();
    getNetworkInfo = async () => await getNetworkInfo();
    getInvoices = async () => await listInvoices();
    createInvoice = async (data: any) =>
        await addInvoice(
            Number(data.value),
            data.memo,
            data.expiry,
            data.is_amp,
            data.private
        );
    getPayments = async () => await listPayments();
    getNewAddress = async (data: any) => await newAddress(data.type);
    openChannel = async (data: OpenChannelRequest) =>
        await openChannel(
            data.node_pubkey_string,
            Number(data.local_funding_amount),
            data.privateChannel || false,
            data.sat_per_vbyte ? Number(data.sat_per_vbyte) : undefined,
            data.scidAlias,
            data.min_confs,
            data.spend_unconfirmed,
            data.simpleTaprootChannel
        );
    connectPeer = async (data: any) =>
        await connectPeer(data.addr.pubkey, data.addr.host, data.perm);
    decodePaymentRequest = async (urlParams?: string[]) =>
        await decodePayReq(urlParams && urlParams[0]);
    payLightningInvoice = async (data: any) => {
        const sendPaymentReq = {
            payment_request: data.payment_request,
            payment_hash: data.payment_hash,
            amt: data?.amt,
            max_parts: data?.max_parts,
            max_shard_amt: data?.max_shard_amt,
            fee_limit_sat: data?.fee_limit_sat || 0,
            outgoing_chan_id: data?.outgoing_chan_id,
            last_hop_pubkey: data?.last_hop_pubkey
                ? Base64Utils.base64ToHex(data?.last_hop_pubkey)
                : undefined,
            message: data?.message
                ? Base64Utils.hexToBase64(
                      Base64Utils.utf8ToHexString(data?.message)
                  )
                : undefined,
            amp: data?.amp,
            timeout_seconds: 60,
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
            urlParams && urlParams[3] ? Number(urlParams[3]) : undefined;

        await closeChannel(fundingTxId, outputIndex, force, sat_per_vbyte);
    };

    getNodeInfo = async (urlParams?: Array<string>) =>
        await getNodeInfo(urlParams[0]);
    signMessage = async (msg: Uint8Array) => {
        return await signMessageNodePubkey(Base64Utils.stringToUint8Array(msg));
    };
    verifyMessage = async (data: any) => {
        const { signature, msg } = data;
        return await verifyMessageNodePubkey(
            signature,
            Base64Utils.stringToUint8Array(msg)
        );
    };

    // getFees = () => N/A;
    // setFees = () => N/A;
    getRoutes = async (urlParams?: Array<string>) =>
        urlParams && (await queryRoutes(urlParams[0], urlParams[1]));
    // getForwardingHistory = () => N/A
    // // Coin Control
    // fundPsbt = (data: any) => this.postRequest('/v2/wallet/psbt/fund', data);
    // finalizePsbt = (data: any) =>
    //     this.postRequest('/v2/wallet/psbt/finalize', data);
    // publishTransaction = (data: any) => this.postRequest('/v2/wallet/tx', data);
    getUTXOs = async () => await listUnspent();
    bumpFee = async (data: any) => await bumpFee(data);

    // TODO inject
    // listAccounts = () => this.getRequest('/v2/wallet/accounts');
    // TODO inject
    // importAccount = (data: any) =>
    //     this.postRequest('/v2/wallet/accounts/import', data);

    // TODO rewrite subscription logic, starting on Receive view
    // subscribeInvoice = (r_hash: string) =>
    //     this.getRequest(`/v2/invoices/subscribe/${r_hash}`);
    // subscribeTransactions = () => this.getRequest('/v1/transactions/subscribe');
    // initChannelAcceptor = async (callback: any) =>
    //     await channelAcceptor(callback);

    supportsMessageSigning = () => true;
    supportsLnurlAuth = () => true;
    supportsOnchainSends = () => true;
    supportsOnchainReceiving = () => true;
    supportsKeysend = () => true;
    supportsChannelManagement = () => true;
    supportsPendingChannels = () => true;
    supportsMPP = () => this.supports('v0.10.0');
    supportsAMP = () => this.supports('v0.13.0');
    supportsCoinControl = () => this.supports('v0.12.0');
    supportsHopPicking = () => this.supports('v0.11.0');
    // TODO wire up accounts
    // supportsAccounts = () => this.supports('v0.13.0');
    supportsAccounts = () => false;
    supportsRouting = () => false;
    supportsNodeInfo = () => true;
    singleFeesEarnedTotal = () => false;
    supportsAddressTypeSelection = () => true;
    supportsTaproot = () => this.supports('v0.15.0');
    supportsBumpFee = () => true;
    supportsLSPs = () => true;
    supportsNetworkInfo = () => true;
    supportsSimpleTaprootChannels = () => this.supports('v0.16.99');
    isLNDBased = () => true;
}
