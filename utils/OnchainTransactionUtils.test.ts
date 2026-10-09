import {
    DEFAULT_MAX_TRANSACTIONS,
    getNewestTransactions,
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
const fakeLnd = (
    confirmed: FakeTx[],
    unconfirmed: FakeTx[] = [],
    { ignoresMax = false } = {}
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
        const mined =
            begin < end
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

    it('keeps one copy of a transaction returned by both requests', async () => {
        const confirmed = mined(3);
        const fetchPage = async (request: TransactionPageRequest) =>
            request.end_height === 1
                ? [...confirmed].reverse()
                : [
                      {
                          tx_hash: 'tx2',
                          block_height: 0,
                          num_confirmations: 0
                      },
                      ...pending
                  ];

        const txs = await getNewestTransactions({ fetchPage, limit: 3 });

        expect(txs.map((tx) => tx.tx_hash)).toEqual([
            'pending0',
            'pending1',
            'tx2'
        ]);
        expect(txs[2]).toEqual(confirmed[2]);
    });
});
