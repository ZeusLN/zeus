import BigNumber from 'bignumber.js';

// amounts may arrive as strings, numbers, or protobuf Longs
// depending on the backend
const toNumber = (value: any): number =>
    value == null ? 0 : Number(value.toString());

export interface ExternalUnconfirmedBalance {
    amount: number;
    txids: string[];
}

export interface CooperativeClose {
    closingTxid: string;
    limboBalance: number;
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
        return { amount: 0, txids: [] };

    let external = new BigNumber(0);
    const txids: string[] = [];
    for (const tx of transactions) {
        if (!tx) continue;
        const isConfirmed =
            toNumber(tx.num_confirmations) > 0 || tx.status === 'confirmed';
        if (isConfirmed) continue;

        const amount = toNumber(tx.amount);
        if (amount > 0) {
            external = external.plus(amount);
            if (tx.tx_hash) txids.push(tx.tx_hash);
        }
    }

    return {
        amount: BigNumber.min(external, unconfirmed).toNumber(),
        txids
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
