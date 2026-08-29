import BigNumber from 'bignumber.js';

// amounts may arrive as strings, numbers, or protobuf Longs
// depending on the backend
const toNumber = (value: any): number =>
    value == null ? 0 : Number(value.toString());

/**
 * Sums the portion of the wallet's unconfirmed on-chain balance that came
 * from transactions the wallet did not create itself (external deposits).
 *
 * Unconfirmed change from the wallet's own spends (e.g. channel funding
 * change) is excluded: those funds never left the wallet, so they belong
 * in the available balance rather than the pending balance. Own spends
 * are identified by a negative net amount or a known transaction fee,
 * since the wallet only knows the fee of transactions it authored.
 *
 * The result is clamped to [0, unconfirmedBalance].
 */
export function getExternalUnconfirmedBalance(
    transactions: any[],
    unconfirmedBalance: string | number
): number {
    const unconfirmed = toNumber(unconfirmedBalance);
    if (!Array.isArray(transactions) || unconfirmed <= 0) return 0;

    let external = new BigNumber(0);
    for (const tx of transactions) {
        if (!tx) continue;
        const isConfirmed =
            toNumber(tx.num_confirmations) > 0 || tx.status === 'confirmed';
        if (isConfirmed) continue;

        const amount = toNumber(tx.amount);
        const fees = toNumber(tx.total_fees);
        if (amount > 0 && fees <= 0) external = external.plus(amount);
    }

    return BigNumber.min(external, unconfirmed).toNumber();
}
