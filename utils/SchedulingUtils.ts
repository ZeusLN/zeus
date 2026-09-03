/**
 * Helpers for deferring work that should not compete with rendering.
 *
 * React Native 0.86 deprecated `InteractionManager`. Its `runAfterInteractions`
 * is now a stub that resolves on the next `setImmediate` tick, so it no longer
 * waits for animations or gestures to settle. `requestIdleCallback` is the
 * supported replacement: it runs the task when the JS runtime has spare time
 * in a frame.
 *
 * Its `timeout` option is not a working backstop, so we keep our own timer
 * alongside it. In `NativeIdleCallbacks::requestIdleCallback` the local
 * `timeout` is declared and never assigned: `options.timeout` only feeds
 * `expirationTime`, which sets the `didTimeout` flag we ignore. Every idle
 * task is therefore scheduled with the default idle expiration of 5 minutes.
 * Nothing fires a task when its expiration passes either: expiration is only
 * the task queue's sort key, so a busy queue can hold an idle task back for
 * as long as higher priority work keeps sorting ahead of it. Verified in
 * 0.86.0, still present in 0.87.1.
 */

// Backstop for background work. Long enough that a busy startup gets to
// finish first rather than having a sweep dropped on top of it, short enough
// that the work is not put off indefinitely.
const DEFAULT_IDLE_TIMEOUT_MS = 10000;

// A task may resolve to anything: the value is ignored, but the promise is
// awaited so a rejection lands in the catch below. Typing this as
// `Promise<void>` would reject the common `() => store.doSomething()` shape
// and push callers into dropping the promise instead.
type IdleTask = () => void | PromiseLike<unknown>;

// Never rejects: nothing observes the result of an idle callback, so a
// rejected task would otherwise surface as an unhandled rejection.
const runTask = async (task: IdleTask) => {
    try {
        await task();
    } catch (error) {
        console.error('runWhenIdle: deferred task failed:', error);
    }
};

/**
 * Run `task` once the JS thread goes idle, or after `timeoutMs` at the latest.
 *
 * `timeoutMs` is a deadline, not a delay: a thread with spare time runs the
 * task well before it. The deadline is held by a timer of ours, not by
 * `requestIdleCallback`, whose `timeout` option React Native drops (see the
 * note at the top of this file). It has no effect on the fallback path, where
 * there is no idle scheduler to wait on and the task runs on the next
 * macrotask, well inside the deadline.
 *
 * Returns a cancel function. Call it (from `componentWillUnmount`, say) to
 * drop a task that has not run yet; calling it afterwards is a no-op.
 *
 * Return the promise from an async `task` rather than dropping it, so a
 * rejection is logged here instead of surfacing as an unhandled rejection.
 */
export const runWhenIdle = (
    task: IdleTask,
    timeoutMs: number = DEFAULT_IDLE_TIMEOUT_MS
): (() => void) => {
    // Guards both directions: a cancel after the task ran, and a callback
    // that fires anyway after a cancel.
    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    // Opaque `IdleCallbackHandle` (see typings/idle-callback.d.ts), so its
    // presence is tracked separately rather than by testing it for undefined.
    let idleHandle: unknown;
    let hasIdleHandle = false;

    // Whichever of the two fires first drops the other.
    const clearPending = () => {
        if (timeoutId !== undefined) {
            clearTimeout(timeoutId);
            timeoutId = undefined;
        }
        if (hasIdleHandle) {
            hasIdleHandle = false;
            if (typeof cancelIdleCallback === 'function') {
                cancelIdleCallback(idleHandle);
            }
        }
    };

    const run = () => {
        if (settled) return;
        settled = true;
        clearPending();
        runTask(task);
    };

    const runFromIdle = () => {
        // The scheduler is already running this callback, so the handle is
        // spent and there is nothing left to cancel.
        hasIdleHandle = false;
        run();
    };

    const cancel = () => {
        if (settled) return;
        settled = true;
        clearPending();
    };

    try {
        // The feature detect is inside the try on purpose. React Native
        // installs these globals as lazy getters over
        // `TurboModuleRegistry.getEnforcing`, so a missing native module
        // throws on the property read itself, not on the call.
        if (typeof requestIdleCallback === 'function') {
            // Still passed for correctness, and so this becomes a priority
            // hint if React Native ever wires the option up. The timer below
            // is what actually bounds the wait.
            idleHandle = requestIdleCallback(runFromIdle, {
                timeout: timeoutMs
            });
            hasIdleHandle = true;
            timeoutId = setTimeout(run, timeoutMs);
            return cancel;
        }
    } catch {
        // The legacy runtime scheduler throws 'requestIdleCallback is not
        // supported in legacy runtime scheduler'. Fall through to the
        // timer below rather than dropping the task on the floor.
    }

    // No idle scheduler (Jest, legacy runtime). A macrotask at least gets the
    // work off the current call stack, which is all the deprecated
    // `runAfterInteractions` stub did anyway. Not `timeoutMs`: that is the
    // latest the task may run, and with nothing to wait for there is no
    // reason to hold it back.
    timeoutId = setTimeout(run, 0);
    return cancel;
};
