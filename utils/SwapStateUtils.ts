import { SwapState, SwapType } from '../models/Swap';
import Storage from '../storage';
import { SWAPS_KEY, REVERSE_SWAPS_KEY } from './SwapUtils';

// A submarine swap only stops needing its stored keys once the host has
// claimed the lockup or the user has refunded it. Failed and expired
// submarine swaps stay listed: their lockup can still be refunded.
const FINAL_SUBMARINE_SWAP_STATES: string[] = [
    SwapState.TransactionClaimed,
    SwapState.TransactionRefunded
];

// A reverse swap is done once its claim went out (the host settled the
// invoice) or the host gave up on it, which fails the user's payment back.
const FINAL_REVERSE_SWAP_STATES: string[] = [
    SwapState.InvoiceSettled,
    SwapState.TransactionClaimed,
    SwapState.InvoiceExpired,
    SwapState.SwapExpired,
    SwapState.TransactionFailed,
    SwapState.TransactionRefunded
];

// IDs of swaps that may still need their stored keys to be claimed or
// refunded. A swap without a type is treated as submarine, the stricter
// of the two.
export const getUnfinishedSwapIds = (swaps: any[]): string[] => {
    if (!Array.isArray(swaps)) return [];
    const ids: string[] = [];
    for (const swap of swaps) {
        if (!swap || typeof swap !== 'object') continue;
        const finalStates =
            swap.type === SwapType.Reverse
                ? FINAL_REVERSE_SWAP_STATES
                : FINAL_SUBMARINE_SWAP_STATES;
        if (finalStates.includes(swap.status)) continue;
        const id = swap.id ? String(swap.id) : '?';
        if (!ids.includes(id)) ids.push(id);
    }
    return ids;
};

// Reads both stored swap lists. Rescued swaps are written to SWAPS_KEY
// whatever their type, so the type of each swap decides, not the list.
// unreadable is set when a list could not be read, did not parse, or is not
// an array: its swaps are unknown, so callers must not treat an empty ids
// list as proof that no swap is pending.
export const getStoredUnfinishedSwapIds = async (): Promise<{
    ids: string[];
    unreadable: boolean;
}> => {
    const swaps: any[] = [];
    let unreadable = false;
    for (const key of [SWAPS_KEY, REVERSE_SWAPS_KEY]) {
        try {
            const stored = await Storage.getItem(key);
            const parsed = stored ? JSON.parse(stored) : [];
            if (Array.isArray(parsed)) {
                swaps.push(...parsed);
            } else {
                console.warn(`[SwapStateUtils] ${key} is not a list`);
                unreadable = true;
            }
        } catch (e) {
            console.warn(`[SwapStateUtils] Could not read ${key}:`, e);
            unreadable = true;
        }
    }
    return { ids: getUnfinishedSwapIds(swaps), unreadable };
};

// Lists at most `max` IDs, then the number left out.
export const formatSwapIdList = (ids: string[], max = 5): string => {
    const shown = ids.slice(0, max).join(', ');
    return ids.length > max ? `${shown} (+${ids.length - max})` : shown;
};
