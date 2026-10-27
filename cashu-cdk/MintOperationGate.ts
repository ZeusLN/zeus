/**
 * Keeps CDK saga recovery for a mint apart from the wallet operations that
 * drive sagas on that mint.
 *
 * recover_incomplete_sagas resumes or compensates every saga it finds in the
 * database, including one an operation in this process is still running (a
 * melt waiting on the mint, a send between prepare and confirm). So recovery
 * only starts while no operation is in flight on the mint, and operations that
 * start while it runs wait for it.
 *
 * CDK reads the incomplete sagas once, from the local database, before it
 * makes any network call, and only acts on those. An operation that starts
 * after that read creates a saga recovery never sees. Waiting for recovery
 * therefore only needs to cover that read, which is why the wait is capped
 * instead of lasting until recovery has checked every saga with the mint.
 */

export const RECOVERY_WAIT_MS = 10000;

interface MintGateState {
    operations: number;
    recovery?: Promise<void>;
}

const normalizeKey = (mintUrl: string): string =>
    mintUrl.trim().replace(/\/+$/, '').toLowerCase();

export default class MintOperationGate {
    private mints = new Map<string, MintGateState>();

    constructor(private readonly recoveryWaitMs: number = RECOVERY_WAIT_MS) {}

    private state(mintUrl: string): MintGateState {
        const key = normalizeKey(mintUrl);
        let state = this.mints.get(key);
        if (!state) {
            state = { operations: 0 };
            this.mints.set(key, state);
        }
        return state;
    }

    /**
     * Run a wallet operation on mintUrl. Operations on a mint run
     * concurrently with each other; one that starts while recovery runs on
     * the mint first waits for it, for at most recoveryWaitMs.
     */
    async runOperation<T>(mintUrl: string, operation: () => Promise<T>) {
        const state = this.state(mintUrl);
        if (state.recovery) {
            let timer: ReturnType<typeof setTimeout> | undefined;
            await Promise.race([
                state.recovery,
                new Promise<void>((resolve) => {
                    timer = setTimeout(resolve, this.recoveryWaitMs);
                })
            ]);
            clearTimeout(timer);
        }

        state.operations += 1;
        try {
            return await operation();
        } finally {
            state.operations -= 1;
        }
    }

    /**
     * Run recovery on mintUrl if no operation is in flight there and no
     * recovery is already running. Returns { ran: false } without calling
     * recover otherwise.
     */
    async tryRunRecovery<T>(
        mintUrl: string,
        recover: () => Promise<T>
    ): Promise<{ ran: true; result: T } | { ran: false }> {
        const state = this.state(mintUrl);
        if (state.operations > 0 || state.recovery) {
            return { ran: false };
        }

        const run = recover();
        state.recovery = run.then(
            () => undefined,
            () => undefined
        );
        try {
            return { ran: true, result: await run };
        } finally {
            state.recovery = undefined;
        }
    }
}
