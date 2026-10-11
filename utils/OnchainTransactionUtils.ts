export const DEFAULT_MAX_TRANSACTIONS = 500;

export interface TransactionPageRequest {
    start_height?: number;
    end_height?: number;
    // 0 returns every transaction in range
    max_transactions: number;
}

interface OnchainTransaction {
    tx_hash?: string;
    num_confirmations?: number;
}

// Mined transactions, newest block first. lnd walks blocks backwards when
// the start height is above the end height, and a negative start height
// means the chain tip. The end height can't be 0: lnd treats 0 as -1.
export const NEWEST_CONFIRMED: Omit<
    TransactionPageRequest,
    'max_transactions'
> = { start_height: -1, end_height: 1 };

// A negative start and end height ranges only the unmined transactions.
export const UNCONFIRMED: TransactionPageRequest = {
    start_height: -1,
    end_height: -1,
    max_transactions: 0
};

// lnd's GetTransactions (0.19+) pages a list in which unconfirmed
// transactions come after every confirmed one, and only then sorts the page
// by confirmations. A capped request in block order returns the oldest
// transactions, so we request mined transactions newest first, and fetch
// unconfirmed ones separately when that page is full. lnd < 0.19 ignores
// the cap and returns everything.
export const getNewestTransactions = async <T extends OnchainTransaction>({
    fetchPage,
    limit = DEFAULT_MAX_TRANSACTIONS
}: {
    fetchPage: (request: TransactionPageRequest) => Promise<T[]>;
    limit?: number;
}): Promise<T[]> => {
    const confirmed = await fetchPage({
        ...NEWEST_CONFIRMED,
        max_transactions: limit
    });
    // A short page already includes the unconfirmed transactions. A longer
    // one means the node ignored the cap and sent everything.
    if (confirmed.length !== limit) return confirmed;

    const unconfirmed = await fetchPage(UNCONFIRMED);

    // A transaction that confirms between the two requests is in neither
    // and shows up on the next fetch. One that a reorg moves back to the
    // mempool is in both: keep the copy from the confirmed page.
    const seen = new Set<string>();
    return [...confirmed, ...unconfirmed]
        .filter((tx) => {
            if (!tx.tx_hash) return true;
            if (seen.has(tx.tx_hash)) return false;
            seen.add(tx.tx_hash);
            return true;
        })
        .sort(
            (a, b) =>
                Number(a.num_confirmations || 0) -
                Number(b.num_confirmations || 0)
        )
        .slice(0, limit);
};
