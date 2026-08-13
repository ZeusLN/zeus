const AVG_BLOCK_TIME_SECONDS = 600;

/**
 * Estimate the chain tip height from the node's own best header when no
 * external tip source is reachable, assuming one block per ten minutes
 * since that header's timestamp. During initial header sync the timestamp
 * lags far behind wall-clock time, so the estimate keeps growing toward
 * the real tip as headers catch up; once caught up it converges on the
 * node's current height.
 */
const estimateBestBlockHeight = (
    currentBlockHeight: number,
    bestHeaderTimestamp?: string | number,
    nowMs?: number
): number => {
    if (!currentBlockHeight) return currentBlockHeight || 0;

    const headerTime = Number(bestHeaderTimestamp);
    if (!Number.isFinite(headerTime) || headerTime <= 0) {
        return currentBlockHeight;
    }

    const nowSeconds = Math.floor((nowMs ?? Date.now()) / 1000);
    const lagSeconds = Math.max(0, nowSeconds - headerTime);
    return currentBlockHeight + Math.floor(lagSeconds / AVG_BLOCK_TIME_SECONDS);
};

export default {
    estimateBestBlockHeight
};
