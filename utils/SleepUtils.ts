const sleep = (milliseconds: number) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds));

export interface RetryOptions<T> {
    /** Async function to execute */
    fn: () => Promise<T>;
    /** Maximum number of attempts (default: 3) */
    maxRetries?: number;
    /** Base delay in ms between retries (default: 1000) */
    delayMs?: number;
    /** Double the delay with each attempt (default: false) */
    exponentialBackoff?: boolean;
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
    exponentialBackoff = false,
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
            const waitMs = exponentialBackoff
                ? delayMs * Math.pow(2, attempt - 1)
                : delayMs;
            await sleep(waitMs);
        }
    }
    throw lastError;
}

export { sleep, retry };
