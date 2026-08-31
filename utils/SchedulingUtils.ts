/**
 * Helpers for deferring work that should not compete with rendering.
 *
 * React Native 0.86 deprecated `InteractionManager`. Its `runAfterInteractions`
 * is now a stub that resolves on the next `setImmediate` tick, so it no longer
 * waits for animations or gestures to settle. `requestIdleCallback` is the
 * supported replacement: it runs the task when the JS runtime has spare time
 * in a frame, and it takes a timeout so the task still runs on a thread that
 * never goes idle.
 */

// Backstop for background work. Long enough to let a busy startup finish
// first, short enough that a deferred sweep is not put off indefinitely.
const DEFAULT_IDLE_TIMEOUT_MS = 2000;

// Never rejects: nothing observes the result of an idle callback, so a
// rejected task would otherwise surface as an unhandled rejection.
const runTask = async (task: () => void | Promise<void>) => {
    try {
        await task();
    } catch (error) {
        console.error('runWhenIdle: deferred task failed:', error);
    }
};

/**
 * Run `task` once the JS thread goes idle, or after `timeoutMs` at the latest.
 *
 * Returns a cancel function. Call it (from `componentWillUnmount`, say) to
 * drop a task that has not run yet; calling it afterwards is a no-op.
 */
export const runWhenIdle = (
    task: () => void | Promise<void>,
    timeoutMs: number = DEFAULT_IDLE_TIMEOUT_MS
): (() => void) => {
    // Guards both directions: a cancel after the task ran, and a callback
    // that fires anyway after a cancel.
    let settled = false;
    const run = () => {
        if (settled) return;
        settled = true;
        runTask(task);
    };

    if (typeof requestIdleCallback === 'function') {
        try {
            const handle = requestIdleCallback(run, { timeout: timeoutMs });
            return () => {
                if (settled) return;
                settled = true;
                if (typeof cancelIdleCallback === 'function') {
                    cancelIdleCallback(handle);
                }
            };
        } catch {
            // The legacy runtime scheduler throws 'requestIdleCallback is not
            // supported in legacy runtime scheduler'. Fall through to the
            // timer below rather than dropping the task on the floor.
        }
    }

    // No idle scheduler (Jest, legacy runtime). A macrotask at least gets the
    // work off the current call stack, which is all the deprecated
    // `runAfterInteractions` stub did anyway.
    const timeoutId = setTimeout(run, 0);
    return () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
    };
};
