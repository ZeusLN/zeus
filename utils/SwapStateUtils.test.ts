jest.mock('../stores/Stores');
jest.mock('./LocaleUtils');
const mockStored: { [key: string]: string | undefined } = {};
jest.mock('../storage', () => ({
    getItem: jest.fn(async (key: string) => mockStored[key])
}));
jest.mock('./SwapUtils', () => ({
    SWAPS_KEY: 'swaps',
    REVERSE_SWAPS_KEY: 'reverse-swaps'
}));

import { SwapState, SwapType } from '../models/Swap';
import Storage from '../storage';
import {
    formatSwapIdList,
    getStoredUnfinishedSwapIds,
    getUnfinishedSwapIds
} from './SwapStateUtils';

const sub = (id: string, status?: string) => ({
    id,
    type: SwapType.Submarine,
    status
});
const rev = (id: string, status?: string, fields: object = {}) => ({
    id,
    type: SwapType.Reverse,
    status,
    ...fields
});

describe('getUnfinishedSwapIds', () => {
    it.each([SwapState.TransactionClaimed, SwapState.TransactionRefunded])(
        'treats a submarine swap in %s as finished',
        (status) => {
            expect(getUnfinishedSwapIds([sub('a', status)])).toEqual([]);
        }
    );

    it.each([
        SwapState.Created,
        SwapState.InvoiceSet,
        SwapState.TransactionMempool,
        SwapState.TransactionConfirmed,
        SwapState.InvoicePending,
        SwapState.InvoicePaid,
        SwapState.TransactionClaimPending,
        // a locked-up swap in these states can still be refunded
        SwapState.InvoiceFailedToPay,
        SwapState.TransactionLockupFailed,
        SwapState.SwapExpired
    ])('treats a submarine swap in %s as unfinished', (status) => {
        expect(getUnfinishedSwapIds([sub('a', status)])).toEqual(['a']);
    });

    it.each([
        SwapState.TransactionClaimed,
        SwapState.InvoiceExpired,
        SwapState.SwapExpired,
        SwapState.TransactionFailed,
        SwapState.TransactionRefunded
    ])('treats a reverse swap in %s as finished', (status) => {
        expect(getUnfinishedSwapIds([rev('a', status)])).toEqual([]);
    });

    it.each([
        SwapState.Created,
        SwapState.TransactionMempool,
        SwapState.TransactionConfirmed
    ])('treats a reverse swap in %s as unfinished', (status) => {
        expect(getUnfinishedSwapIds([rev('a', status)])).toEqual(['a']);
    });

    it('treats a settled reverse swap as finished once its claim is recorded', () => {
        expect(
            getUnfinishedSwapIds([
                rev('a', SwapState.InvoiceSettled, { claimTxid: 'tx' })
            ])
        ).toEqual([]);
    });

    // the host settles the invoice once it has the preimage, which a
    // cooperative claim sends before the claim is broadcast
    it('treats a settled reverse swap without a recorded claim as unfinished', () => {
        expect(
            getUnfinishedSwapIds([
                rev('a', SwapState.InvoiceSettled),
                rev('b', SwapState.InvoiceSettled, {
                    claimTransactionHex: '02000000'
                }),
                rev('c', SwapState.InvoiceSettled, { claimTxid: '' })
            ])
        ).toEqual(['a', 'b', 'c']);
    });

    it('treats a swap without a status or type as unfinished', () => {
        expect(
            getUnfinishedSwapIds([
                sub('a'),
                { id: 'b', status: SwapState.SwapExpired }
            ])
        ).toEqual(['a', 'b']);
    });

    it('lists each id once and skips malformed entries', () => {
        expect(
            getUnfinishedSwapIds([
                null,
                'x',
                sub('a', SwapState.Created),
                rev('a', SwapState.Created),
                { type: SwapType.Reverse, status: SwapState.Created }
            ])
        ).toEqual(['a', '?']);
    });

    it('returns nothing for a non-array', () => {
        expect(getUnfinishedSwapIds(undefined as any)).toEqual([]);
    });
});

describe('getStoredUnfinishedSwapIds', () => {
    beforeEach(() => {
        for (const key of Object.keys(mockStored)) delete mockStored[key];
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => jest.restoreAllMocks());

    it('reads both lists and classifies by swap type', async () => {
        // rescued reverse swaps sit in the submarine list until the next
        // refresh moves them
        mockStored.swaps = JSON.stringify([
            sub('s1', SwapState.TransactionClaimed),
            rev('r0', SwapState.InvoiceSettled, { claimTxid: 'tx' }),
            rev('r1', SwapState.TransactionConfirmed),
            rev('r3', SwapState.InvoiceSettled)
        ]);
        mockStored['reverse-swaps'] = JSON.stringify([
            rev('r2', SwapState.TransactionMempool)
        ]);

        await expect(getStoredUnfinishedSwapIds()).resolves.toEqual({
            ids: ['r1', 'r3', 'r2'],
            unreadable: false
        });
    });

    it('returns nothing when no swaps are stored', async () => {
        await expect(getStoredUnfinishedSwapIds()).resolves.toEqual({
            ids: [],
            unreadable: false
        });
    });

    it('still reads the other list when one is not valid JSON', async () => {
        mockStored.swaps = '{not json';
        mockStored['reverse-swaps'] = JSON.stringify([
            rev('r1', SwapState.Created)
        ]);

        await expect(getStoredUnfinishedSwapIds()).resolves.toEqual({
            ids: ['r1'],
            unreadable: true
        });
    });

    it('reports a truncated list as unreadable', async () => {
        mockStored.swaps = '{';

        await expect(getStoredUnfinishedSwapIds()).resolves.toEqual({
            ids: [],
            unreadable: true
        });
    });

    it('reports a failed read as unreadable', async () => {
        (Storage.getItem as jest.Mock).mockImplementationOnce(async () => {
            throw new Error('keychain locked');
        });

        await expect(getStoredUnfinishedSwapIds()).resolves.toEqual({
            ids: [],
            unreadable: true
        });
    });

    it('reports a list that is not an array as unreadable', async () => {
        mockStored['reverse-swaps'] = JSON.stringify({
            id: 'r1',
            type: SwapType.Reverse
        });

        await expect(getStoredUnfinishedSwapIds()).resolves.toEqual({
            ids: [],
            unreadable: true
        });
    });
});

describe('formatSwapIdList', () => {
    it('joins up to the limit', () => {
        expect(formatSwapIdList(['a', 'b'])).toBe('a, b');
    });

    it('counts the ids past the limit', () => {
        expect(formatSwapIdList(['a', 'b', 'c', 'd'], 2)).toBe('a, b (+2)');
    });
});
