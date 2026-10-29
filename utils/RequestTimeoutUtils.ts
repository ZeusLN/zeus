// lnc-rn's request timer rejects with "<method> timed out after <ms>ms",
// the REST backend with 'Request timeout', and the native HTTP clients
// report their own timeouts as "timed out" / "timeout"
export const isRequestTimeout = (error: any): boolean => {
    const message = String(error?.message ?? error ?? '');
    return /timed out|timeout/i.test(message);
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface LookupOptions {
    attempts?: number;
    delayMs?: number;
}

// Runs a lookup until it finds something. Each lookup can fail on the same
// connection that timed out the original request, so a few attempts are
// made, delayMs apart. Resolves undefined if nothing was found.
export const lookUpWithRetries = async <T>(
    lookup: () => Promise<T | undefined>,
    { attempts = 3, delayMs = 5000 }: LookupOptions = {}
): Promise<T | undefined> => {
    for (let attempt = 0; attempt < attempts; attempt++) {
        if (attempt > 0) await wait(delayMs);
        try {
            const found = await lookup();
            if (found !== undefined) return found;
        } catch (error) {
            console.log('Error looking up a timed out request', error);
        }
    }
    return undefined;
};
