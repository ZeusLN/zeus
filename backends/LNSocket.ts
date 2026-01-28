import { Platform } from 'react-native';
// @ts-ignore
import Lnmessage, { createReactNativeTcpSocket } from 'lnmessage';
import TcpSocket from 'react-native-tcp-socket';
import BigNumber from 'bignumber.js';
import Base64Utils from '../utils/Base64Utils';
import { Hash as sha256Hash } from 'fast-sha256';
import AddressUtils from '../utils/AddressUtils';

import TransactionRequest from './../models/TransactionRequest';
import OpenChannelRequest from './../models/OpenChannelRequest';
import { settingsStore } from '../stores/Stores';

const parseHostPort = (host: string, defaultPort: number = 9735) => {
    const parts = host.split(':');
    if (parts.length === 2) {
        return {
            host: parts[0],
            port: parseInt(parts[1], 10) || defaultPort
        };
    }
    return {
        host,
        port: defaultPort
    };
};

export default class LnSocket {
    ln: any;

    init = async () => {
        const { pubkey, host } = settingsStore;
        const { host: parsedHost, port } = parseHostPort(host || '', 9735);

        let tcpSocket;
        if (Platform.OS !== 'web') {
            tcpSocket = createReactNativeTcpSocket(TcpSocket);
        }

        this.ln = new Lnmessage({
            remoteNodePublicKey: pubkey,
            ip: parsedHost,
            port,
            tcpSocket,
            privateKey:
                '31e9739c0d6a2eba36168dd364841cc01d3f4fde221d256e6a781a4dd46715ea',
            logger: {
                info: console.log,
                warn: console.warn,
                error: console.error
            }
        });

        return this.ln;
    };

    connect = async () => await this.ln.connect();

    disconnect = () => this.ln.disconnect();

    rpc = async (method: string, params = {}) => {
        const { rune } = settingsStore;
        const res = await this.ln.commando({ method, params, rune });
        return res;
    };

    getTransactions = async () => {
        const sqlQuery =
            "SELECT account, tag, outpoint, credit_msat, debit_msat, timestamp, blockheight FROM bkpr_accountevents WHERE (tag='deposit' OR tag='to_them' OR tag='channel_open' OR tag='channel_close') ORDER BY timestamp DESC LIMIT 150";

        const results = await Promise.allSettled([
            this.rpc('sql', { query: sqlQuery.trim() }),
            this.rpc('listtransactions'),
            this.rpc('getinfo')
        ]);
        const [sqlResult, listTxsResult, getinfoResult]: any = results;

        if (getinfoResult.status !== 'fulfilled') {
            return { transactions: [] };
        }

        const getinfo = getinfoResult.value;
        const allTxs =
            sqlResult.status === 'fulfilled' ? sqlResult.value : { rows: [] };

        listTxsResult?.value?.transactions?.forEach((tx: any) => {
            const addresses: Array<string> = [];
            tx.outputs?.forEach((output: any) => {
                try {
                    const address = AddressUtils.scriptPubKeyToAddress(
                        output.scriptPubKey
                    );
                    if (address) addresses.push(address);
                } catch (e) {}
            });
            tx.dest_addresses = addresses;
        });

        const walletTxs =
            allTxs.rows?.filter(
                (tx: any) =>
                    !!tx[1] &&
                    tx[1] === 'deposit' &&
                    !!tx[0] &&
                    tx[0] === 'wallet'
            ) || [];

        const externalTxs =
            allTxs.rows?.filter(
                (tx: any) =>
                    !!tx[1] &&
                    tx[1] === 'deposit' &&
                    !!tx[0] &&
                    tx[0] === 'external'
            ) || [];

        const listTxs =
            listTxsResult.status === 'fulfilled'
                ? listTxsResult.value
                : { transactions: [] };

        const transactions = (listTxs.transactions || [])
            .map((tx: any) => {
                const withdrawal = externalTxs.find((n: any) => {
                    const txid = n[2] ? n[2].split(':')[0] : null;

                    const isChannelChange = allTxs.rows?.find((c: any) => {
                        if (!c[2]) {
                            return undefined;
                        }

                        return (
                            c[2].split(':')[0] === tx.hash &&
                            (c[1] === 'channel_open' ||
                                c[1] === 'channel_close')
                        );
                    });

                    if (isChannelChange) {
                        return undefined;
                    }

                    return txid === tx.hash;
                });

                const deposit = walletTxs.find((n: any) => {
                    const txid = n[2] ? n[2].split(':')[0] : null;

                    const isChannelChange = allTxs.rows?.find((c: any) => {
                        if (!c[2]) {
                            return undefined;
                        }

                        return (
                            c[2].split(':')[0] === tx.hash &&
                            (c[1] === 'channel_open' ||
                                c[1] === 'channel_close')
                        );
                    });

                    if (isChannelChange) {
                        return undefined;
                    }

                    return txid === tx.hash;
                });

                if (withdrawal) {
                    return {
                        amount: -Math.abs(withdrawal[3]) / 1000,
                        block_height: withdrawal[6],
                        num_confirmations: getinfo.blockheight - withdrawal[6],
                        time_stamp: withdrawal[5],
                        txid: tx.hash,
                        dest_addresses: tx.dest_addresses
                    };
                }

                if (deposit) {
                    return {
                        amount: deposit[3] / 1000,
                        block_height: deposit[6],
                        num_confirmations: getinfo.blockheight - deposit[6],
                        time_stamp: deposit[5],
                        txid: tx.hash,
                        dest_addresses: tx.dest_addresses
                    };
                }

                return null;
            })
            .filter((n: any) => !!n);

        transactions.sort((a: any, b: any) => b.time_stamp - a.time_stamp);

        return {
            transactions
        };
    };
    getChannels = async () => {
        const data = await this.rpc('listpeerchannels');
        const formattedChannels = (data.channels || [])
            .map((peer: any) => {
                if (
                    peer.state === 'ONCHAIN' ||
                    peer.state === 'CLOSED' ||
                    peer.state === 'CHANNELD_AWAITING_LOCKIN'
                ) {
                    return;
                }

                return {
                    active: peer.peer_connected,
                    remote_pubkey: peer.peer_id,
                    channel_point: peer.funding_txid,
                    chan_id: peer.channel_id,
                    short_channel_id: peer.short_channel_id,
                    capacity: Number(peer.total_msat / 1000).toString(),
                    local_balance: Number(peer.to_us_msat / 1000).toString(),
                    remote_balance: Number(
                        (peer.total_msat - peer.to_us_msat) / 1000
                    ).toString(),
                    total_satoshis_sent: Number(
                        peer.out_fulfilled_msat / 1000
                    ).toString(),
                    total_satoshis_received: Number(
                        peer.in_fulfilled_msat / 1000
                    ).toString(),
                    num_updates: (
                        peer.in_payments_offered + peer.out_payments_offered
                    ).toString(),
                    csv_delay: peer.our_to_self_delay,
                    private: peer.private,
                    local_chan_reserve_sat: Number(
                        peer.our_reserve_msat / 1000
                    ).toString(),
                    remote_chan_reserve_sat: Number(
                        peer.their_reserve_msat / 1000
                    ).toString(),
                    close_address: peer.close_to_addr
                };
            })
            .filter((n: any) => !!n);

        const channelsWithAliases = await Promise.all(
            formattedChannels.map(async (n: any) => {
                try {
                    const { nodes } = await this.rpc('listnodes', {
                        id: n.remote_pubkey
                    });

                    if (nodes && nodes.length) {
                        n.alias = nodes[0].alias || '';
                    } else {
                        n.alias = '';
                    }
                } catch (e) {
                    n.alias = '';
                }

                return n;
            })
        );

        return { channels: channelsWithAliases };
    };
    getBlockchainBalance = () =>
        this.rpc('listfunds').then(({ outputs }: any) => {
            let confBalance = 0;
            let unconfBalance = 0;

            const opArray = outputs || [];
            for (let i = 0; i < opArray.length; i++) {
                if (opArray[i].status === 'confirmed') {
                    confBalance = confBalance + opArray[i].amount_msat / 1000;
                } else if (opArray[i].status === 'unconfirmed') {
                    unconfBalance =
                        unconfBalance + opArray[i].amount_msat / 1000;
                }
            }

            return {
                total_balance: confBalance + unconfBalance,
                confirmed_balance: confBalance,
                unconfirmed_balance: unconfBalance
            };
        });
    getLightningBalance = () =>
        this.rpc('listfunds').then(({ channels }: any) => {
            let localBalance = 0;
            let pendingBalance = 0;

            const chanArray = channels || [];
            for (let i = 0; i < chanArray.length; i++) {
                if (
                    chanArray[i].state === 'CHANNELD_NORMAL' &&
                    chanArray[i].connected === true
                ) {
                    localBalance =
                        localBalance + chanArray[i].our_amount_msat / 1000;
                } else if (
                    chanArray[i].state === 'CHANNELD_AWAITING_LOCKIN' ||
                    chanArray[i].state === 'DUALOPEND_AWAITING_LOCKIN'
                ) {
                    pendingBalance =
                        pendingBalance + chanArray[i].our_amount_msat / 1000;
                }
            }

            return {
                balance: localBalance,
                pending_open_balance: pendingBalance
            };
        });
    sendCoins = (data: TransactionRequest) => {
        let request: any;
        if (data.utxos) {
            request = {
                destination: data.addr,
                feerate: `${
                    Number(data.sat_per_vbyte || data.sat_per_byte) * 1000
                }perkb`,
                satoshi: data.amount,
                utxos: data.utxos
            };
        } else {
            request = {
                destination: data.addr,
                feerate: `${
                    Number(data.sat_per_vbyte || data.sat_per_byte) * 1000
                }perkb`,
                satoshi: data.amount
            };
        }
        return this.rpc('withdraw', request);
    };
    getMyNodeInfo = () => this.rpc('getinfo');
    getInvoices = async (data?: any) => {
        const sqlQuery = `SELECT label, bolt11, bolt12, payment_hash, amount_msat, status, amount_received_msat, paid_at, payment_preimage, description, expires_at FROM invoices WHERE status = 'paid' ORDER BY created_index DESC LIMIT ${
            data?.limit ? data.limit : 150
        };`;

        const result = await this.rpc('sql', { query: sqlQuery.trim() });
        const invoiceList: any[] = [];
        (result.rows || []).forEach((invoice: any) => {
            invoiceList.push({
                label: invoice[0],
                bolt11: invoice[1],
                payment_hash: invoice[3],
                amount_msat: invoice[4],
                status: invoice[5],
                amount_received_msat: invoice[6],
                paid_at: invoice[7],
                payment_preimage: invoice[8],
                description: invoice[9],
                expires_at: invoice[10],
                bolt12: invoice[2]
            });
        });

        return {
            invoices: invoiceList
        };
    };
    createInvoice = (data: any) =>
        this.rpc('invoice', {
            description: data.memo,
            label: 'zeus.' + Math.random() * 1000000,
            amount_msat: data.value != 0 ? Number(data.value) * 1000 : 'any',
            expiry: Number(data.expiry_seconds || data.expiry),
            exposeprivatechannels: true
        });
    getPayments = async () => {
        const sqlQuery =
            "select sp.payment_hash, sp.groupid, min(sp.status) as status, min(sp.destination) as destination, min(sp.created_at) as created_at, min(sp.description) as description, min(sp.bolt11) as bolt11, min(sp.bolt12) as bolt12, sum(case when sp.status = 'complete' then sp.amount_sent_msat else null end) as amount_sent_msat, sum(case when sp.status = 'complete' then sp.amount_msat else 0 end) as amount_msat, max(sp.payment_preimage) as preimage from sendpays sp group by sp.payment_hash, sp.groupid order by created_index desc limit 150";

        const result = await this.rpc('sql', { query: sqlQuery.trim() });
        const paymentList: any[] = [];
        (result.rows || []).forEach((pay: any) => {
            paymentList.push({
                payment_hash: pay[0],
                groupid: pay[1],
                status: pay[2],
                destination: pay[3],
                created_at: pay[4],
                description: pay[5],
                bolt11: pay[6],
                bolt12: pay[7],
                amount_sent_msat: pay[8],
                amount_msat: pay[9],
                preimage: pay[10]
            });
        });

        return {
            payments: paymentList
        };
    };
    getNewAddress = (data: any) => {
        let addresstype: string | undefined;

        switch (data?.type) {
            case '0':
                addresstype = 'bech32';
                break;
            case '4':
                addresstype = 'p2tr';
                break;
            default:
                addresstype = undefined;
        }

        const params = addresstype ? { addresstype } : {};
        return this.rpc('newaddr', params);
    };
    openChannel = (data: OpenChannelRequest) => {
        const feeRate = `${new BigNumber(
            data.sat_per_vbyte || data.sat_per_byte || 0
        )
            .times(1000)
            .toString()}perkb`;

        const request: any = {
            id: data.id || data.node_pubkey_string,
            amount: data.fundMax ? 'all' : data.satoshis,
            feerate: feeRate,
            announce: !data.privateChannel ? true : false,
            minconf: data.min_confs
        };

        if (data.utxos && data.utxos.length > 0) request.utxos = data.utxos;

        return this.rpc('fundchannel', request).then(({ txid }: any) => ({
            funding_txid_str: txid
        }));
    };
    openChannelSync = (data: OpenChannelRequest) => this.openChannel(data);
    connectPeer = (data: any) => {
        const [host, port] = data.addr.host.split(':');
        return this.rpc('connect', {
            id: data.addr.pubkey,
            host,
            port
        });
    };
    decodePaymentRequest = (urlParams?: Array<string>) =>
        this.rpc('decodepay', { string: urlParams && urlParams[0] });
    payLightningInvoice = (data: any) =>
        this.rpc('pay', {
            bolt11: data.payment_request,
            amount_msat: Number(data.amt && data.amt * 1000),
            maxfeepercent: data.max_fee_percent,
            retry_for: data.timeout_seconds
        });
    closeChannel = (urlParams?: Array<string>) => {
        const request = {
            id: urlParams && urlParams[0],
            unilateraltimeout: urlParams && urlParams[1] ? 2 : 0
        };
        return this.rpc('close', request);
    };
    getNodeInfo = (urlParams?: Array<string>) =>
        this.rpc('listnodes', { id: urlParams && urlParams[0] }).then(
            ({ nodes }: any) => {
                const node = nodes && nodes[0];
                return {
                    node: node && {
                        last_update: node.last_timestamp,
                        pub_key: node.nodeid,
                        alias: node.alias,
                        color: node.color,
                        addresses: (node.addresses || []).map((addr: any) => ({
                            network: 'tcp',
                            addr:
                                addr.type === 'ipv6'
                                    ? `[${addr.address}]:${addr.port}`
                                    : `${addr.address}:${addr.port}`
                        }))
                    }
                };
            }
        );
    getFees = () =>
        this.rpc('getinfo').then((res: any) => ({
            total_fee_sum: res.fees_collected_msat / 1000
        }));
    setFees = (data: any) =>
        this.rpc('setchannel', {
            id: data.global ? 'all' : data.channelId,
            feebase: data.base_fee_msat,
            feeppm: data.fee_rate * 1000000
        });
    getRoutes = ({
        source,
        destination,
        amount_msat,
        layers,
        maxfee_msat,
        final_cltv
    }: {
        source: string;
        destination: string;
        amount_msat: number;
        layers?: string[];
        maxfee_msat?: number;
        final_cltv?: number;
    }) => {
        return this.rpc('getroutes', {
            source,
            destination,
            amount_msat,
            layers,
            maxfee_msat,
            final_cltv
        });
    };

    getClosedChannels = async () => {
        const channels = await this.rpc('listclosedchannels');
        const formattedClosedChannels = (channels.closedchannels || []).map(
            (channel: any) => ({
                peer_id: channel.peer_id,
                capacity: Number(channel.total_msat / 1000).toString(),
                channel_id: channel.channel_id,
                short_channel_id: channel.short_channel_id,
                alias: channel.alias?.local || '',
                opener: channel.opener,
                closer: channel.closer,
                private: channel.private,
                channel_type: channel.channel_type?.names || [],
                funding_txid: channel.funding_txid,
                total_msat: channel.total_msat.toString(),
                to_us_msat: channel.final_to_us_msat.toString(),
                min_to_us_satoshis: Number(
                    channel.min_to_us_msat / 1000
                ).toString(),
                max_to_us_satoshis: Number(
                    channel.max_to_us_msat / 1000
                ).toString(),
                total_htlcs_sent: channel.total_htlcs_sent.toString(),
                close_cause: channel.close_cause,
                last_commitment_fee_satoshis: Number(
                    channel.last_commitment_fee_msat / 1000
                ).toString(),
                last_stable_connection: channel.last_stable_connection
            })
        );

        return { channels: formattedClosedChannels };
    };

    getNode = (data: any) =>
        this.rpc('listnodes', { id: data.id }).then((res) => {
            return res;
        });

    listPeers = async () => {
        const data = await this.rpc('listpeers');
        const formattedPeers = (data.peers || []).map((peer: any) => {
            return {
                id: peer.id,
                connected: peer.connected,
                num_channels: peer.num_channels,
                netaddr: peer.netaddr,
                features: peer.features
            };
        });
        const peersWithAliases = await Promise.all(
            formattedPeers.map(async (n: any) => {
                try {
                    const { nodes } = await this.rpc('listnodes', { id: n.id });

                    if (nodes && nodes.length) {
                        n.alias = nodes[0].alias || '';
                    } else {
                        n.alias = '';
                    }
                } catch (e) {
                    n.alias = '';
                }

                return n;
            })
        );

        return { peersWithAliases };
    };

    disconnectPeer = async (pubkey: string) => {
        try {
            await this.rpc('disconnect', {
                id: pubkey,
                force: true
            });
            return true;
        } catch (error) {
            console.error(`Error disconnecting peer ${pubkey}:`, error);
            return null;
        }
    };

    getChannelInfo = (shortChanId: string) => {
        return this.rpc('listchannels', {
            short_channel_id: shortChanId
        });
    };

    getUTXOs = () => this.rpc('listfunds');

    sendKeysend = (data: any) => {
        return this.rpc('keysend', {
            destination: data.pubkey,
            amount_msat: Number(data.amt && data.amt * 1000),
            maxfeepercent: data.max_fee_percent,
            retry_for: data.timeout_seconds
        });
    };

    signMessage = (message: string) =>
        this.rpc('signmessage', {
            message
        });

    verifyMessage = (data: any) =>
        this.rpc('checkmessage', {
            message: data.msg,
            zbase: data.signature
        });

    lnurlAuth = async (r_hash: string) => {
        const signed = await this.signMessage(r_hash);
        return {
            signature: new sha256Hash()
                .update(Base64Utils.stringToUint8Array(signed.signature))
                .digest()
        };
    };

    getForwardingHistory = (
        _hours?: number,
        _chanIdIn?: string,
        _chanIdOut?: string
    ) => {
        return this.rpc('listforwards', {
            status: 'settled',
            limit: 10000000,
            index: 'created'
        });
    };

    listOffers = () => this.rpc('listoffers', { active_only: true });

    createWithdrawalRequest = ({
        amount,
        description
    }: {
        amount: string;
        description: string;
    }) => {
        return this.rpc('invoicerequest', {
            amount: Number(amount),
            description
        });
    };

    redeemWithdrawalRequest = ({
        invreq,
        label
    }: {
        invreq: string;
        label: string;
    }) => {
        return this.rpc('sendinvoice', {
            invreq,
            label
        });
    };

    createOffer = ({
        description,
        label,
        singleUse
    }: {
        description?: string;
        label?: string;
        singleUse?: boolean;
    }) =>
        this.rpc('offer', {
            amount: 'any',
            description,
            label,
            single_use: singleUse || false
        });

    disableOffer = ({ offer_id }: { offer_id: string }) =>
        this.rpc('disableoffer', { offer_id });

    fetchInvoiceFromOffer = async (bolt12: string, amountSatoshis: string) => {
        return await this.rpc('fetchinvoice', {
            offer: bolt12,
            amount_msat: Number(amountSatoshis) * 1000,
            timeout: 60
        });
    };

    askReneCreateLayer = ({ layer }: { layer: string }) => {
        return this.rpc('askrene-create-layer', { layer });
    };

    askReneUpdateChannel = ({
        short_channel_id_dir,
        layer,
        enabled = false
    }: {
        short_channel_id_dir: string;
        layer: string;
        enabled?: boolean;
    }) => {
        return this.rpc('askrene-update-channel', {
            short_channel_id_dir,
            layer,
            enabled
        });
    };

    askReneRemoveLayer = ({ layer }: { layer: string }) => {
        return this.rpc('askrene-remove-layer', { layer });
    };

    sendPay = ({
        route,
        payment_hash,
        payment_secret,
        bolt11
    }: {
        route: any[];
        payment_hash: string;
        payment_secret?: string;
        bolt11?: string;
    }) => {
        const params: any = {
            route,
            payment_hash
        };

        if (payment_secret) {
            params.payment_secret = payment_secret;
        }

        if (bolt11) {
            params.bolt11 = bolt11;
        }

        return this.rpc('sendpay', params);
    };

    waitSendPay = ({
        payment_hash,
        timeout
    }: {
        payment_hash: string;
        timeout?: number;
    }) => {
        const params: any = {
            payment_hash
        };

        if (timeout) {
            params.timeout = timeout;
        }

        return this.rpc('waitsendpay', params);
    };

    supportsPeers = () => true;
    supportsMessageSigning = () => true;
    supportsAddressMessageSigning = () => false;
    supportsLnurlAuth = () => true;
    supportsOnchainBalance = () => true;
    supportsOnchainSends = () => true;
    supportsOnchainReceiving = () => true;
    supportsLightningSends = () => true;
    supportsKeysend = () => true;
    supportsChannelManagement = () => true;
    supportsPendingChannels = () => false;
    supportsClosedChannels = () => true;
    supportsMPP = () => false;
    supportsAMP = () => false;
    supportsCoinControl = () => true;
    supportsChannelCoinControl = () => true;
    supportsHopPicking = () => false;
    supportsWithdrawalRequests = () => true;
    supportsAccounts = () => false;
    supportsRouting = () => true;
    supportsNodeInfo = () => true;
    singleFeesEarnedTotal = () => false;
    supportsAddressTypeSelection = () => true;
    supportsNestedSegWit = () => false;
    supportsTaproot = () => true;
    supportsBumpFee = () => false;
    supportsFlowLSP = () => false;
    supportsNetworkInfo = () => false;
    supportsSimpleTaprootChannels = () => false;
    supportsCustomPreimages = () => false;
    supportsSweep = () => true;
    supportsOnchainSendMax = () => true;
    supportsOnchainBatching = () => false;
    supportsChannelBatching = () => false;
    supportsChannelFundMax = () => true;
    supportsLSPScustomMessage = () => false;
    supportsLSPS1rest = () => true;
    supportsBolt11BlindedRoutes = () => false;
    supportsAddressesWithDerivationPaths = () => false;
    supportsOffers = () => true;
    isLNDBased = () => false;
    supportsForwardingHistory = () => true;
    supportInboundFees = () => false;
    supportsDevTools = () => true;
    supportsCashuWallet = () => false;
    supportsSettingInvoiceExpiration = () => true;
    supportsNostrWalletConnectService = () => true;
}
