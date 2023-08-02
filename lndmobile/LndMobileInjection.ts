import Long from 'long';

import {
    initialize,
    writeConfig,
    subscribeState,
    decodeState,
    checkStatus,
    startLnd,
    checkICloudEnabled,
    checkApplicationSupportExists,
    checkLndFolderExists,
    createIOSApplicationSupportAndLndDirectories,
    gossipSync,
    TEMP_moveLndToApplicationSupport,
    excludeLndICloudBackup,
    queryRoutes,
    addInvoice,
    cancelInvoice,
    connectPeer,
    disconnectPeer,
    decodePayReq,
    getRecoveryInfo,
    listUnspent,
    resetMissionControl,
    getNodeInfo,
    getNetworkInfo,
    getInfo,
    lookupInvoice,
    listPeers,
    readLndLog,
    sendPaymentSync,
    sendPaymentV2Sync,
    IReadLndLogResponse,
    listPayments,
    listInvoices,
    subscribeChannelGraph,
    sendKeysendPaymentV2
} from './index';
import {
    channelBalance,
    closeChannel,
    listChannels,
    openChannel,
    openChannelAll,
    pendingChannels,
    subscribeChannelEvents,
    channelAcceptor,
    channelAcceptorResponse,
    decodeChannelAcceptRequest,
    decodeChannelEvent,
    exportAllChannelBackups,
    abandonChannel,
    getChanInfo,
    closedChannels
} from './channel';
import {
    getTransactions,
    newAddress,
    sendCoins,
    sendCoinsAll,
    walletBalance,
    subscribeTransactions
} from './onchain';
import {
    decodeInvoiceResult,
    genSeed,
    initWallet,
    subscribeInvoices,
    unlockWallet,
    deriveKey,
    derivePrivateKey,
    verifyMessageNodePubkey,
    signMessage,
    signMessageNodePubkey
} from './wallet';
import { status, modifyStatus, queryScores, setScores } from './autopilot';
import { checkScheduledSyncWorkStatus } from './scheduled-sync'; // TODO(hsjoberg): This could be its own injection "LndMobileScheduledSync"
import {
    lnrpc,
    signrpc,
    invoicesrpc,
    autopilotrpc,
    routerrpc
} from './../proto/lightning';
import { WorkInfo } from './LndMobile';
import { checkScheduledGossipSyncWorkStatus } from '../lndmobile/scheduled-gossip-sync';

export interface ILndMobileInjections {
    index: {
        initialize: () => Promise<{ data: string } | number>;
        writeConfig: (config: string) => Promise<string>;
        subscribeState: () => Promise<string>;
        decodeState: (data: string) => lnrpc.SubscribeStateResponse;
        checkStatus: () => Promise<number>;
        startLnd: (args: string) => Promise<string>;
        gossipSync: (networkType: string) => Promise<{ data: string }>;
        checkICloudEnabled: () => Promise<boolean>;
        checkApplicationSupportExists: () => Promise<boolean>;
        checkLndFolderExists: () => Promise<boolean>;
        createIOSApplicationSupportAndLndDirectories: () => Promise<boolean>;
        TEMP_moveLndToApplicationSupport: () => Promise<boolean>;
        excludeLndICloudBackup: () => Promise<boolean>;

        addInvoice: (
            amount: number,
            memo: string,
            expiry?: number,
            is_amp?: boolean,
            is_private?: boolean
        ) => Promise<lnrpc.AddInvoiceResponse>;
        cancelInvoice: (
            paymentHash: string
        ) => Promise<invoicesrpc.CancelInvoiceResp>;
        connectPeer: (
            pubkey: string,
            host: string
        ) => Promise<lnrpc.ConnectPeerResponse>;
        disconnectPeer: (
            pubkey: string
        ) => Promise<lnrpc.DisconnectPeerResponse>;
        decodePayReq: (bolt11: string) => Promise<lnrpc.PayReq>;
        getRecoveryInfo: () => Promise<lnrpc.GetRecoveryInfoResponse>;
        listUnspent: () => Promise<lnrpc.ListUnspentResponse>;
        resetMissionControl: () => Promise<routerrpc.ResetMissionControlResponse>;
        getInfo: () => Promise<lnrpc.GetInfoResponse>;
        getNetworkInfo: () => Promise<lnrpc.NetworkInfo>;
        getNodeInfo: (pubKey: string) => Promise<lnrpc.NodeInfo>;
        lookupInvoice: (rHash: string) => Promise<lnrpc.Invoice>;
        listPeers: () => Promise<lnrpc.ListPeersResponse>;
        listInvoices: () => Promise<lnrpc.ListInvoiceResponse>;
        readLndLog: () => Promise<IReadLndLogResponse>;
        sendPaymentSync: (
            paymentRequest: string,
            amount?: Long,
            tlvRecordName?: string | null
        ) => Promise<lnrpc.SendResponse>;
        sendPaymentV2Sync: (
            paymentRequest: string,
            amount?: Long,
            payAmount?: Long,
            tlvRecordName?: string | null,
            multiPath?: boolean,
            maxLNFeePercentage?: number
        ) => Promise<lnrpc.Payment>;
        queryRoutes: (
            pubkey: string,
            amount?: Long,
            routeHints?: lnrpc.IRouteHint[]
        ) => Promise<lnrpc.QueryRoutesResponse>;
        listPayments: () => Promise<lnrpc.ListPaymentsResponse>;
        subscribeChannelGraph: () => Promise<string>;
        sendKeysendPaymentV2: (
            destination_pub_key: string,
            sat: Long,
            dest_custom_records: any,
            payment_hash: string,
            route_hints: lnrpc.IRouteHint[],
            max_ln_fee_percentage: number
        ) => Promise<lnrpc.Payment>;
    };
    channel: {
        channelBalance: () => Promise<lnrpc.ChannelBalanceResponse>;
        channelAcceptor: () => Promise<string>;
        decodeChannelAcceptRequest: (data: any) => lnrpc.ChannelAcceptRequest;
        channelAcceptorResponse: (
            pending_chan_id: Uint8Array,
            accept: boolean,
            zero_conf?: boolean
        ) => Promise<void>;
        closeChannel: (
            fundingTxId: string,
            outputIndex: number,
            force?: boolean,
            sat_per_vbyte?: number
        ) => Promise<string>;
        listChannels: () => Promise<lnrpc.ListChannelsResponse>;
        openChannel: (
            pubkey: string,
            amount: number,
            privateChannel: boolean,
            feeRateSat?: number
        ) => Promise<lnrpc.ChannelPoint>;
        openChannelAll: (
            pubkey: string,
            privateChannel: boolean,
            feeRateSat?: number
        ) => Promise<lnrpc.ChannelPoint>;
        pendingChannels: () => Promise<lnrpc.PendingChannelsResponse>;
        closedChannels: () => Promise<lnrpc.ClosedChannelsResponse>;
        getChanInfo: (chanId: string) => Promise<lnrpc.ChannelEdge>;
        subscribeChannelEvents: () => Promise<string>;
        decodeChannelEvent: (data: string) => lnrpc.ChannelEventUpdate;
        exportAllChannelBackups: () => Promise<lnrpc.ChanBackupSnapshot>;
        abandonChannel: (
            fundingTxId: string,
            outputIndex: number
        ) => Promise<lnrpc.AbandonChannelResponse>;
    };
    onchain: {
        getTransactions: () => Promise<lnrpc.TransactionDetails>;
        newAddress: (
            type: lnrpc.AddressType
        ) => Promise<lnrpc.NewAddressResponse>;
        sendCoins: (
            address: string,
            sat: number,
            feeRate?: number,
            spend_unconfirmed?: boolean
        ) => Promise<lnrpc.SendCoinsResponse>;
        sendCoinsAll: (
            address: string,
            feeRate?: number
        ) => Promise<lnrpc.SendCoinsResponse>;
        walletBalance: () => Promise<lnrpc.WalletBalanceResponse>;
        subscribeTransactions: () => Promise<string>;
    };
    wallet: {
        decodeInvoiceResult: (data: string) => lnrpc.Invoice;
        genSeed: (
            passphrase: string | undefined
        ) => Promise<lnrpc.GenSeedResponse>;
        initWallet: (
            seed: string[],
            password: string,
            recoveryWindow?: number,
            channelBackupsBase64?: string,
            aezeedPassphrase?: string
        ) => Promise<void>;
        subscribeInvoices: () => Promise<string>;
        unlockWallet: (password: string) => Promise<void>;
        deriveKey: (
            keyFamily: number,
            keyIndex: number
        ) => Promise<signrpc.KeyDescriptor>;
        derivePrivateKey: (
            keyFamily: number,
            keyIndex: number
        ) => Promise<signrpc.KeyDescriptor>;
        verifyMessageNodePubkey: (
            signature: string,
            msg: Uint8Array
        ) => Promise<lnrpc.VerifyMessageResponse>;
        signMessage: (
            keyFamily: number,
            keyIndex: number,
            msg: Uint8Array
        ) => Promise<signrpc.SignMessageResp>;
        signMessageNodePubkey: (
            msg: Uint8Array
        ) => Promise<lnrpc.SignMessageResponse>;
    };
    autopilot: {
        status: () => Promise<autopilotrpc.StatusResponse>;
        modifyStatus: (
            enable: boolean
        ) => Promise<autopilotrpc.ModifyStatusResponse>;
        queryScores: () => Promise<autopilotrpc.QueryScoresResponse>;
        setScores: (scores: any) => Promise<autopilotrpc.SetScoresResponse>;
    };
    scheduledSync: {
        checkScheduledSyncWorkStatus: () => Promise<WorkInfo>;
    };
    scheduledGossipSync: {
        checkScheduledGossipSyncWorkStatus: () => Promise<WorkInfo>;
    };
}

export default {
    index: {
        initialize,
        writeConfig,
        checkStatus,
        subscribeState,
        decodeState,
        startLnd,
        gossipSync,
        checkICloudEnabled,
        checkApplicationSupportExists,
        checkLndFolderExists,
        createIOSApplicationSupportAndLndDirectories,
        TEMP_moveLndToApplicationSupport,
        excludeLndICloudBackup,

        addInvoice,
        cancelInvoice,
        connectPeer,
        disconnectPeer,
        decodePayReq,
        getRecoveryInfo,
        listUnspent,
        resetMissionControl,
        getNodeInfo,
        getNetworkInfo,
        getInfo,
        lookupInvoice,
        listPeers,
        readLndLog,
        sendPaymentSync,
        sendPaymentV2Sync,
        queryRoutes,
        listPayments,
        listInvoices,
        subscribeChannelGraph,
        sendKeysendPaymentV2
    },
    channel: {
        channelBalance,
        closeChannel,
        listChannels,
        openChannel,
        openChannelAll,
        pendingChannels,
        subscribeChannelEvents,
        decodeChannelEvent,
        exportAllChannelBackups,
        abandonChannel,
        channelAcceptor,
        decodeChannelAcceptRequest,
        channelAcceptorResponse,
        getChanInfo,
        closedChannels
    },
    onchain: {
        getTransactions,
        newAddress,
        sendCoins,
        sendCoinsAll,
        walletBalance,
        subscribeTransactions
    },
    wallet: {
        decodeInvoiceResult,
        genSeed,
        initWallet,
        subscribeInvoices,
        unlockWallet,
        deriveKey,
        derivePrivateKey,
        verifyMessageNodePubkey,
        signMessage,
        signMessageNodePubkey
    },
    autopilot: {
        status,
        modifyStatus,
        queryScores,
        setScores
    },
    scheduledSync: {
        checkScheduledSyncWorkStatus
    },
    scheduledGossipSync: {
        checkScheduledGossipSyncWorkStatus
    }
} as ILndMobileInjections;
