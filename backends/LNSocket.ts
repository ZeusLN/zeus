import Lnmessage from 'lnmessage';
import TcpSocket from 'react-native-tcp-socket';
import { generateSecureRandom } from 'react-native-securerandom';

import { settingsStore } from '../stores/Stores';
import TransactionRequest from '../models/TransactionRequest';
import OpenChannelRequest from '../models/OpenChannelRequest';

// lnmessage ships a TCP wrapper (SocketWrapper) that calls
// socket.connect(port, host) positionally, à la node's net.Socket.
// react-native-tcp-socket's Socket.connect only accepts an options
// object, so we adapt the signature here. Everything else
// (on/write/end) already matches the net.Socket interface.
const createTcpSocket = () => {
    const socket: any = new TcpSocket.Socket();
    const connect = socket.connect.bind(socket);
    socket.connect = (port: number, host: string) => connect({ port, host });
    return socket;
};

const generatePrivateKey = async (): Promise<string> => {
    const bytes = await generateSecureRandom(32);
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
};

// Commando/lnmessage backend for Core Lightning.
// Connects directly to the node's p2p port over TCP (no REST, no proxy)
// and issues RPCs as commando messages authenticated with a rune.
export default class LNSocket {
    ln: any;

    init = async () => {
        const { lnSocketPubkey, lnSocketPrivateKey, host, port, rune } =
            settingsStore;

        if (!lnSocketPubkey) {
            throw new Error('Node public key is not set');
        }
        if (!rune) {
            throw new Error('Rune is not set');
        }

        // A persistent local key keeps the node's view of our identity
        // stable across sessions. Generated once, stored with the node.
        let privateKey = lnSocketPrivateKey;
        if (!privateKey) {
            privateKey = await generatePrivateKey();
            await settingsStore.updateSettings((settings: any) => {
                const nodes = [...(settings.nodes || [])];
                const idx = settings.selectedNode || 0;
                nodes[idx] = {
                    ...nodes[idx],
                    lnSocketPrivateKey: privateKey
                };
                return { nodes };
            });
        }

        // host may carry an embedded port (host:port); port field wins
        const [rawHost, hostPort] = (host || '').split(':');
        const p2pPort = Number(port || hostPort || 9735);

        this.ln = new Lnmessage({
            remoteNodePublicKey: lnSocketPubkey.trim(),
            ip: rawHost,
            port: p2pPort,
            tcpSocket: createTcpSocket(),
            privateKey,
            logger: {
                info: console.log,
                warn: console.warn,
                error: console.error
            }
        });

        return this.ln;
    };

    connect = async () => {
        if (!this.ln) {
            await this.init();
        }
        return this.ln.connect();
    };

    disconnect = () => {
        if (this.ln) {
            this.ln.disconnect();
        }
    };

    isConnected = () => {
        if (!this.ln) return false;
        return this.ln.connectionStatus$?.value === 'connected';
    };

    rpc = async (method: string, params: any = {}) => {
        if (!this.ln) {
            await this.init();
        }
        const { rune } = settingsStore;
        return this.ln.commando({ method, params, rune });
    };

    getTransactions = () =>
        this.rpc('listfunds').then(({ outputs }: any) => ({
            transactions: outputs
        }));
    getChannels = () =>
        this.rpc('listpeerchannels').then(({ channels }: any) => ({
            channels: channels.map((channel: any) => ({
                active: channel.peer_connected,
                remote_pubkey: channel.peer_id,
                channel_point: channel.funding_txid,
                chan_id: channel.channel_id,
                capacity: Number(channel.total_msat / 1000).toString(),
                local_balance: Number(channel.to_us_msat / 1000).toString(),
                remote_balance: Number(
                    (channel.total_msat - channel.to_us_msat) / 1000
                ).toString(),
                total_satoshis_sent: Number(
                    channel.out_fulfilled_msat / 1000
                ).toString(),
                total_satoshis_received: Number(
                    channel.in_fulfilled_msat / 1000
                ).toString(),
                num_updates: (
                    channel.in_payments_offered + channel.out_payments_offered
                ).toString(),
                csv_delay: channel.our_to_self_delay,
                private: channel.private,
                local_chan_reserve_sat: Number(
                    channel.our_reserve_msat / 1000
                ).toString(),
                remote_chan_reserve_sat: Number(
                    channel.their_reserve_msat / 1000
                ).toString(),
                close_address: channel.close_to_addr
            }))
        }));
    getBlockchainBalance = () =>
        this.rpc('listfunds').then(({ outputs }: any) => {
            const unconf = outputs
                .filter((o: any) => o.status !== 'confirmed')
                .reduce((acc: any, o: any) => acc + o.amount_msat / 1000, 0);
            const conf = outputs
                .filter((o: any) => o.status === 'confirmed')
                .reduce((acc: any, o: any) => acc + o.amount_msat / 1000, 0);

            return {
                total_balance: conf + unconf,
                confirmed_balance: conf,
                unconfirmed_balance: unconf
            };
        });
    getLightningBalance = () =>
        this.rpc('listfunds').then(({ channels }: any) => ({
            balance: channels
                .filter((o: any) => o.state === 'CHANNELD_NORMAL')
                .reduce(
                    (acc: any, o: any) => acc + o.our_amount_msat / 1000,
                    0
                ),
            pending_open_balance: channels
                .filter((o: any) => o.state === 'CHANNELD_AWAITING_LOCKIN')
                .reduce((acc: any, o: any) => acc + o.our_amount_msat / 1000, 0)
        }));
    sendCoins = (data: TransactionRequest) =>
        this.rpc('withdraw', {
            destination: data.addr,
            feerate: `${Number(data.sat_per_byte) * 1000}perkb`,
            satoshi: data.amount
        });
    getMyNodeInfo = () => this.rpc('getinfo');
    getInvoices = () =>
        this.rpc('listinvoices', {}).then(({ invoices }: any) => ({
            invoices: invoices.map((inv: any) => ({
                memo: inv.description,
                r_preimage: inv.payment_preimage,
                r_hash: inv.payment_hash,
                value: inv.amount_msat / 1000,
                value_msat: inv.amount_msat,
                settled: inv.status === 'paid',
                creation_date: inv.expires_at,
                settle_date: inv.paid_at,
                payment_request: inv.bolt11,
                expiry: inv.expires_at,
                amt_paid: inv.amount_received_msat / 1000,
                amt_paid_sat: inv.amount_received_msat / 1000,
                amt_paid_msat: inv.amount_received_msat
            }))
        }));
    createInvoice = (data: any) =>
        this.rpc('invoice', {
            description: data.memo,
            label: 'zeus.' + Math.floor(Math.random() * 1000000),
            amount_msat: Number(data.value) * 1000,
            expiry: Math.round(Date.now() / 1000) + Number(data.expiry),
            exposeprivatechannels: true
        });
    getPayments = () =>
        this.rpc('listsendpays', {}).then(({ pays }: any) => ({
            payments: pays
        }));
    getNewAddress = () => this.rpc('newaddr');
    openChannel = (data: OpenChannelRequest) =>
        this.rpc('fundchannel', {
            id: data.node_pubkey_string,
            amount: data.satoshis,
            feerate: `${Number(data.sat_per_byte) * 1000}perkb`,
            announce: !data.privateChannel
        }).then(({ txid }: any) => ({ funding_txid_str: txid }));
    connectPeer = (data: any) =>
        this.rpc('connect', [data.addr.pubkey, data.addr.host]);
    decodePaymentRequest = (urlParams?: Array<string>) =>
        // `decodepay` was removed from modern CLN; `decode` handles bolt11
        // (and more) and returns the same amount_msat/description/expiry fields
        this.rpc('decode', [urlParams && urlParams[0]]);
    payLightningInvoice = async (data: any) => {
        // amount_msat is rejected when the invoice already carries an amount
        // ('amount_msat unnecessary') and required when it doesn't, so decode
        // the invoice first and only send amount_msat for amountless invoices.
        // `decode` replaced `decodepay` on modern CLN; fall back for old nodes.
        let decoded: any = null;
        try {
            decoded = await this.rpc('decode', [data.payment_request]);
        } catch (e: any) {
            if (
                e &&
                (e.code === -32601 || /unknown command/i.test(e.message || ''))
            ) {
                decoded = await this.rpc('decodepay', [data.payment_request]);
            } else {
                throw e;
            }
        }

        const params: any = { invstring: data.payment_request };
        if (decoded?.amount_msat === undefined && data.amt) {
            params.amount_msat = Number(data.amt) * 1000;
        }

        // `pay` is deprecated since CLN v24.11 (removal planned); prefer `xpay`
        // and fall back to `pay` on older nodes.
        try {
            return await this.rpc('xpay', params);
        } catch (e: any) {
            if (
                e &&
                (e.code === -32601 || /unknown command/i.test(e.message || ''))
            ) {
                return await this.rpc('pay', {
                    bolt11: data.payment_request,
                    amount_msat: params.amount_msat
                });
            }
            throw e;
        }
    };
    closeChannel = (urlParams?: Array<string>) =>
        this.rpc('close', {
            id: urlParams && urlParams[0],
            unilateraltimeout: urlParams && urlParams[1] ? 60 : 0
        }).then(() => ({ chan_close: { success: true } }));
    getNodeInfo = (urlParams?: Array<string>) =>
        this.rpc('listnodes', [urlParams && urlParams[0]]).then(
            ({ nodes }: any) => {
                const node = nodes[0];
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
    getFees = async () => {
        const info = await this.rpc('getinfo');

        const [listforwards, listpeerchannels, listchannels] =
            await Promise.all([
                this.rpc('listforwards'),
                this.rpc('listpeerchannels'),
                this.rpc('listchannels', { source: info.id })
            ]);

        let lastDay = 0,
            lastWeek = 0,
            lastMonth = 0;
        const now = new Date().getTime() / 1000;
        const oneDayAgo = now - 60 * 60 * 24;
        const oneWeekAgo = now - 60 * 60 * 24 * 7;
        const oneMonthAgo = now - 60 * 60 * 24 * 30;
        for (let i = listforwards.forwards.length - 1; i >= 0; i--) {
            const forward = listforwards.forwards[i];
            if (forward.status !== 'settled') {
                continue;
            }
            if (forward.resolved_time > oneDayAgo) {
                lastDay += forward.fee_msat;
                lastWeek += forward.fee_msat;
                lastMonth += forward.fee_msat;
            } else if (forward.resolved_time > oneWeekAgo) {
                lastWeek += forward.fee_msat;
                lastMonth += forward.fee_msat;
            } else if (forward.resolved_time > oneMonthAgo) {
                lastMonth += forward.fee_msat;
            } else {
                break;
            }
        }

        const channelsMap: any = {};
        for (let i = 0; i < listchannels.channels.length; i++) {
            const channel = listchannels.channels[i];
            channelsMap[channel.short_channel_id] = {
                base_fee_msat: channel.base_fee_millisatoshi,
                fee_rate: channel.fee_per_millionth / 1000000
            };
        }

        return {
            channel_fees: listpeerchannels.channels
                .filter(
                    ({ short_channel_id }: any) => channelsMap[short_channel_id]
                )
                .map(({ short_channel_id, channel_id, funding_txid }: any) => ({
                    chan_id: channel_id,
                    channel_point: funding_txid,
                    base_fee_msat: channelsMap[short_channel_id].base_fee_msat,
                    fee_rate: channelsMap[short_channel_id].fee_rate
                })),
            day_fee_sum: lastDay / 1000,
            week_fee_sum: lastWeek / 1000,
            month_fee_sum: lastMonth / 1000
        };
    };
    setFees = (data: any) =>
        this.rpc('setchannelfee', {
            id: data.global ? 'all' : data.channelId,
            base: data.base_fee_msat,
            ppm: data.fee_rate * 1000000
        });
    getRoutes = async (urlParams?: Array<string>) => {
        const msatoshi = Number(urlParams && urlParams[1]) * 1000;

        const res = await this.rpc('getroute', {
            id: urlParams && urlParams[0],
            amount_msat: msatoshi,
            riskfactor: 2
        });

        const route = res.route;

        return {
            routes: [
                {
                    total_fees: (route[0].amount_msat - msatoshi) / 1000
                }
            ]
        };
    };

    supportsMessageSigning = () => false;
    supportsOnchainSends = () => true;
    supportsOnchainReceiving = () => true;
    supportsKeysend = () => false;
    supportsChannelManagement = () => true;
    supportsMPP = () => false;
    supportsAMP = () => false;
    supportsCoinControl = () => false;
    supportsHopPicking = () => false;
    supportsAccounts = () => false;
    supportsRouting = () => true;
    supportsNodeInfo = () => true;
    singleFeesEarnedTotal = () => false;
    supportsAddressTypeSelection = () => false;
    supportsTaproot = () => false;
    supportsOffers = () => false;
    supportsBolt11Import = () => true;
    isLNDBased = () => false;
}
