const sleep = (milliseconds: number) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds));

export interface RetryOptions<T> {
    /** Async function to execute */
    fn: () => Promise<T>;
    /** Maximum number of attempts (default: 3) */
    maxRetries?: number;
    /** Delay in ms between retries (default: 1000) */
    delayMs?: number;
    /** If provided, only retry when this returns true. Otherwise throw immediately. */
    shouldRetry?: (error: unknown) => boolean;
    onRetry?: (attempt: number, error: unknown) => Promise<T | void> | T | void;
}

/**
 * Retries an async operation with configurable attempts, delay, and recovery logic.
 * @throws The last error if all retries fail
 */
async function retry<T>({
    fn,
    maxRetries = 3,
    delayMs = 1000,
    shouldRetry,
    onRetry
}: RetryOptions<T>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            if (attempt === maxRetries) break;
            if (shouldRetry && !shouldRetry(error)) throw error;
            if (onRetry) await onRetry(attempt, error);
            if (attempt < maxRetries) await sleep(delayMs);
        }
    }
    throw lastError;
}

export { sleep, retry };
