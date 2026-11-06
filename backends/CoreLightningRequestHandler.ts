import CLNRest from './CLNRest';
import AddressUtils from '../utils/AddressUtils';
import type { ReportedSplice } from '../utils/SpliceUtils';
import type { SpliceRecord } from '../stores/SpliceStore';

// Response shapes for the Core Lightning RPCs this module consumes.
//
// Typed from the schemas shipped with CLN (doc/schemas), cross-checked between
// v24.11 - the oldest release CLNRest.supports() gates on - and v26.06.7. A
// field is only non-optional here when the schema marks it required in both,
// so anything optional below really can be missing from a node Zeus supports.
// `*_msat` values arrive as plain JSON numbers, not "1234msat" strings.
//
// These describe what the handlers below read, not the full CLN response.

export interface IClnChannelType {
    bits: number[];
    names: string[];
}

// lightning-listpeerchannels: a candidate funding transaction, such as a
// splice that hasn't locked yet
export interface IClnInflight {
    funding_txid: string;
    funding_outnum: number;
    // the channel's capacity with this funding
    total_funding_msat: number;
    // our side's share of the splice in sats, negative for a splice-out
    // (v23.08+). 0 when the peer spliced: Core Lightning adds nothing to a
    // peer's splice
    splice_amount: number;
}

// lightning-listpeerchannels
export interface IClnPeerChannel {
    // one of the 14 values in the schema's `state` enum, e.g. CHANNELD_NORMAL
    state: string;
    peer_connected: boolean;
    peer_id: string;
    // A channel that is not funded yet carries no balances, no funding txid
    // and no ids, so everything below can be absent.
    funding_txid?: string;
    channel_id?: string;
    short_channel_id?: string;
    total_msat?: number;
    to_us_msat?: number;
    out_fulfilled_msat?: number;
    in_fulfilled_msat?: number;
    in_payments_offered?: number;
    out_payments_offered?: number;
    our_to_self_delay?: number;
    private?: boolean;
    our_reserve_msat?: number;
    their_reserve_msat?: number;
    // only when a close address was negotiated
    close_to_addr?: string;
    inflight?: IClnInflight[];
}

// lightning-listclosedchannels
export interface IClnClosedChannel {
    channel_id: string;
    opener: 'local' | 'remote';
    private: boolean;
    funding_txid: string;
    total_msat: number;
    final_to_us_msat: number;
    min_to_us_msat: number;
    max_to_us_msat: number;
    total_htlcs_sent: number;
    close_cause:
        | 'unknown'
        | 'local'
        | 'user'
        | 'remote'
        | 'protocol'
        | 'onchain';
    // "can be missing with pre-v23.05 closes", per the schema
    peer_id?: string;
    short_channel_id?: string;
    // absent for channels that never had a commitment tx, and the fee below
    // is the fee on that same tx
    last_commitment_txid?: string;
    last_commitment_fee_msat?: number;
    // only present if the channel was closed by one of the two sides
    closer?: 'local' | 'remote';
    // required from v26.06 on, absent on older nodes
    channel_type?: IClnChannelType;
    last_stable_connection?: number;
}

// lightning-listpeers
export interface IClnPeer {
    id: string;
    connected: boolean;
    num_channels: number;
    // the schema requires these only while `connected` is true
    netaddr?: string[];
    features?: string;
}

const api = new CLNRest();

// Returns onchain balance of core-lightning node
export const getBalance = (data: any) => {
    const opArray = data.outputs;
    let confBalance = 0;
    let unconfBalance = 0;
    let totalBalance = 0;

    for (let i = 0; i < opArray.length; i++) {
        // CLN marks an output reserved: true while a transaction or PSBT
        // holds it, for example after a transaction spends it and until
        // that transaction confirms. Counting a spent output would add it
        // next to its change output
        if (opArray[i].reserved) continue;
        if (opArray[i].status === 'confirmed')
            confBalance = confBalance + opArray[i].amount_msat / 1000;
        else if (opArray[i].status === 'unconfirmed')
            unconfBalance = unconfBalance + opArray[i].amount_msat / 1000;
    }
    totalBalance = confBalance + unconfBalance;
    return {
        total_balance: totalBalance,
        confirmed_balance: confBalance,
        unconfirmed_balance: unconfBalance
    };
};

// A channel being spliced keeps working, and keeps its balance, until the
// splice locks
const isChannelOpen = (state: string) =>
    state === 'CHANNELD_NORMAL' || state === 'CHANNELD_AWAITING_SPLICE';

// Returns offchain balances of core-lightning node
export const getOffchainBalance = (data: any) => {
    const chanArray = data.channels;
    let localBalance = 0;
    let remoteBalance = 0;
    let pendingOpenBalance = 0;
    let inactiveBalance = 0;

    for (let i = 0; i < chanArray.length; i++) {
        if (
            isChannelOpen(chanArray[i].state) &&
            chanArray[i].connected === true
        ) {
            localBalance = localBalance + chanArray[i].our_amount_msat;

            remoteBalance =
                remoteBalance +
                chanArray[i].amount_msat -
                chanArray[i].our_amount_msat;
        } else if (
            isChannelOpen(chanArray[i].state) &&
            chanArray[i].connected === false
        ) {
            inactiveBalance = inactiveBalance + chanArray[i].our_amount_msat;
        } else if (
            chanArray[i].state === 'CHANNELD_AWAITING_LOCKIN' ||
            chanArray[i].state === 'DUALOPEND_AWAITING_LOCKIN'
        ) {
            pendingOpenBalance =
                pendingOpenBalance + chanArray[i].our_amount_msat;
        }
    }

    localBalance = localBalance / 1000;
    remoteBalance = remoteBalance / 1000;
    inactiveBalance = inactiveBalance / 1000;
    pendingOpenBalance = pendingOpenBalance / 1000;

    return {
        balance: localBalance,
        remote_balance: remoteBalance,
        inactive_balance: inactiveBalance,
        pending_open_balance: pendingOpenBalance
    };
};

// A channel being spliced keeps its old funding txid and total until the
// splice locks; the splice is its newest candidate funding transaction
export const getReportedSplice = (
    channel: IClnPeerChannel
): ReportedSplice | undefined => {
    const inflight = channel.inflight?.[channel.inflight.length - 1];
    if (!inflight || !isChannelOpen(channel.state)) return undefined;

    const capacitySats = Math.floor(inflight.total_funding_msat / 1000);
    const ours = !!inflight.splice_amount;
    const moved = ours
        ? inflight.splice_amount
        : capacitySats - Math.floor((channel.total_msat ?? 0) / 1000);
    return {
        txid: inflight.funding_txid,
        vout: inflight.funding_outnum,
        initiator: ours ? 'local' : 'remote',
        direction: moved > 0 ? 'in' : moved < 0 ? 'out' : undefined,
        amountSats: ours ? Math.abs(inflight.splice_amount) : undefined,
        capacitySats
    };
};

// Get your peers and the channel info for core lightning node
export const listPeerChannels = async (data: {
    channels: IClnPeerChannel[];
}) => {
    const formattedChannels = data.channels
        .map((peer: IClnPeerChannel) => {
            if (
                peer.state === 'ONCHAIN' ||
                peer.state === 'CLOSED' ||
                peer.state === 'CHANNELD_AWAITING_LOCKIN'
            ) {
                return;
            }

            const pendingSplice = getReportedSplice(peer);
            return {
                active: peer.peer_connected,
                remote_pubkey: peer.peer_id,
                channel_point: peer.funding_txid,
                chan_id: peer.channel_id,
                short_channel_id: peer.short_channel_id,
                // These are absent until the channel is funded, and this
                // mapper is reached in states where that is still true, so
                // fall back to 0 rather than reporting "NaN" sats.
                capacity: Number((peer.total_msat ?? 0) / 1000).toString(),
                local_balance: Number((peer.to_us_msat ?? 0) / 1000).toString(),
                remote_balance: Number(
                    ((peer.total_msat ?? 0) - (peer.to_us_msat ?? 0)) / 1000
                ).toString(),
                total_satoshis_sent: Number(
                    (peer.out_fulfilled_msat ?? 0) / 1000
                ).toString(),
                total_satoshis_received: Number(
                    (peer.in_fulfilled_msat ?? 0) / 1000
                ).toString(),
                num_updates: (
                    (peer.in_payments_offered ?? 0) +
                    (peer.out_payments_offered ?? 0)
                ).toString(),
                csv_delay: peer.our_to_self_delay,
                private: peer.private,
                local_chan_reserve_sat: Number(
                    (peer.our_reserve_msat ?? 0) / 1000
                ).toString(),
                remote_chan_reserve_sat: Number(
                    (peer.their_reserve_msat ?? 0) / 1000
                ).toString(),
                close_address: peer.close_to_addr,
                ...(pendingSplice && { pending_splice: pendingSplice })
            };
        })
        .filter((n: any) => !!n);

    const channelsWithAliases = await Promise.all(
        formattedChannels.map(async (n: any) => {
            const { nodes } = await api.getNode({ id: n.remote_pubkey });

            if (nodes.length) {
                n.alias = nodes[0].alias || '';
            } else {
                n.alias = '';
            }

            return n;
        })
    );

    return { channels: channelsWithAliases };
};

// Returns a list of closed Lightning Network channels
export const listClosedChannels = (data: {
    closedchannels: IClnClosedChannel[];
}) => {
    const formattedClosedChannels = data.closedchannels.map((channel) => ({
        remote_pubkey: channel.peer_id,
        capacity: Number(channel.total_msat / 1000).toString(),
        channel_id: channel.channel_id,
        short_channel_id: channel.short_channel_id,
        closing_txid: channel.last_commitment_txid,
        opener: channel.opener,
        closer: channel.closer,
        private: channel.private,
        channel_type: channel.channel_type?.names || [],
        funding_txid: channel.funding_txid,
        total_msat: channel.total_msat.toString(),
        to_us_msat: channel.final_to_us_msat.toString(),
        min_to_us_satoshis: Number(channel.min_to_us_msat / 1000).toString(),
        max_to_us_satoshis: Number(channel.max_to_us_msat / 1000).toString(),
        total_htlcs_sent: channel.total_htlcs_sent.toString(),
        close_cause: channel.close_cause,
        // absent when the channel had no commitment tx to pay a fee on
        last_commitment_fee_satoshis: Number(
            (channel.last_commitment_fee_msat ?? 0) / 1000
        ).toString(),
        last_stable_connection: channel.last_stable_connection
    }));

    return { channels: formattedClosedChannels };
};

export const listPeers = async (data: { peers: IClnPeer[] }) => {
    const formattedPeers = data.peers.map((peer) => {
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
            const { nodes } = await api.getNode({ id: n.id });

            if (nodes.length) {
                n.alias = nodes[0].alias || '';
            } else {
                n.alias = '';
            }

            return n;
        })
    );

    return { peersWithAliases };
};

const outpointTxid = (outpoint?: string): string | null =>
    outpoint ? outpoint.split(':')[0] : null;

// A splice as Core Lightning's bookkeeper recorded it
export interface IClnSplice {
    txid: string;
    // the channel's bookkeeper account, which is its channel_id
    channelId: string;
    capacityBeforeSats: number;
    capacityAfterSats: number;
    // what it moved into (positive) or out of the wallet, in msat; 0 for a
    // peer's splice that left the wallet alone
    walletNetMsat: number;
    blockheight: number;
    timestamp: number;
}

// A splice spends the channel's funding output and creates the new one in
// the same transaction. Bookkeeper tags the spend channel_close (plus a
// splice tag), keyed by the output spent with the splice as its txid, and
// the new output channel_open. A close only spends and an open only
// creates. Null when the node can't say
export const findSplices = async (): Promise<IClnSplice[] | null> => {
    if (!api.supportsSplicing()) return null;
    let rows: any[];
    let transactions: any[];
    try {
        const [events, listed] = await Promise.all([
            api.postRequest('/v1/sql', {
                query: "SELECT account, tag, outpoint, credit_msat, debit_msat, txid, blockheight, timestamp FROM bkpr_accountevents WHERE tag IN ('channel_open', 'channel_close') OR (account = 'wallet' AND tag IN ('deposit', 'withdrawal')) ORDER BY timestamp DESC LIMIT 500"
            }),
            api
                .postRequest('/v1/listtransactions')
                .catch(() => ({ transactions: [] }))
        ]);
        rows = events.rows;
        transactions = listed?.transactions || [];
    } catch (e) {
        return null;
    }

    // Bookkeeper's channel amounts are our balance in the channel, so the
    // capacity comes from the funding output itself, which listtransactions
    // shows for the funding and splice transactions the node took part in
    const outputSats = (outpoint: string): number | undefined => {
        const [txid, vout] = outpoint.split(':');
        const output = transactions
            .find((tx: any) => tx.hash === txid)
            ?.outputs?.find((out: any) => out.index === Number(vout));
        return output?.amount_msat != null
            ? Math.floor(Number(output.amount_msat) / 1000)
            : undefined;
    };

    const fundingSpentBy = new Map<string, any>();
    rows.forEach((row: any) => {
        if (row[1] === 'channel_close' && row[5]) {
            fundingSpentBy.set(row[5], row);
        }
    });

    return rows.flatMap((row: any): IClnSplice[] => {
        const txid = outpointTxid(row[2]);
        const spent = txid && fundingSpentBy.get(txid);
        if (row[1] !== 'channel_open' || !spent || spent[0] !== row[0]) {
            return [];
        }
        const walletNetMsat = rows.reduce((sum: number, wallet: any) => {
            if (wallet[0] !== 'wallet') return sum;
            if (wallet[1] === 'deposit' && outpointTxid(wallet[2]) === txid) {
                return sum + Number(wallet[3]);
            }
            if (wallet[1] === 'withdrawal' && wallet[5] === txid) {
                return sum - Number(wallet[4]);
            }
            return sum;
        }, 0);
        return [
            {
                txid: txid!,
                channelId: row[0],
                capacityBeforeSats:
                    outputSats(spent[2]) ?? Math.floor(Number(spent[4]) / 1000),
                capacityAfterSats:
                    outputSats(row[2]) ?? Math.floor(Number(row[3]) / 1000),
                walletNetMsat,
                blockheight: row[6],
                timestamp: row[7]
            }
        ];
    });
};

// Finished splices, as records like the ones ZEUS tracks for LDK. A splice
// that moved wallet funds is ours: CLN adds nothing to a peer's splice
export const getSpliceHistory = async (): Promise<{
    splices: SpliceRecord[];
}> => {
    const splices = await findSplices();
    if (!splices) throw new Error('No splice history from the node');
    return {
        splices: splices.map((splice) => {
            const change = splice.capacityAfterSats - splice.capacityBeforeSats;
            const direction =
                change > 0 ? 'in' : change < 0 ? 'out' : undefined;
            const ours = splice.walletNetMsat !== 0;
            return {
                userChannelId: '',
                channelId: splice.channelId,
                txid: splice.txid,
                initiator: ours ? 'local' : 'remote',
                direction,
                // what went into the channel, or what the wallet got out
                amountSats: ours
                    ? direction === 'out'
                        ? Math.floor(splice.walletNetMsat / 1000)
                        : Math.abs(change)
                    : undefined,
                startedAt: splice.timestamp * 1000,
                status: 'locked',
                lockedAt: splice.timestamp * 1000,
                capacityBefore: splice.capacityBeforeSats,
                capacityAfter: splice.capacityAfterSats,
                confirmationHeight: splice.blockheight
            };
        })
    };
};

// Get all chain transactions from your core-lightnig node
export const getChainTransactions = async () => {
    const sqlQuery =
        "SELECT account, tag, outpoint, credit_msat, debit_msat, timestamp, blockheight FROM bkpr_accountevents WHERE (tag='deposit' OR tag='to_them' OR tag='channel_open' OR tag='channel_close') ORDER BY timestamp DESC LIMIT 150";

    const results = await Promise.allSettled([
        api.postRequest('/v1/sql', { query: sqlQuery.trim() }),
        api.postRequest('/v1/listtransactions'),
        api.postRequest('/v1/getinfo'),
        findSplices()
    ]);
    const [sqlResult, listTxsResult, getinfoResult, splicesResult]: any =
        results;
    const splices: IClnSplice[] | null =
        splicesResult.status === 'fulfilled' ? splicesResult.value : null;

    listTxsResult?.value?.transactions?.forEach((tx: any) => {
        const addresses: Array<string> = [];
        tx.outputs.forEach((output: any) => {
            try {
                const address = AddressUtils.scriptPubKeyToAddress(
                    output.scriptPubKey
                );
                if (address) addresses.push(address);
            } catch (e) {}
        });
        tx.dest_addresses = addresses;
    });

    // If getinfo fails, return blank txs
    if (getinfoResult.status !== 'fulfilled') {
        return { transactions: [] };
    }

    const getinfo = getinfoResult.value;
    const allTxs =
        sqlResult.status === 'fulfilled' ? sqlResult.value : { rows: [] };

    const walletTxs = allTxs.rows.filter(
        (tx: any) =>
            !!tx[1] && tx[1] === 'deposit' && !!tx[0] && tx[0] === 'wallet'
    );

    const externalTxs = allTxs.rows.filter(
        (tx: any) =>
            !!tx[1] && tx[1] === 'deposit' && !!tx[0] && tx[0] === 'external'
    );

    const listTxs =
        listTxsResult.status === 'fulfilled'
            ? listTxsResult.value
            : { transactions: [] };

    const transactions = listTxs.transactions
        .map((tx: any) => {
            const splice = splices?.find((n) => n.txid === tx.hash);
            if (splice) {
                // Listed by what it moved in or out of the wallet; a peer's
                // splice that left the wallet alone is not an on-chain
                // transaction of ours
                if (!splice.walletNetMsat) return null;
                return {
                    amount: splice.walletNetMsat / 1000,
                    block_height: splice.blockheight,
                    num_confirmations: splice.blockheight
                        ? getinfo.blockheight - splice.blockheight + 1
                        : 0,
                    time_stamp: splice.timestamp,
                    txid: tx.hash,
                    dest_addresses: tx.dest_addresses
                };
            }

            const withdrawal = externalTxs.find((n: any) => {
                const txid = n[2] ? n[2].split(':')[0] : null;

                // Check if the deposit is associated with a channel open or close
                const isChannelChange = allTxs.rows.find((c: any) => {
                    if (!c[2]) {
                        return undefined;
                    }

                    return (
                        c[2].split(':')[0] === tx.hash &&
                        (c[1] === 'channel_open' || c[1] === 'channel_close')
                    );
                });

                if (isChannelChange) {
                    return undefined;
                }

                return txid === tx.hash;
            });

            const deposit = walletTxs.find((n: any) => {
                const txid = n[2] ? n[2].split(':')[0] : null;

                // Check if the deposit is associated with a channel open or close
                const isChannelChange = allTxs.rows.find((c: any) => {
                    if (!c[2]) {
                        return undefined;
                    }

                    return (
                        c[2].split(':')[0] === tx.hash &&
                        (c[1] === 'channel_open' || c[1] === 'channel_close')
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
                    num_confirmations: withdrawal[6]
                        ? getinfo.blockheight - withdrawal[6] + 1
                        : 0,
                    time_stamp: withdrawal[5],
                    txid: tx.hash,
                    dest_addresses: tx.dest_addresses
                };
            }

            if (deposit) {
                return {
                    amount: deposit[3] / 1000,
                    block_height: deposit[6],
                    num_confirmations: deposit[6]
                        ? getinfo.blockheight - deposit[6] + 1
                        : 0,
                    time_stamp: deposit[5],
                    txid: tx.hash,
                    dest_addresses: tx.dest_addresses
                };
            }

            return null;
        })
        .filter((n: any) => !!n);

    // Sort the transactions array by the time_stamp field (descending order)
    transactions.sort((a: any, b: any) => b.time_stamp - a.time_stamp);

    return {
        transactions
    };
};

// listfunds outputs carry a blockheight but no confirmation count, so derive
// one from the current tip. Outputs still in the mempool have no blockheight
// and report 0; if the tip is unknown the count is left off entirely rather
// than claiming the output is unconfirmed.
export const getUTXOs = async () => {
    const results = await Promise.allSettled([
        api.postRequest('/v1/listfunds'),
        api.postRequest('/v1/getinfo')
    ]);
    const [listfundsResult, getinfoResult]: any = results;

    if (listfundsResult.status !== 'fulfilled') {
        throw listfundsResult.reason;
    }

    const listfunds = listfundsResult.value;
    const tip =
        getinfoResult.status === 'fulfilled'
            ? getinfoResult.value.blockheight
            : undefined;

    return {
        ...listfunds,
        // CLN marks an output reserved: true while a transaction or PSBT
        // holds it, for example after a transaction spends it and until
        // that transaction confirms. Coin control must not offer it:
        // withdraw fails when it is picked
        outputs: (listfunds.outputs || [])
            .filter((output: any) => !output.reserved)
            .map((output: any) => {
                if (!tip) return output;
                return {
                    ...output,
                    confirmations: output.blockheight
                        ? tip - output.blockheight + 1
                        : 0
                };
            })
    };
};
