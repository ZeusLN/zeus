import RNFetchBlob from 'rn-fetch-blob';
import stores from '../stores/Stores';
import { doTorRequest, RequestMethod } from '../utils/TorUtils';
import TransactionRequest from './../models/TransactionRequest';
import OpenChannelRequest from './../models/OpenChannelRequest';

// keep track of all active calls so we can cancel when appropriate
const calls: any = {};

export default class Spark {
    rpc = (rpcmethod: string, param = {}, range: any = null) => {
        const { accessKey, certVerification, enableTor } = stores.settingsStore;
        let { url } = stores.settingsStore;

        const id = rpcmethod + JSON.stringify(param) + JSON.stringify(range);
        if (calls[id]) {
            return calls[id];
        }

        url = url.slice(-4) === '/rpc' ? url : url + '/rpc';

        const headers: any = { 'X-Access': accessKey };
        if (range) {
            headers.Range = `${range.unit}=${range.slice}`;
        }
        const body = JSON.stringify({ method: rpcmethod, params: param });

        if (enableTor === true) {
            calls[id] = doTorRequest(url, RequestMethod.POST, body, headers);
        } else {
            calls[id] = RNFetchBlob.config({
                trusty: !certVerification
            })
                .fetch('POST', url, headers, body)
                .then((response: any) => {
                    delete calls[id];
                    const status = response.info().status;
                    if (status < 300) {
                        return response.json();
                    } else {
                        let errorInfo;
                        try {
                            errorInfo = response.json();
                        } catch (err) {
                            throw new Error(
                                'response was (' +
                                    status +
                                    ')' +
                                    response.text()
                            );
                        }
                        throw new Error(errorInfo.message);
                    }
                });
        }

        return calls[id];
    };

    getTransactions = () =>
        this.rpc('listfunds').then(({ outputs }: any) => ({
            transactions: outputs
        }));
    getChannels = () =>
        this.rpc('listpeers').then(({ peers }: any) => ({
            channels: peers
                .filter((peer: any) => peer.channels.length)
                .map((peer: any) => {
                    const channel =
                        peer.channels.find(
                            (c: any) =>
                                c.state !== 'ONCHAIN' && c.state !== 'CLOSED'
                        ) || peer.channels[0];

                    return {
                        active: peer.connected,
                        remote_pubkey: peer.id,
                        channel_point: channel.funding_txid,
                        chan_id: channel.channel_id,
                        capacity: Number(
                            channel.msatoshi_total / 1000
                        ).toString(),
                        local_balance: Number(
                            channel.msatoshi_to_us / 1000
                        ).toString(),
                        remote_balance: Number(
                            (channel.msatoshi_total - channel.msatoshi_to_us) /
                                1000
                        ).toString(),
                        total_satoshis_sent: Number(
                            channel.out_msatoshi_fulfilled / 1000
                        ).toString(),
                        total_satoshis_received: Number(
                            channel.in_msatoshi_fulfilled / 1000
                        ).toString(),
                        num_updates: (
                            channel.in_payments_offered +
                            channel.out_payments_offered
                        ).toString(),
                        csv_delay: channel.our_to_self_delay,
                        private: channel.private,
                        local_chan_reserve_sat:
                            channel.our_channel_reserve_satoshis.toString(),
                        remote_chan_reserve_sat:
                            channel.their_channel_reserve_satoshis.toString(),
                        close_address: channel.close_to_addr
                    };
                })
        }));
    getBlockchainBalance = () =>
        this.rpc('listfunds').then(({ outputs }: any) => {
            const unconf = outputs
                .filter((o: any) => o.status !== 'confirmed')
                .reduce((acc: any, o: any) => acc + o.value, 0);
            const conf = outputs
                .filter((o: any) => o.status === 'confirmed')
                .reduce((acc: any, o: any) => acc + o.value, 0);

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
                .reduce((acc: any, o: any) => acc + o.channel_sat, 0),
            pending_open_balance: channels
                .filter((o: any) => o.state === 'CHANNELD_AWAITING_LOCKIN')
                .reduce((acc: any, o: any) => acc + o.channel_sat, 0)
        }));
    sendCoins = (data: TransactionRequest) =>
        this.rpc('withdraw', {
            desination: data.addr,
            feerate: `${Number(data.sat_per_byte) * 1000}perkb`,
            satoshi: data.amount
        });
    getMyNodeInfo = () => this.rpc('getinfo');
    getInvoices = () =>
        this.rpc('listinvoices', {}, { unit: 'invoices', slice: '-100' }).then(
            ({ invoices }: any) => ({
                invoices: invoices.map((inv: any) => ({
                    memo: inv.description,
                    r_preimage: inv.payment_preimage,
                    r_hash: inv.payment_hash,
                    value: inv.msatoshi / 1000,
                    value_msat: inv.msatoshi,
                    settled: inv.status === 'paid',
                    creation_date: inv.expires_at,
                    settle_date: inv.paid_at,
                    payment_request: inv.bolt11,
                    expiry: inv.expires_at,
                    amt_paid: inv.msatoshi_received / 1000,
                    amt_paid_sat: inv.msatoshi_received / 1000,
                    amt_paid_msat: inv.msatoshi_received
                }))
            })
        );
    createInvoice = (data: any) =>
        this.rpc('invoice', {
            description: data.memo,
            label: 'zeus.' + Math.random() * 1000000,
            msatoshi: Number(data.value) * 1000,
            expiry: data.expiry,
            exposeprivatechannels: true
        });
    getPayments = () =>
        this.rpc('listsendpays', {}, { unit: 'payments', slice: '-100' });
    getNewAddress = () => this.rpc('newaddr');
    openChannel = (data: OpenChannelRequest) =>
        this.rpc('fundchannel', {
            id: data.node_pubkey_string,
            amount: data.satoshis,
            feerate: `${Number(data.sat_per_byte) * 1000}perkb`,
            announce: !data.private
        }).then(({ txid }: any) => ({ funding_txid_str: txid }));
    connectPeer = (data: any) =>
        this.rpc('connect', [data.addr.pubkey, data.addr.host]);
    listNode = () => 'N/A';
    decodePaymentRequest = (urlParams?: Array<string>) =>
        this.rpc('decodepay', [urlParams && urlParams[0]]);
    payLightningInvoice = (data: any) =>
        this.rpc('pay', {
            bolt11: data.payment_request,
            msatoshi: data.amt ? Number(data.amt * 1000) : undefined
        });
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
                        addresses: node.addresses.map((addr: any) => ({
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

        const [listforwards, listpeers, listchannels] = await Promise.all([
            this.rpc('listforwards'),
            this.rpc('listpeers'),
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
                lastDay += forward.fee;
                lastWeek += forward.fee;
                lastMonth += forward.fee;
            } else if (forward.resolved_time > oneWeekAgo) {
                lastWeek += forward.fee;
                lastMonth += forward.fee;
            } else if (forward.resolved_time > oneMonthAgo) {
                lastMonth += forward.fee;
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
            channel_fees: listpeers.peers
                .filter(({ channels }: any) => channels && channels.length)
                .filter(
                    ({ channels: [{ short_channel_id }] }: any) =>
                        channelsMap[short_channel_id]
                )
                .map(
                    ({
                        channels: [
                            { short_channel_id, channel_id, funding_txid }
                        ]
                    }: any) => ({
                        chan_id: channel_id,
                        channel_point: funding_txid,
                        base_fee_msat:
                            channelsMap[short_channel_id].base_fee_msat,
                        fee_rate: channelsMap[short_channel_id].fee_rate
                    })
                ),
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
            msatoshi,
            riskfactor: 2
        });

        const route = res.route[0];

        return {
            routes: [
                {
                    total_fees: (route[0].msatoshi - msatoshi) / 1000
                }
            ]
        };
    };

    supportsMessageSigning = () => false;
    supportsOnchainSends = () => true;
    supportsKeysend = () => false;
    supportsChannelManagement = () => true;
    supportsMPP = () => false;
    supportsAMP = () => false;
    supportsCoinControl = () => false;
    supportsHopPicking = () => false;
    supportsRouting = () => true;
}
