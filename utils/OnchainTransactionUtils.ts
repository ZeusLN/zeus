export const DEFAULT_MAX_TRANSACTIONS = 500;

// The most transactions returned from lnd on a SQL database, where the
// newest ones can't be read in one capped request (see getNewestFromSql).
export const SQL_MAX_TRANSACTIONS = 200;

// Blocks read forwards from the tip on a SQL database, about four weeks.
export const SQL_RECENT_BLOCKS = 4032;

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

type FetchPage<T> = (request: TransactionPageRequest) => Promise<T[]>;

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

// Every transaction, oldest block first, then the unmined ones.
export const ALL_FORWARD: TransactionPageRequest = {
    start_height: 0,
    end_height: -1,
    max_transactions: 0
};

const byConfirmations = <T extends OnchainTransaction>(a: T, b: T) =>
    Number(a.num_confirmations || 0) - Number(b.num_confirmations || 0);

const isMined = (tx: OnchainTransaction) => Number(tx.num_confirmations) > 0;

// Merges pages, keeping the first copy of a transaction in more than one,
// newest first.
const newest = <T extends OnchainTransaction>(pages: T[][], limit: number) => {
    const seen = new Set<string>();
    const merged = pages
        .flat()
        .filter((tx) => {
            if (!tx.tx_hash) return true;
            if (seen.has(tx.tx_hash)) return false;
            seen.add(tx.tx_hash);
            return true;
        })
        .sort(byConfirmations);
    return limit === 0 ? merged : merged.slice(0, limit);
};

// lnd on a SQL database (sqlite, postgres) returns no mined transactions
// for a backwards range that starts above the wallet's newest block: the
// kvdb cursor can't step back from past the last key
// (https://github.com/lightningnetwork/lnd/issues/11533). A start height
// of -1 always does, and lnd doesn't say which block that is, so read the
// recent blocks forwards, which also returns the unconfirmed transactions.
// When they include a mined one, a backwards range from just below them
// starts under a block lnd holds, which it can read.
const getNewestFromSql = async <T extends OnchainTransaction>({
    fetchPage,
    getTipHeight,
    limit
}: {
    fetchPage: FetchPage<T>;
    getTipHeight?: () => Promise<number>;
    limit: number;
}): Promise<T[]> => {
    // a caller asking for everything gets everything
    if (limit === 0) return newest([await fetchPage(ALL_FORWARD)], 0);
    const cap = Math.min(limit, SQL_MAX_TRANSACTIONS);

    const tip = Number((await getTipHeight?.().catch(() => 0)) || 0);
    if (tip > 0) {
        const recentStart = Math.max(tip - SQL_RECENT_BLOCKS + 1, 0);
        const recent = await fetchPage({
            start_height: recentStart,
            end_height: -1,
            max_transactions: 0
        });
        if (recent.some(isMined)) {
            // Nothing older to read once the recent blocks reach block 1:
            // the end height can't be 0, and block 0 holds no wallet
            // transactions.
            if (recent.length >= cap || recentStart <= 1) {
                return newest([recent], cap);
            }
            const older = await fetchPage({
                start_height: recentStart - 1,
                end_height: 1,
                max_transactions: cap - recent.length
            });
            return newest([recent, older], cap);
        }
    }

    // No mined transaction in the recent blocks. A short page holds the
    // whole wallet; a full one is the oldest, so read everything.
    const oldest = await fetchPage({
        ...ALL_FORWARD,
        max_transactions: cap
    });
    if (oldest.length < cap) return newest([oldest], cap);
    return newest([await fetchPage(ALL_FORWARD)], cap);
};

// lnd's GetTransactions (0.19+) pages a list in which unconfirmed
// transactions come after every confirmed one, and only then sorts the page
// by confirmations. A capped request in block order returns the oldest
// transactions, so we request mined transactions newest first, and fetch
// unconfirmed ones separately when that page is full. lnd < 0.19 ignores
// the cap and returns everything.
export const getNewestTransactions = async <T extends OnchainTransaction>({
    fetchPage,
    getTipHeight,
    limit = DEFAULT_MAX_TRANSACTIONS
}: {
    fetchPage: FetchPage<T>;
    // the chain tip, for lnd on a SQL database
    getTipHeight?: () => Promise<number>;
    limit?: number;
}): Promise<T[]> => {
    const confirmed = await fetchPage({
        ...NEWEST_CONFIRMED,
        max_transactions: limit
    });

    // Only unconfirmed transactions, if any: lnd on a SQL database, or a
    // wallet with no mined transactions on any database.
    if (!confirmed.some(isMined)) {
        return getNewestFromSql({ fetchPage, getTipHeight, limit });
    }

    // A short page already includes the unconfirmed transactions. A longer
    // one means the node ignored the cap and sent everything, as does a
    // limit of 0.
    if (limit === 0 || confirmed.length !== limit) return confirmed;

    const unconfirmed = await fetchPage(UNCONFIRMED);

    // A transaction that confirms between the two requests is in neither
    // and shows up on the next fetch. One that a reorg moves back to the
    // mempool is in both: keep the unconfirmed copy, which is newer.
    return newest([unconfirmed, confirmed], limit);
};
