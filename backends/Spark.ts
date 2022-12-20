import stores from '../stores/Stores';
import { doTorRequest, RequestMethod } from '../utils/TorUtils';
import TransactionRequest from './../models/TransactionRequest';
import OpenChannelRequest from './../models/OpenChannelRequest';

// keep track of all active calls so we can cancel when appropriate
const calls: any = {};

export default class Spark {
    rpc = (rpcmethod: string, param = {}, range: any = null) => {
        const { accessKey, enableTor } = stores.settingsStore;
        let { url } = stores.settingsStore;

        const id = rpcmethod + JSON.stringify(param) + JSON.stringify(range);
        if (calls[id]) {
            return calls[id];
        }

        url = url.slice(-4) === '/rpc' ? url : url + '/rpc';

        const headers: any = {
            'Content-Type': 'application/json',
            'X-Access': accessKey
        };
        if (range) {
            headers.Range = `${range.unit}=${range.slice}`;
        }

        /* Spark-wallet '/rpc' API (v0.3.2-rc) does not accept objects and
         * "params" should be an array of parameter values in the correct order
         * per the API https://lightning.readthedocs.io. Required but empty
         * values should be set JSON null. */
        const body = JSON.stringify({
            method: rpcmethod,
            params: Object.values(param)
        });

        if (enableTor === true) {
            calls[id] = doTorRequest(url, RequestMethod.POST, body, headers);
        } else {
            calls[id] = fetch(url, {
                method: 'POST',
                headers,
                body
            })
                .catch((e) => {
                    throw new Error(`fetching Spark ${url}, ${e.message}`);
                })
                .then((response: any) => {
                    delete calls[id];
                    if (response.status < 300) {
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
            transactions: outputs.map((o: any) => ({
                // I guess Transaction class expects satoshi's
                amount:
                    typeof o.amount_msat === 'number'
                        ? o.amount_msat / 1000
                        : Number(o.amount_msat.replace('msat', '')) / 1000,
                blockheight: o.blockheight,
                status: o.status,
                txid: o.txid,
                address: o.address
            }))
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
                        /* Since c-lightning v0.12.0, all amount fields end in _msat and (will) become
                         * integers. We also still accept older deprecated fields from older nodes. */
                        capacity: (typeof channel.total_msat === 'number'
                            ? channel.total_msat / 1000
                            : channel.msatoshi_total / 1000
                        ).toString(),
                        local_balance: (typeof channel.to_us_msat === 'number'
                            ? channel.to_us_msat / 1000
                            : channel.msatoshi_to_us / 1000
                        ).toString(),
                        remote_balance: (typeof channel.total_msat ===
                            'number' && typeof channel.to_us_msat === 'number'
                            ? (channel.total_msat - channel.to_us_msat) / 1000
                            : (channel.msatoshi_total -
                                  channel.msatoshi_to_us) /
                              1000
                        ).toString(),
                        total_satoshis_sent:
                            (typeof channel.out_fulfilled_msat === 'number'
                                ? channel.out_fulfilled_msat / 1000
                                : channel.out_msatoshi_fulfilled / 1000
                            ).toString(),
                        total_satoshis_received:
                            (typeof channel.in_fulfilled_msat === 'number'
                                ? channel.in_fulfilled_msat / 1000
                                : channel.in_msatoshi_fulfilled / 1000
                            ).toString(),
                        num_updates: (
                            channel.in_payments_offered +
                            channel.out_payments_offered
                        ).toString(),
                        csv_delay: channel.our_to_self_delay,
                        private: channel.private,
                        local_chan_reserve_sat:
                            (typeof channel.our_reserve_msat === 'number'
                                ? channel.our_reserve_msat / 1000
                                : channel.our_channel_reserve_satoshis
                            ).toString(),
                        remote_chan_reserve_sat:
                            (typeof channel.their_reserve_msat === 'number'
                                ? channel.their_reserve_msat / 1000
                                : channel.their_channel_reserve_satoshis
                            ).toString(),
                        close_address: channel.close_to_addr
                    };
                })
        }));
    getBlockchainBalance = () =>
        this.rpc('listfunds').then(({ outputs }: any) => {
            const unconf = outputs
                .filter((o: any) => o.status !== 'confirmed')
                .reduce(
                    (acc: any, o: any) =>
                        acc +
                        (typeof o.amount_msat === 'number'
                            ? o.amount_msat / 1000
                            : o.value),
                    0
                );
            const conf = outputs
                .filter((o: any) => o.status === 'confirmed')
                .reduce(
                    (acc: any, o: any) =>
                        acc +
                        (typeof o.amount_msat === 'number'
                            ? o.amount_msat / 1000
                            : o.value),
                    0
                );

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
                    (acc: any, o: any) =>
                        acc +
                        (typeof o.our_amount_msat === 'number'
                            ? o.our_amount_msat / 1000
                            : o.channel_sat),
                    0
                ),
            pending_open_balance: channels
                .filter((o: any) => o.state === 'CHANNELD_AWAITING_LOCKIN')
                .reduce(
                    (acc: any, o: any) =>
                        acc +
                        (typeof o.our_amount_msat === 'number'
                            ? o.our_amount_msat / 1000
                            : o.channel_sat),
                    0
                )
        }));
    sendCoins = (data: TransactionRequest) =>
        this.rpc('withdraw', {
            desination: data.addr,
            satoshi: data.amount,
            feerate: `${Number(data.sat_per_byte) * 1000}perkb`
        });
    getMyNodeInfo = () => this.rpc('getinfo');
    getInvoices = () =>
        this.rpc('listinvoices', {}, { unit: 'invoices', slice: '-100' }).then(
            ({ invoices }: any) => ({
                invoices: invoices.map((inv: any) => ({
                    memo: inv.description,
                    r_preimage: inv.payment_preimage,
                    r_hash: inv.payment_hash,
                    amt_paid_sat: (typeof inv.amount_msat === 'number'
                        ? Number(inv.amount_msat) / 1000
                        : Number(inv.amount_msat.replace('msat', '')) / 1000
                    ).toString(),
                    settled: inv.status === 'paid',
                    creation_date: inv.expires_at,
                    settle_date: inv.paid_at,
                    payment_request: inv.bolt11,
                    expiry: inv.expires_at,
                }))
            })
        );
    createInvoice = (data: any) =>
        this.rpc('invoice', {
            amount_msat: data.value !== '0' ? Number(data.value) * 1000 : 'any',
            label: 'zeus.' + Math.random() * 1000000,
            description: data.memo,
            expiry: Math.round(Date.now() / 1000) + Number(data.expiry),
            fallbacks: [],
            preimage: null,
            exposeprivatechannels: true
        });
    getPayments = () =>
        this.rpc('listsendpays', {}, { unit: 'payments', slice: '-100' }).then(
            ({ payments }: any) => ({
                payments: payments.map((p: any) => ({
                    id: p.id,
                    payment_hash: p.payment_hash,
                    destination: p.destination,
                    // accomodate to lnd although "value" is deprecated
                    value: (typeof p.amount_msat === 'number'
                        ? Number(p.amount_msat) / 1000
                        : Number(p.amount_msat.replace('msat', '')) / 1000
                    ).toString(),
                    fee_msat:
                        typeof p.amount_msat === 'number'
                            ? (p.amount_msat - p.amount_sent_msat).toString()
                            : p.amount_msat.replace('msat', ''),
                    creation_date: p.created_at,
                    payment_preimage: p.payment_preimage,
                    payment_request: p.bolt11
                }))
            })
        );
    getNewAddress = () => this.rpc('newaddr');
    openChannel = (data: OpenChannelRequest) =>
        this.rpc('fundchannel', {
            id: data.node_pubkey_string,
            amount: data.satoshis,
            feerate: `${Number(data.sat_per_byte) * 1000}perkb`,
            announce: !data.privateChannel
        }).then(({ txid }: any) => ({ funding_txid_str: txid }));
    connectPeer = (data: any) =>
        this.rpc('connect', { id: data.addr.pubkey, host: data.addr.host });
    decodePaymentRequest = (urlParams: Array<string>) =>
        this.rpc('decodepay', { bolt11: urlParams[0] });
    payLightningInvoice = (data: any) =>
        this.rpc('pay', {
            bolt11: data.payment_request,
            msatoshi: data.amt ? Number(data.amt * 1000) : null
        });
    closeChannel = (urlParams: Array<string>) =>
        this.rpc('close', {
            id: urlParams[0],
            unilateraltimeout: urlParams[1] ? 60 : 0
        }).then(() => ({ chan_close: { success: true } }));
    getNodeInfo = (urlParams: Array<string>) =>
        this.rpc('listnodes', { id: urlParams[0] }).then(({ nodes }: any) => {
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
        });
    getFees = async () => {
        const info = await this.rpc('getinfo');

        const [listforwards, listpeers, listchannels] = await Promise.all([
            this.rpc('listforwards'),
            this.rpc('listpeers'),
            this.rpc('listchannels', {
                short_channel_id: null,
                source: info.id
            })
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
        this.rpc('setchannel', {
            id: data.global ? 'all' : data.channelId,
            feebase: data.base_fee_msat,
            feeppm: data.fee_rate * 1000000
        });
    getRoutes = async (urlParams: Array<string>) => {
        const msatoshi = Number(urlParams[1]) * 1000;

        const res = await this.rpc('getroute', {
            id: urlParams[0],
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
    supportsNodeInfo = () => true;
    supportsAccounts = () => false;
    singleFeesEarnedTotal = () => false;
    supportsAddressTypeSelection = () => false;
    supportsTaproot = () => false;
    isLNDBased = () => false;
}
