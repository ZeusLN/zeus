export const DEFAULT_MAX_TRANSACTIONS = 500;

// ~1 week of blocks
export const INITIAL_WINDOW_BLOCKS = 1008;
const WINDOW_GROWTH = 4;

export interface TransactionPageRequest {
    start_height?: number;
    // 0 returns every transaction in range
    max_transactions: number;
}

// lnd's GetTransactions (0.19+) slices its result oldest first, with
// unconfirmed transactions appended after the confirmed ones, and has no
// `reversed` flag. A plain `max_transactions` cap therefore returns the
// oldest transactions. To get the newest ones without knowing the total
// count, we query block height windows back from the chain tip, widening
// until the window holds enough transactions or reaches genesis.
export const getNewestTransactions = async <T>({
    fetchPage,
    getTipHeight,
    limit = DEFAULT_MAX_TRANSACTIONS
}: {
    fetchPage: (request: TransactionPageRequest) => Promise<T[]>;
    getTipHeight: () => Promise<number | undefined>;
    limit?: number;
}): Promise<T[]> => {
    const first = await fetchPage({ max_transactions: limit });
    // Fewer than `limit` means the wallet has no more. More than `limit`
    // means the node ignored the cap (lnd < 0.19) and sent everything.
    if (first.length !== limit) return first;

    let tipHeight: number | undefined;
    try {
        tipHeight = await getTipHeight();
    } catch (e) {
        tipHeight = undefined;
    }

    if (!tipHeight || tipHeight <= 0) {
        const all = await fetchPage({ max_transactions: 0 });
        return all.slice(-limit);
    }

    let window = INITIAL_WINDOW_BLOCKS;
    while (true) {
        const start_height = Math.max(tipHeight - window, 0);
        const transactions = await fetchPage({
            start_height,
            max_transactions: 0
        });
        if (transactions.length >= limit || start_height === 0) {
            return transactions.slice(-limit);
        }
        window *= WINDOW_GROWTH;
    }
};
