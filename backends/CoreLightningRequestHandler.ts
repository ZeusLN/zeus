import CLNRest from './CLNRest';

const api = new CLNRest();

// Returns onchain balance of core-lightning node
export const getBalance = (data: any) => {
    const opArray = data.outputs;
    let confBalance = 0;
    let unconfBalance = 0;
    let totalBalance = 0;

    for (let i = 0; i < opArray.length; i++) {
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

// Returns offchain balances of core-lightning node
export const getOffchainBalance = (data: any) => {
    const chanArray = data.channels;
    let localBalance = 0;
    let remoteBalance = 0;
    let pendingBalance = 0;
    let inactiveBalance = 0;

    for (let i = 0; i < chanArray.length; i++) {
        if (
            chanArray[i].state === 'CHANNELD_NORMAL' &&
            chanArray[i].connected === true
        ) {
            localBalance = localBalance + chanArray[i].our_amount_msat;

            remoteBalance =
                remoteBalance +
                chanArray[i].amount_msat -
                chanArray[i].our_amount_msat;
        } else if (
            chanArray[i].state === 'CHANNELD_NORMAL' &&
            chanArray[i].connected === false
        ) {
            inactiveBalance = inactiveBalance + chanArray[i].our_amount_msat;
        } else if (
            chanArray[i].state === 'CHANNELD_AWAITING_LOCKIN' ||
            chanArray[i].state === 'DUALOPEND_AWAITING_LOCKIN'
        ) {
            pendingBalance = pendingBalance + chanArray[i].our_amount_msat;
        }
    }

    localBalance = localBalance / 1000;
    remoteBalance = remoteBalance / 1000;
    inactiveBalance = inactiveBalance / 1000;
    pendingBalance = pendingBalance / 1000;

    return {
        balance: localBalance,
        remote_balance: remoteBalance,
        inactive_balance: inactiveBalance,
        pending_balance: pendingBalance
    };
};

// Get your peers and the channel info for core lightning node
export const listPeers = async (data: any) => {
    const formattedChannels = data.channels
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

// Get all chain transactions from your core-lightnig node
export const getChainTransactions = async () => {
    const results = await Promise.allSettled([
        api.postRequest('/v1/bkpr-listaccountevents'),
        api.postRequest('/v1/listtransactions'),
        api.postRequest('/v1/getinfo')
    ]);

    const [walletTxsResult, listTxsResult, getinfoResult] = results;

    // If getinfo fails, return blank txs
    if (getinfoResult.status !== 'fulfilled') {
        return { transactions: [] };
    }

    const getinfo = getinfoResult.value;

    const allTxs =
        walletTxsResult.status === 'fulfilled'
            ? walletTxsResult.value.events.filter(
                  (tx: any) => tx.type !== 'onchain_fee'
              )
            : { events: [] };

    const walletTxs =
        walletTxsResult.status === 'fulfilled'
            ? walletTxsResult.value.events.filter(
                  (tx: any) => tx.tag === 'deposit' && tx.account === 'wallet'
              )
            : { events: [] };

    const externalTxs =
        walletTxsResult.status === 'fulfilled'
            ? walletTxsResult.value.events.filter(
                  (tx: any) => tx.tag === 'deposit' && tx.account === 'external'
              )
            : { events: [] };

    const listTxs =
        listTxsResult.status === 'fulfilled'
            ? listTxsResult.value
            : { transactions: [] };

    const transactions = listTxs.transactions
        .map((tx: any) => {
            const withdrawal = externalTxs.find((n: any) => {
                const txid = n.outpoint ? n.outpoint.split(':')[0] : null;

                // Check if the deposit is associated with a channel open or close
                const isChannelChange = allTxs.find((c: any) => {
                    if (!c.outpoint) {
                        return undefined;
                    }

                    return (
                        c.outpoint.split(':')[0] === tx.hash &&
                        (c.tag === 'channel_open' || c.tag === 'channel_close')
                    );
                });

                if (isChannelChange) {
                    return undefined;
                }

                return txid === tx.hash;
            });

            const deposit = walletTxs.find((n: any) => {
                const txid = n.outpoint ? n.outpoint.split(':')[0] : null;

                // Check if the deposit is associated with a channel open or close
                const isChannelChange = allTxs.find((c: any) => {
                    if (!c.outpoint) {
                        return undefined;
                    }
                    return (
                        c.outpoint.split(':')[0] === tx.hash &&
                        (c.tag === 'channel_open' || c.tag === 'channel_close')
                    );
                });

                if (isChannelChange) {
                    return undefined;
                }

                return txid === tx.hash;
            });

            if (withdrawal) {
                return {
                    amount: -Math.abs(withdrawal.credit_msat) / 1000,
                    block_height: withdrawal.blockheight,
                    num_confirmations:
                        getinfo.blockheight - withdrawal.blockheight,
                    time_stamp: withdrawal.timestamp,
                    txid: tx.hash,
                    note: 'on-chain withdrawal'
                };
            }

            if (deposit) {
                return {
                    amount: deposit.credit_msat / 1000,
                    block_height: deposit.blockheight,
                    num_confirmations:
                        getinfo.blockheight - deposit.blockheight,
                    time_stamp: deposit.timestamp,
                    txid: tx.hash,
                    note: 'on-chain deposit'
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
