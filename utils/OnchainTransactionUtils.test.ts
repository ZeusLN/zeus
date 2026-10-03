import {
    DEFAULT_MAX_TRANSACTIONS,
    getNewestTransactions,
    INITIAL_WINDOW_BLOCKS,
    TransactionPageRequest
} from './OnchainTransactionUtils';

interface FakeTx {
    id: string;
    block_height: number;
}

// Mirrors lnd 0.19+ ListTransactionDetails: filter by start height, list
// confirmed transactions oldest first with unconfirmed ones appended, then
// slice [index_offset, index_offset + max_transactions). max 0 means all.
const fakeLnd = (
    confirmed: FakeTx[],
    unconfirmed: FakeTx[] = [],
    { ignoresMax = false } = {}
) => {
    const calls: TransactionPageRequest[] = [];
    const fetchPage = async (request: TransactionPageRequest) => {
        calls.push(request);
        const txs = [
            ...confirmed.filter(
                (tx) => tx.block_height >= (request.start_height || 0)
            ),
            ...unconfirmed
        ];
        if (ignoresMax || request.max_transactions === 0) return txs;
        return txs.slice(0, request.max_transactions);
    };
    return { fetchPage, calls };
};

// one transaction per block from `fromHeight` upward
const mined = (count: number, fromHeight: number, step = 1): FakeTx[] =>
    Array.from({ length: count }, (_, i) => ({
        id: `tx${i}`,
        block_height: fromHeight + i * step
    }));

const pending: FakeTx[] = [
    { id: 'pending0', block_height: 0 },
    { id: 'pending1', block_height: 0 }
];

describe('getNewestTransactions', () => {
    it('returns everything in one call when the wallet has fewer than the limit', async () => {
        const { fetchPage, calls } = fakeLnd(mined(10, 800_000), pending);
        const getTipHeight = jest.fn();

        const txs = await getNewestTransactions({ fetchPage, getTipHeight });

        expect(txs).toHaveLength(12);
        expect(calls).toEqual([{ max_transactions: DEFAULT_MAX_TRANSACTIONS }]);
        expect(getTipHeight).not.toHaveBeenCalled();
    });

    it('returns everything when the node ignores the cap (lnd < 0.19)', async () => {
        const { fetchPage, calls } = fakeLnd(mined(600, 800_000), [], {
            ignoresMax: true
        });

        const txs = await getNewestTransactions({
            fetchPage,
            getTipHeight: async () => 900_000
        });

        expect(txs).toHaveLength(600);
        expect(calls).toHaveLength(1);
    });

    it('returns the newest transactions, including unconfirmed, when the wallet exceeds the limit', async () => {
        // 600 confirmed, one per block, ending at the tip
        const tip = 900_000;
        const confirmed = mined(600, tip - 599);
        const { fetchPage } = fakeLnd(confirmed, pending);

        const txs = await getNewestTransactions({
            fetchPage,
            getTipHeight: async () => tip
        });

        expect(txs).toHaveLength(DEFAULT_MAX_TRANSACTIONS);
        expect(txs.slice(-2)).toEqual(pending);
        // newest confirmed is kept, oldest are dropped
        expect(txs).toContainEqual(confirmed[599]);
        expect(txs).not.toContainEqual(confirmed[0]);
        expect(txs[0]).toEqual(confirmed[102]);
    });

    it('widens the window until it holds enough transactions', async () => {
        // 600 transactions spaced 100 blocks apart: the first window
        // (1008 blocks) holds ~10, so it has to widen
        const tip = 900_000;
        const confirmed = mined(600, tip - 599 * 100, 100);
        const { fetchPage, calls } = fakeLnd(confirmed);

        const txs = await getNewestTransactions({
            fetchPage,
            getTipHeight: async () => tip,
            limit: 100
        });

        expect(txs).toEqual(confirmed.slice(-100));
        const windows = calls
            .slice(1)
            .map((call) => tip - (call.start_height as number));
        expect(windows[0]).toBe(INITIAL_WINDOW_BLOCKS);
        expect(windows.every((w, i) => i === 0 || w > windows[i - 1])).toBe(
            true
        );
        expect(calls.slice(1).every((c) => c.max_transactions === 0)).toBe(
            true
        );
    });

    it('stops at genesis for a sparse wallet', async () => {
        const tip = 900_000;
        const confirmed = mined(5, 100_000);
        const { fetchPage, calls } = fakeLnd(confirmed);

        const txs = await getNewestTransactions({
            fetchPage,
            getTipHeight: async () => tip,
            limit: 5
        });

        expect(txs).toEqual(confirmed);
        expect(calls[calls.length - 1].start_height).toBe(0);
    });

    it('falls back to fetching everything when the tip height is unavailable', async () => {
        const confirmed = mined(600, 800_000);
        const { fetchPage, calls } = fakeLnd(confirmed, pending);

        const txs = await getNewestTransactions({
            fetchPage,
            getTipHeight: async () => {
                throw new Error('getinfo failed');
            }
        });

        expect(txs).toHaveLength(DEFAULT_MAX_TRANSACTIONS);
        expect(txs.slice(-2)).toEqual(pending);
        expect(calls[1]).toEqual({ max_transactions: 0 });
    });
});
