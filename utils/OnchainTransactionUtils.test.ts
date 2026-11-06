import {
    ALL_FORWARD,
    DEFAULT_MAX_TRANSACTIONS,
    getNewestTransactions,
    SQL_MAX_TRANSACTIONS,
    SQL_RECENT_BLOCKS,
    TransactionPageRequest
} from './OnchainTransactionUtils';

interface FakeTx {
    tx_hash: string;
    block_height: number;
    num_confirmations: number;
}

const TIP = 900_000;
const MAX_HEIGHT = 2 ** 31 - 1;

// Mirrors lnd 0.19+ GetTransactions: end height 0 means -1. wtxmgr ranges
// the blocks between the two heights (backwards when start > end, with a
// negative height meaning the top), and includes unmined transactions when
// either height is negative. ListTransactionDetails lists the mined ones
// in range order with the unmined ones after them and slices the first
// `max_transactions` (0 means all). RPCTransactionDetails then sorts the
// page by confirmations, ascending.
//
// On a SQL database (`sql`), a backwards range seeks to the start height
// and finds nothing when no block at or above it holds a wallet
// transaction, so it returns no mined ones.
const fakeLnd = (
    confirmed: FakeTx[],
    unconfirmed: FakeTx[] = [],
    { ignoresMax = false, sql = false } = {}
) => {
    const calls: TransactionPageRequest[] = [];
    const fetchPage = async (request: TransactionPageRequest) => {
        calls.push(request);
        const startHeight = request.start_height || 0;
        const endHeight = request.end_height || -1;
        const begin = startHeight < 0 ? MAX_HEIGHT : startHeight;
        const end = endHeight < 0 ? MAX_HEIGHT : endHeight;

        const inRange = confirmed.filter(
            (tx) =>
                tx.block_height >= Math.min(begin, end) &&
                tx.block_height <= Math.max(begin, end)
        );
        const seekFails =
            sql &&
            begin > end &&
            !confirmed.some((tx) => tx.block_height >= begin);
        const mined = seekFails
            ? []
            : begin < end
            ? inRange.sort((a, b) => a.block_height - b.block_height)
            : inRange.sort((a, b) => b.block_height - a.block_height);
        const txs = [
            ...mined,
            ...(startHeight < 0 || endHeight < 0 ? unconfirmed : [])
        ];
        const page =
            ignoresMax || request.max_transactions === 0
                ? txs
                : txs.slice(0, request.max_transactions);
        return [...page].sort(
            (a, b) => a.num_confirmations - b.num_confirmations
        );
    };
    return { fetchPage, calls };
};

// one transaction per block, ending at the tip
const mined = (count: number): FakeTx[] =>
    Array.from({ length: count }, (_, i) => {
        const block_height = TIP - count + 1 + i;
        return {
            tx_hash: `tx${i}`,
            block_height,
            num_confirmations: TIP - block_height + 1
        };
    });

const pending: FakeTx[] = [
    { tx_hash: 'pending0', block_height: 0, num_confirmations: 0 },
    { tx_hash: 'pending1', block_height: 0, num_confirmations: 0 }
];

const NEWEST_CONFIRMED_CALL = {
    start_height: -1,
    end_height: 1,
    max_transactions: DEFAULT_MAX_TRANSACTIONS
};

describe('getNewestTransactions', () => {
    it('makes one request when the wallet has fewer than the limit', async () => {
        const confirmed = mined(10);
        const { fetchPage, calls } = fakeLnd(confirmed, pending);

        const txs = await getNewestTransactions({ fetchPage });

        expect(txs).toHaveLength(12);
        expect(txs.slice(0, 2)).toEqual(pending);
        expect(txs[2]).toEqual(confirmed[9]);
        expect(calls).toEqual([NEWEST_CONFIRMED_CALL]);
    });

    it('returns the newest transactions, including unconfirmed, when the wallet exceeds the limit', async () => {
        const confirmed = mined(600);
        const { fetchPage, calls } = fakeLnd(confirmed, pending);

        const txs = await getNewestTransactions({ fetchPage });

        expect(txs).toHaveLength(DEFAULT_MAX_TRANSACTIONS);
        expect(txs.slice(0, 2)).toEqual(pending);
        // the newest 498 mined, newest first
        expect(txs.slice(2)).toEqual(confirmed.slice(102).reverse());
        expect(calls).toEqual([
            NEWEST_CONFIRMED_CALL,
            { start_height: -1, end_height: -1, max_transactions: 0 }
        ]);
    });

    it('returns the newest mined transactions when none are unconfirmed', async () => {
        const confirmed = mined(600);
        const { fetchPage, calls } = fakeLnd(confirmed);

        const txs = await getNewestTransactions({ fetchPage });

        expect(txs).toEqual(confirmed.slice(100).reverse());
        expect(calls).toHaveLength(2);
    });

    it('keeps everything in the order lnd sent when the node ignores the cap (lnd < 0.19)', async () => {
        const confirmed = mined(600);
        const { fetchPage, calls } = fakeLnd(confirmed, pending, {
            ignoresMax: true
        });

        const txs = await getNewestTransactions({ fetchPage });

        expect(txs).toHaveLength(602);
        expect(txs.slice(0, 2)).toEqual(pending);
        expect(calls).toHaveLength(1);
    });

    it('honors a custom limit', async () => {
        const confirmed = mined(300);
        const { fetchPage, calls } = fakeLnd(confirmed, pending);

        const txs = await getNewestTransactions({ fetchPage, limit: 20 });

        expect(txs).toHaveLength(20);
        expect(txs.slice(0, 2)).toEqual(pending);
        expect(txs[2]).toEqual(confirmed[299]);
        expect(calls[0].max_transactions).toBe(20);
    });

    it('makes one uncapped request when the limit is 0', async () => {
        const confirmed = mined(600);
        const { fetchPage, calls } = fakeLnd(confirmed, pending);

        const txs = await getNewestTransactions({ fetchPage, limit: 0 });

        expect(txs).toHaveLength(602);
        expect(calls).toEqual([
            { ...NEWEST_CONFIRMED_CALL, max_transactions: 0 }
        ]);
    });

    describe('on a SQL database', () => {
        const getTipHeight = async () => TIP;
        const RECENT_CALL = {
            start_height: TIP - SQL_RECENT_BLOCKS + 1,
            end_height: -1,
            max_transactions: 0
        };
        const olderCall = (max_transactions: number) => ({
            start_height: TIP - SQL_RECENT_BLOCKS,
            end_height: 1,
            max_transactions
        });
        const OLDEST_CALL = {
            start_height: 0,
            end_height: -1,
            max_transactions: SQL_MAX_TRANSACTIONS
        };

        // one transaction in each of these blocks
        const at = (heights: number[]): FakeTx[] =>
            heights.map((block_height) => ({
                tx_hash: `h${block_height}`,
                block_height,
                num_confirmations: TIP - block_height + 1
            }));
        const range = (from: number, count: number) =>
            Array.from({ length: count }, (_, i) => from + i);
        const hashes = (txs: FakeTx[]) => txs.map((tx) => tx.tx_hash);

        // 50 transactions in the last 50 blocks, 300 long before them
        const recentAndOlder = () => {
            const recent = at(range(TIP - 49, 50));
            const older = at(range(800_000, 300));
            return { recent, older, all: [...older, ...recent] };
        };

        it('reads the recent blocks forwards, then older ones backwards from below them', async () => {
            const { recent, older, all } = recentAndOlder();
            const { fetchPage, calls } = fakeLnd(all, pending, { sql: true });

            const txs = await getNewestTransactions({
                fetchPage,
                getTipHeight
            });

            expect(txs).toHaveLength(SQL_MAX_TRANSACTIONS);
            expect(hashes(txs)).toEqual([
                'pending0',
                'pending1',
                ...hashes([...recent].reverse()),
                ...hashes(older.slice(152).reverse())
            ]);
            expect(calls).toEqual([
                NEWEST_CONFIRMED_CALL,
                RECENT_CALL,
                olderCall(148)
            ]);
        });

        it('returns every transaction of a wallet below the cap', async () => {
            const confirmed = mined(10);
            const { fetchPage, calls } = fakeLnd(confirmed, pending, {
                sql: true
            });

            const txs = await getNewestTransactions({
                fetchPage,
                getTipHeight
            });

            expect(txs).toEqual([...pending, ...[...confirmed].reverse()]);
            expect(calls).toEqual([
                NEWEST_CONFIRMED_CALL,
                RECENT_CALL,
                olderCall(188)
            ]);
        });

        it('keeps the newest of the recent blocks when they hold more than the cap', async () => {
            const confirmed = mined(600);
            const { fetchPage, calls } = fakeLnd(confirmed, pending, {
                sql: true
            });

            const txs = await getNewestTransactions({
                fetchPage,
                getTipHeight
            });

            expect(txs).toEqual([
                ...pending,
                ...confirmed.slice(402).reverse()
            ]);
            expect(calls).toEqual([NEWEST_CONFIRMED_CALL, RECENT_CALL]);
        });

        it('caps the result at a smaller limit', async () => {
            const { recent, all } = recentAndOlder();
            const { fetchPage, calls } = fakeLnd(all, pending, { sql: true });

            const txs = await getNewestTransactions({
                fetchPage,
                getTipHeight,
                limit: 20
            });

            expect(hashes(txs)).toEqual([
                'pending0',
                'pending1',
                ...hashes(recent.slice(32).reverse())
            ]);
            expect(calls).toHaveLength(2);
        });

        it('reads a capped page from the first block when the recent blocks hold no mined transaction', async () => {
            const confirmed = at(range(800_000, 20));
            const { fetchPage, calls } = fakeLnd(confirmed, pending, {
                sql: true
            });

            const txs = await getNewestTransactions({
                fetchPage,
                getTipHeight
            });

            expect(txs).toEqual([...pending, ...[...confirmed].reverse()]);
            expect(calls).toEqual([
                NEWEST_CONFIRMED_CALL,
                RECENT_CALL,
                OLDEST_CALL
            ]);
        });

        it('reads everything when an idle wallet holds more than the cap', async () => {
            const confirmed = at(range(800_000, 300));
            const { fetchPage, calls } = fakeLnd(confirmed, pending, {
                sql: true
            });

            const txs = await getNewestTransactions({
                fetchPage,
                getTipHeight
            });

            expect(txs).toEqual([
                ...pending,
                ...confirmed.slice(102).reverse()
            ]);
            expect(calls).toEqual([
                NEWEST_CONFIRMED_CALL,
                RECENT_CALL,
                OLDEST_CALL,
                ALL_FORWARD
            ]);
        });

        it('skips the recent blocks when the tip height is unavailable', async () => {
            const confirmed = mined(10);
            const { fetchPage, calls } = fakeLnd(confirmed, pending, {
                sql: true
            });

            const txs = await getNewestTransactions({
                fetchPage,
                getTipHeight: () => Promise.reject(new Error('offline'))
            });

            expect(txs).toHaveLength(12);
            expect(calls).toEqual([NEWEST_CONFIRMED_CALL, OLDEST_CALL]);
        });

        it('returns everything when the limit is 0', async () => {
            const confirmed = mined(600);
            const { fetchPage, calls } = fakeLnd(confirmed, pending, {
                sql: true
            });

            const txs = await getNewestTransactions({
                fetchPage,
                getTipHeight,
                limit: 0
            });

            expect(txs).toHaveLength(602);
            expect(txs[2]).toEqual(confirmed[599]);
            expect(calls).toEqual([
                { ...NEWEST_CONFIRMED_CALL, max_transactions: 0 },
                { start_height: 0, end_height: -1, max_transactions: 0 }
            ]);
        });

        it('caps the result on lnd < 0.19 too, which ignores the cap', async () => {
            const { recent, older, all } = recentAndOlder();
            const { fetchPage } = fakeLnd(all, pending, {
                sql: true,
                ignoresMax: true
            });

            const txs = await getNewestTransactions({
                fetchPage,
                getTipHeight
            });

            expect(hashes(txs)).toEqual([
                'pending0',
                'pending1',
                ...hashes([...recent].reverse()),
                ...hashes(older.slice(152).reverse())
            ]);
        });
    });

    it('returns only the unconfirmed transactions of a wallet with no mined ones', async () => {
        const { fetchPage, calls } = fakeLnd([], pending);

        const txs = await getNewestTransactions({ fetchPage });

        expect(txs).toEqual(pending);
        expect(calls).toHaveLength(2);
    });

    it('returns an empty list for an empty wallet', async () => {
        const { fetchPage } = fakeLnd([]);

        expect(await getNewestTransactions({ fetchPage })).toEqual([]);
        expect(await getNewestTransactions({ fetchPage, limit: 0 })).toEqual(
            []
        );
    });

    it('keeps the unconfirmed copy of a transaction returned by both requests', async () => {
        const confirmed = mined(4);
        const fetchPage = async (request: TransactionPageRequest) =>
            request.end_height === 1
                ? [...confirmed].reverse()
                : [
                      {
                          tx_hash: 'tx3',
                          block_height: 0,
                          num_confirmations: 0
                      },
                      ...pending
                  ];

        // the limit leaves room for the stale confirmed copy, so a missing
        // dedupe would show tx3 twice
        const txs = await getNewestTransactions({ fetchPage, limit: 4 });

        expect(txs.map((tx) => tx.tx_hash)).toEqual([
            'tx3',
            'pending0',
            'pending1',
            'tx2'
        ]);
        expect(txs[0].num_confirmations).toBe(0);
    });

    it('sorts by confirmations itself instead of relying on the order lnd sends', async () => {
        const confirmed = mined(4);
        // a full page in block order, oldest first
        const fetchPage = async (request: TransactionPageRequest) =>
            request.end_height === 1 ? [...confirmed] : [pending[0]];

        const txs = await getNewestTransactions({ fetchPage, limit: 4 });

        expect(txs.map((tx) => tx.tx_hash)).toEqual([
            'pending0',
            'tx3',
            'tx2',
            'tx1'
        ]);
    });
});
