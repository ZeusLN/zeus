import ReactNativeBlobUtil from 'react-native-blob-util';
import querystring from 'querystring-es3';
import { settingsStore } from '../stores/storeInstances';
import { doTorRequest, RequestMethod } from '../utils/TorUtils';
import TransactionRequest from './../models/TransactionRequest';
import OpenChannelRequest from './../models/OpenChannelRequest';
import Base64Utils from './../utils/Base64Utils';
import { Hash as sha256Hash } from 'fast-sha256';
interface ApiResponse {
    [key: string]: any;
}

export default class Eclair {
    // keep track of all active calls so we can cancel when appropriate
    private calls: Map<string, Promise<ApiResponse>> = new Map();
    clearCachedCalls = () => this.calls.clear();
    private generateCallId(method: string, params: any): string {
        return method + JSON.stringify(params);
    }
    private createHeaders(): Record<string, string> {
        return {
            Authorization:
                'Basic ' +
                Base64Utils.utf8ToBase64(':' + stores.settingsStore.password),
            'Content-Type': 'application/x-www-form-urlencoded'
        };
    }
    private normalizeUrl(url: string): string {
        return url.endsWith('/') ? url : url + '/';
    }
    private async makeTorRequest(
        url: string,
        method: string,
        body: string,
        headers: Record<string, string>
    ): Promise<ApiResponse> {
        return doTorRequest(url + method, RequestMethod.POST, body, headers);
    }
    private async makeRegularRequest(
        url: string,
        method: string,
        body: string,
        headers: Record<string, string>
    ): Promise<ApiResponse> {
        try {
            const response = await ReactNativeBlobUtil.config({
                trusty: !stores.settingsStore.certVerification
            }).fetch('POST', url + method, headers, body);

            const status = response.info().status;
            if (status < 300) {
                return response.json();
            } else {
                const errorInfo = await response.json();
                throw new Error(errorInfo.error);
            }
        } catch (error) {
            if (error instanceof Error) {
                throw error;
            }
            throw new Error('Unknown error occurred');
        }
    }
    private setCallCleanupTimeout(id: string): void {
        setTimeout(() => {
            this.calls.delete(id);
        }, 9000);
    }
    api = (method: string, params: any = {}) => {
        const id = this.generateCallId(method, params);
        const { password, certVerification, enableTor } = settingsStore;
        let { url } = settingsStore;

        if (this.calls.has(id)) {
            return this.calls.get(id)!;
        }

        const url = this.normalizeUrl(stores.settingsStore.url);
        const headers = this.createHeaders();
        const body = querystring.stringify(params);
        const apiCall = stores.settingsStore.enableTor
            ? this.makeTorRequest(url, method, body, headers)
            : this.makeRegularRequest(url, method, body, headers);
        this.calls.set(id, apiCall);
        this.setCallCleanupTimeout(id);

        return apiCall;
    };

    getTransactions = () =>
        Promise.all([
            this.api('onchaintransactions', { count: 100 }),
            this.api('getinfo')
        ]).then(([transactions, { blockHeight }]) => ({
            transactions: transactions.reverse().map((tx: any) => ({
                amount: tx.amount,
                block_height: blockHeight - tx.confirmations,
                block_hash: tx.blockHash,
                total_fees: tx.fees,
                dest_addresses: [tx.address],
                address: tx.address,
                num_confirmations: tx.confirmations,
                time_stamp: tx.timestamp,
                txid: tx.txid
            }))
        }));
    getChannels = () =>
        this.api('channels')?.then((channels: any) => ({
            channels: channels.map((chan: any) => {
                return {
                    active: chan.state === 'NORMAL',
                    remote_pubkey: chan.data.commitments.remoteParams.nodeId,
                    channel_point: null,
                    chan_id: chan.channelId,
                    capacity: Math.round(
                        (chan.data.commitments.localCommit.spec.toLocal +
                            chan.data.commitments.localCommit.spec.toRemote) /
                            1000
                    ).toString(),
                    local_balance: Math.round(
                        chan.data.commitments.localCommit.spec.toLocal / 1000
                    ).toString(),
                    remote_balance: Math.round(
                        chan.data.commitments.localCommit.spec.toRemote / 1000
                    ).toString(),
                    total_satoshis_sent: null,
                    total_satoshis_received: null,
                    num_updates: null,
                    csv_delay: chan.data.commitments.localParams.toSelfDelay,
                    private: false,
                    local_chan_reserve_sat:
                        chan.data.commitments.localParams.channelReserve.toString(),
                    remote_chan_reserve_sat:
                        chan.data.commitments.remoteParams.channelReserve.toString(),
                    close_address: null
                };
            })
        }));
    getBlockchainBalance = () =>
        this.api('onchainbalance')?.then(({ confirmed, unconfirmed }: any) => {
            return {
                total_balance: confirmed + unconfirmed,
                confirmed_balance: confirmed,
                unconfirmed_balance: unconfirmed
            };
        });
    getLightningBalance = () =>
        this.api('channels')?.then((channels: any) => ({
            balance: Math.round(
                channels
                    .filter(
                        (chan: any) =>
                            chan.state === 'NORMAL' || chan.state == 'OFFLINE'
                    )
                    .reduce(
                        (acc: any, o: any) =>
                            acc + o.data.commitments.localCommit.spec.toLocal,
                        0
                    ) / 1000
            ),
            pending_open_balance: Math.round(
                channels
                    .filter(
                        (chan: any) =>
                            chan.state === 'WAIT_FOR_FUNDING_CONFIRMED'
                    )
                    .reduce(
                        (acc: any, o: any) =>
                            acc + o.data.commitments.localCommit.spec.toLocal,
                        0
                    ) / 1000
            )
        }));
    sendCoins = (data: TransactionRequest) =>
        this.api('sendonchain', {
            address: data.addr,
            confirmationTarget: data.conf_target,
            amountSatoshis: data.amount
        })?.then((txid: any) => ({ txid }));
    getMyNodeInfo = () =>
        this.api('getinfo')?.then(
            ({
                version,
                nodeId,
                alias,
                network,
                publicAddresses,
                blockHeight
            }: any) => ({
                uris: publicAddresses.map((addr: any) => nodeId + '@' + addr),
                alias,
                version,
                block_height: blockHeight,
                identity_pubkey: nodeId,
                testnet: network === 'testnet',
                regtest: network === 'regtest'
            })
        );
    getInvoices = () => {
        // 90 days ago
        const since = Math.round(
            new Date().getTime() / 1000 - 60 * 60 * 24 * 90
        );

        return Promise.all([
            this.api('listinvoices', { from: since }),
            this.api('listpendinginvoices', { from: since })
        ]).then(([all, pending]) => {
            const isPending: any = {};
            for (let i = 0; i < pending.length; i++) {
                const inv = pending[i];
                isPending[inv.paymentHash] = true;
            }

            return {
                invoices: all.map(mapInvoice(isPending))
            };
        });
    };
    createInvoice = (data: any) =>
        this.api('createinvoice', {
            description: data.memo,
            amountMsat: Number(data.value) * 1000,
            expireIn: data.expiry
        })?.then(mapInvoice(null));
    getPayments = () =>
        this.api('audit')?.then(({ sent }: any) => ({
            payments: sent.map(
                ({
                    paymentHash,
                    paymentPreimage,
                    parts,
                    recipientAmount,
                    recipientNodeId,
                    id
                }: any) => ({
                    id,
                    payment_hash: paymentHash,
                    payment_preimage: paymentPreimage,
                    creation_date: parts[0].timestamp / 1000,
                    value: recipientAmount / 1000,
                    msatoshi: recipientAmount,
                    msatoshi_sent: recipientAmount,
                    destination: recipientNodeId,
                    fee_sat:
                        parts.reduce(
                            (acc: any, p: any) => acc + p.feesPaid,
                            0
                        ) / 1000,
                    fee_msat: parts.reduce(
                        (acc: any, p: any) => acc + p.feesPaid,
                        0
                    )
                })
            )
        }));
    getNewAddress = () =>
        this.api('getnewaddress')?.then((address: any) => ({ address }));
    openChannelSync = (data: OpenChannelRequest) =>
        this.api('open', {
            nodeId: data.nodePubkeyString,
            fundingSatoshis: data.satoshis,
            fundingFeerateSatByte: data.satPerVbyte,
            channelFlags: data.privateChannel ? 0 : 1
        })?.then(() => ({}));
    connectPeer = (data: any) =>
        this.api('connect', { uri: data.addr.pubkey + '@' + data.addr.host });
    decodePaymentRequest = (urlParams?: Array<string>) =>
        this.api('parseinvoice', {
            invoice: [urlParams && urlParams[0]]
        })?.then(
            ({
                serialized,
                description,
                expiry,
                amount,
                paymentHash,
                nodeId,
                timestamp
            }: any) => ({
                bolt11: serialized,
                description,
                description_hash: description,
                expiry,
                msatoshi: amount,
                payment_hash: paymentHash,
                destination: nodeId,
                timestamp
            })
        );
    payLightningInvoice = (data: any) => {
        const params: any = { invoice: data.payment_request };
        if (data.amt) {
            params.amountMsat = Number(data.amt * 1000);
        }
        return this.api('payinvoice', params)
            ?.then((payId: any) => this.api('getsentinfo', { id: payId }))
            .then((attempts: any) => {
                if (attempts.length === 0) {
                    return {
                        status: 'failed',
                        payment_error: 'no routes found'
                    };
                }

                const last = attempts.slice(-1)[0];
                if (last.status.type === 'failed') {
                    return {
                        payment_hash: last.paymentHash,
                        payment_preimage: last.status.paymentPreimage,
                        status: 'failed',
                        payment_error: last.status.failures[0].failureMessage
                    };
                }

                return {
                    payment_hash: last.paymentHash,
                    payment_route: last.status.route,
                    status: 'SUCCEEDED',
                    payment_error: ''
                };
            });
    };
    closeChannel = (urlParams?: Array<string>) => {
        let method = 'close';
        if (urlParams && urlParams[1]) {
            method = 'forceclose';
        }
        return this.api(method, {
            channelId: [urlParams && urlParams[0]]
        })?.then(() => ({ chan_close: { success: true } }));
    };
    getNodeInfo = (urlParams?: Array<string>) =>
        this.api('nodes', { nodeIds: urlParams && urlParams[0] })?.then(
            (nodes: any) => {
                const node = nodes[0];
                return {
                    node: node && {
                        last_update: node.timestamp,
                        pub_key: node.nodeId,
                        alias: node.alias,
                        color: node.rgbColor,
                        addresses: node.addresses.map((addr: any) => ({
                            network: 'tcp',
                            addr
                        }))
                    }
                };
            }
        );
    getFees = async () => {
        const [channels, { relayed }] = await Promise.all([
            this.api('channels'),
            this.api('audit')
        ]);

        let lastDay = 0,
            lastWeek = 0,
            lastMonth = 0;
        const now = new Date().getTime() / 1000;
        const oneDayAgo = now - 60 * 60 * 24;
        const oneWeekAgo = now - 60 * 60 * 24 * 7;
        const oneMonthAgo = now - 60 * 60 * 24 * 30;
        for (let i = relayed.length - 1; i >= 0; i--) {
            const relay = relayed[i];
            if (relay.timestamp > oneDayAgo) {
                lastDay += relay.amountIn - relay.amountOut;
                lastWeek += relay.amountIn - relay.amountOut;
                lastMonth += relay.amountIn - relay.amountOut;
            } else if (relay.timestamp > oneWeekAgo) {
                lastWeek += relay.amountIn - relay.amountOut;
                lastMonth += relay.amountIn - relay.amountOut;
            } else if (relay.timestamp > oneMonthAgo) {
                lastMonth += relay.amountIn - relay.amountOut;
            } else {
                break;
            }
        }

        return {
            channel_fees: channels.map((channel: any) => ({
                chan_id: channel.channelId,
                channel_point: null,
                base_fee_msat: channel.data.channelUpdate
                    ? channel.data.channelUpdate.feeBaseMsat
                    : null,
                fee_rate: channel.data.channelUpdate
                    ? channel.data.channelUpdate.feeProportionalMillionths /
                      1000000
                    : null
            })),
            day_fee_sum: lastDay / 1000,
            week_fee_sum: lastWeek / 1000,
            month_fee_sum: lastMonth / 1000
        };
    };
    setFees = async (data: any) => {
        const params: any = {};
        if (data.global) {
            params.channelIds = (
                await this.api('channels')?.then((channels: any) =>
                    channels.map((channel: any) => channel.channelId)
                )
            ).join(',');
        } else {
            params.channelId = data.channelId;
        }

        params.feeBaseMsat = data.base_fee_msat;
        params.feeProportionalMillionths = data.fee_rate * 1000000;

        return this.api('updaterelayfee', params);
    };
    getRoutes = (urlParams?: Array<string>) => {
        this.api('findroutetonode', {
            nodeId: urlParams && urlParams[0],
            amountMsat: urlParams && urlParams[1]
        })
            ?.then((nodeIds: any) =>
                Promise.all(
                    nodeIds
                        .slice(1) // discard ourselves since our channel will be free
                        .map((nodeId: any) =>
                            this.api('allupdates', { nodeId })
                        )
                )
            )
            .then((nodesUpdates: any) => {
                // we will match each hop in the route from end to beginning
                // with their previous hop using the channel updates scid
                const route = [];
                let nextHopChannels = nodesUpdates.pop();
                while (nodesUpdates.length > 0) {
                    const hopChannels = nodesUpdates.pop();
                    let found = false;
                    for (let i = 0; i < hopChannels.length; i++) {
                        const chan = hopChannels[i];
                        for (let j = 0; j < nextHopChannels.length; j++) {
                            const nextChan = nextHopChannels[j];
                            if (
                                chan.shortChannelId === nextChan.shortChannelId
                            ) {
                                route.unshift(chan);
                                hopChannels.splice(i, 1);
                                found = true;
                                break;
                            }
                        }
                        if (found) {
                            break;
                        }
                    }
                    if (!found) {
                        // an error
                        return {};
                    }
                    nextHopChannels = hopChannels;
                }

                // we finally have all the chan updates for the route, calculate the fee
                return {
                    routes: [
                        {
                            total_fees: route.reduce(
                                (acc, r) =>
                                    acc +
                                    r.feeBaseMsat +
                                    (acc * r.feeProportionalMillionths) /
                                        1000000,
                                0
                            )
                        }
                    ]
                };
            });
    };

    signMessage = (message: string) =>
        this.api('signmessage', {
            msg: Base64Utils.utf8ToBase64(message)
        });
    verifyMessage = (data: any) =>
        this.api('verifymessage', {
            msg: Base64Utils.utf8ToBase64(data.msg),
            sig: data.signature
        });
    lnurlAuth = async (r_hash: string) => {
        const signed = await this.signMessage(r_hash);
        return {
            signature: new sha256Hash()
                .update(Base64Utils.stringToUint8Array(signed.signature))
                .digest()
        };
    };

    supportsMessageSigning = () => true;
    supportsLnurlAuth = () => true;
    supportsOnchainSends = () => true;
    supportsOnchainReceiving = () => true;
    supportsLightningSends = () => true;
    supportsKeysend = () => false;
    supportsChannelManagement = () => true;
    supportsPendingChannels = () => false;
    supportsMPP = () => false;
    supportsAMP = () => false;
    supportsCoinControl = () => false;
    supportsChannelCoinControl = () => false;
    supportsHopPicking = () => false;
    supportsRouting = () => true;
    supportsNodeInfo = () => true;
    supportsAccounts = () => false;
    singleFeesEarnedTotal = () => false;
    supportsAddressTypeSelection = () => false;
    supportsTaproot = () => false;
    supportsBumpFee = () => false;
    supportsFlowLSP = () => false;
    supportsNetworkInfo = () => false;
    supportsSimpleTaprootChannels = () => false;
    supportsCustomPreimages = () => false;
    supportsSweep = () => false;
    supportsOnchainSendMax = () => false;
    supportsOnchainBatching = () => false;
    supportsChannelBatching = () => false;
    supportsLSPS1customMessage = () => false;
    supportsLSPS1rest = () => true;
    supportsBolt11BlindedRoutes = () => false;
    supportsAddressesWithDerivationPaths = () => false;
    supportsOffers = () => false;
    isLNDBased = () => false;
    supportInboundFees = () => false;
}

const mapInvoice =
    (isPending: any) =>
    ({
        description,
        serialized,
        paymentHash,
        expiry,
        timestamp,
        amount
    }: any) => {
        if (!isPending) {
            isPending = { [paymentHash]: true };
        }
        return {
            memo: description,
            r_hash: paymentHash,
            value: amount / 1000,
            settled: !isPending[paymentHash],
            creation_date: null,
            settle_date: null,
            payment_request: serialized,
            timestamp,
            expiry,
            amt_paid: isPending[paymentHash] ? 0 : amount / 1000,
            amt_paid_sat: isPending[paymentHash] ? 0 : amount / 1000,
            amt_paid_msat: isPending[paymentHash] ? 0 : amount
        };
    };
