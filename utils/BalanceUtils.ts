import BigNumber from 'bignumber.js';

// amounts may arrive as strings, numbers, or protobuf Longs
// depending on the backend
const toNumber = (value: any): number =>
    value == null ? 0 : Number(value.toString());

// the txid half of a 'txid:index' outpoint
const outpointTxid = (outpoint: any): string =>
    typeof outpoint === 'string' ? outpoint.split(':')[0] : '';

export interface ExternalUnconfirmedTransaction {
    txid: string;
    amount: number;
    // txids of the outputs this transaction spends
    spentTxids: string[];
}

export interface ExternalUnconfirmedBalance {
    amount: number;
    txids: string[];
    transactions: ExternalUnconfirmedTransaction[];
}

export interface CooperativeClose {
    closingTxid: string;
    limboBalance: number;
}

export interface ForceClose {
    // the closing transaction and any second-level HTLC transactions,
    // whose outputs a sweep of this channel spends
    txids: string[];
    limboBalance: number;
    hasPendingHtlcs: boolean;
}

/**
 * Sums the portion of the wallet's unconfirmed on-chain balance that came
 * from outside the wallet (external deposits, cooperative close outputs,
 * sweeps), and returns the txids that contributed to it.
 *
 * A transaction's net amount is what it credited to the wallet minus what
 * it spent from the wallet. Only a positive net amount brings in value
 * from outside. Unconfirmed change from the wallet's own spends (e.g.
 * channel funding change) has a negative net amount: those funds never
 * left the wallet, so they belong in the available balance rather than
 * the pending balance.
 *
 * The amount is clamped to [0, unconfirmedBalance].
 */
export function getExternalUnconfirmedBalance(
    transactions: any[],
    unconfirmedBalance: string | number
): ExternalUnconfirmedBalance {
    const unconfirmed = toNumber(unconfirmedBalance);
    if (!Array.isArray(transactions) || unconfirmed <= 0)
        return { amount: 0, txids: [], transactions: [] };

    let external = new BigNumber(0);
    const txids: string[] = [];
    const externalTransactions: ExternalUnconfirmedTransaction[] = [];
    for (const tx of transactions) {
        if (!tx) continue;
        const isConfirmed =
            toNumber(tx.num_confirmations) > 0 || tx.status === 'confirmed';
        if (isConfirmed) continue;

        const amount = toNumber(tx.amount);
        if (amount > 0) {
            external = external.plus(amount);
            if (tx.tx_hash) {
                txids.push(tx.tx_hash);
                externalTransactions.push({
                    txid: tx.tx_hash,
                    amount,
                    spentTxids: Array.isArray(tx.previous_outpoints)
                        ? tx.previous_outpoints
                              .map((prev: any) => outpointTxid(prev?.outpoint))
                              .filter(Boolean)
                        : []
                });
            }
        }
    }

    return {
        amount: BigNumber.min(external, unconfirmed).toNumber(),
        txids,
        transactions: externalTransactions
    };
}

/**
 * Returns the waiting close channels that are being closed cooperatively,
 * with their closing txid and limbo balance.
 *
 * A force close broadcasts one of the channel's commitment transactions,
 * so its closing txid matches one of the listed commitment txids. A
 * cooperative close broadcasts a separate closing transaction.
 */
export function getCooperativeCloses(
    waitingCloseChannels: any[]
): CooperativeClose[] {
    if (!Array.isArray(waitingCloseChannels)) return [];

    const cooperativeCloses: CooperativeClose[] = [];
    for (const pending of waitingCloseChannels) {
        const closingTxid = pending?.closing_txid;
        if (!closingTxid) continue;

        const commitments = pending.commitments || {};
        const commitmentTxids = [
            commitments.local_txid,
            commitments.remote_txid,
            commitments.remote_pending_txid
        ];
        if (commitmentTxids.includes(closingTxid)) continue;

        cooperativeCloses.push({
            closingTxid,
            limboBalance: toNumber(pending.limbo_balance)
        });
    }
    return cooperativeCloses;
}

/**
 * While a cooperative close is unconfirmed, lnd reports its funds twice:
 * as the channel's limbo balance, and as the unconfirmed closing output
 * paid to the wallet. Returns the limbo balance of the cooperative closes
 * whose closing transaction is already counted as external unconfirmed
 * funds, so the pending balance can drop it and keep the closing output,
 * which is the amount the wallet actually receives.
 *
 * The result is clamped to [0, pendingCloseBalance].
 */
export function getCooperativeCloseOverlap(
    cooperativeCloses: CooperativeClose[],
    externalUnconfirmedTxids: string[],
    pendingCloseBalance: string | number
): number {
    const pendingClose = toNumber(pendingCloseBalance);
    if (
        !Array.isArray(cooperativeCloses) ||
        !Array.isArray(externalUnconfirmedTxids) ||
        pendingClose <= 0
    )
        return 0;

    let overlap = new BigNumber(0);
    for (const close of cooperativeCloses) {
        if (externalUnconfirmedTxids.includes(close.closingTxid))
            overlap = overlap.plus(close.limboBalance);
    }

    return BigNumber.max(0, BigNumber.min(overlap, pendingClose)).toNumber();
}

/**
 * Returns the pending force closes with their limbo balance and the txids
 * a sweep of their funds spends from.
 *
 * The commitment output is swept from the closing transaction. A
 * second-level HTLC sweep spends the HTLC transaction instead, whose
 * outpoint lnd lists in pending_htlcs.
 */
export function getForceCloses(
    pendingForceClosingChannels: any[]
): ForceClose[] {
    if (!Array.isArray(pendingForceClosingChannels)) return [];

    const forceCloses: ForceClose[] = [];
    for (const pending of pendingForceClosingChannels) {
        const closingTxid = pending?.closing_txid;
        if (!closingTxid) continue;

        const htlcs = Array.isArray(pending.pending_htlcs)
            ? pending.pending_htlcs
            : [];
        const txids = [closingTxid];
        for (const htlc of htlcs) {
            const txid = outpointTxid(htlc?.outpoint);
            if (txid && !txids.includes(txid)) txids.push(txid);
        }

        forceCloses.push({
            txids,
            limboBalance: toNumber(pending.limbo_balance),
            hasPendingHtlcs: htlcs.length > 0
        });
    }
    return forceCloses;
}

/**
 * lnd broadcasts a force close's sweep one block before the funds mature.
 * Until the sweep confirms, the funds are reported twice: as the channel's
 * limbo balance, and as the unconfirmed sweep output paid to the wallet.
 * Returns the limbo balance to drop for sweeps that are already counted as
 * external unconfirmed funds.
 *
 * The sweeper batches inputs from several channels into one transaction,
 * and a channel with pending HTLCs can have more than one sweep, so
 * channels that share a sweep are settled as one group. When no channel
 * in a group has pending HTLCs, the sweep covers all of its limbo balance,
 * and the whole limbo balance is dropped in favour of the sweep output,
 * which is net of the sweep fee. Otherwise part of the limbo balance is
 * not swept yet, so only the swept amount is dropped, which leaves the
 * sweep fee on the pending line until the sweep confirms.
 *
 * The result is clamped to [0, pendingCloseBalance].
 */
export function getForceCloseSweepOverlap(
    forceCloses: ForceClose[],
    externalUnconfirmedTransactions: ExternalUnconfirmedTransaction[],
    pendingCloseBalance: string | number
): number {
    const pendingClose = toNumber(pendingCloseBalance);
    if (
        !Array.isArray(forceCloses) ||
        !Array.isArray(externalUnconfirmedTransactions) ||
        pendingClose <= 0
    )
        return 0;

    // one entry per txid, so a batched sweep is only counted once
    const sweepAmounts = new Map<string, number>();
    for (const tx of externalUnconfirmedTransactions) {
        if (tx?.txid) sweepAmounts.set(tx.txid, tx.amount);
    }
    const sweepsOf = (close: ForceClose): string[] =>
        externalUnconfirmedTransactions
            .filter((tx) =>
                (tx?.spentTxids || []).some((txid) =>
                    close.txids.includes(txid)
                )
            )
            .map((tx) => tx.txid);

    const groups: Array<{ closes: ForceClose[]; sweeps: Set<string> }> = [];
    for (const close of forceCloses) {
        const sweeps = sweepsOf(close);
        if (sweeps.length === 0) continue;

        const group = { closes: [close], sweeps: new Set(sweeps) };
        for (let i = groups.length - 1; i >= 0; i--) {
            if (!sweeps.some((txid) => groups[i].sweeps.has(txid))) continue;
            group.closes.push(...groups[i].closes);
            groups[i].sweeps.forEach((txid) => group.sweeps.add(txid));
            groups.splice(i, 1);
        }
        groups.push(group);
    }

    let overlap = new BigNumber(0);
    for (const group of groups) {
        const limbo = group.closes.reduce(
            (sum, close) => sum.plus(close.limboBalance),
            new BigNumber(0)
        );
        let swept = new BigNumber(0);
        group.sweeps.forEach((txid) => {
            swept = swept.plus(sweepAmounts.get(txid) || 0);
        });
        const hasPendingHtlcs = group.closes.some(
            (close) => close.hasPendingHtlcs
        );
        overlap = overlap.plus(
            hasPendingHtlcs ? BigNumber.min(limbo, swept) : limbo
        );
    }

    return BigNumber.max(0, BigNumber.min(overlap, pendingClose)).toNumber();
}
