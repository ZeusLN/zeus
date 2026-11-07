package app.zeusln.zeus.securestorage

import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.RejectedExecutionException

/**
 * Runs storage calls one at a time on one thread, off the caller's thread.
 *
 * [shutdown] lets calls already queued run to the end, so a write that was
 * started is never dropped, and the thread ends once they are done. A call
 * made after it is rejected instead of left unsettled.
 */
class SerialRunner(
    private val executor: ExecutorService = Executors.newSingleThreadExecutor()
) {
    fun run(block: () -> Any?, resolve: (Any?) -> Unit, reject: (Throwable) -> Unit) {
        try {
            executor.execute {
                try {
                    resolve(block())
                } catch (e: Throwable) {
                    // Throwable, not Exception: an Error must still settle
                    // the call, or the JS caller waits forever
                    reject(e)
                }
            }
        } catch (e: RejectedExecutionException) {
            reject(IllegalStateException("Storage module is shut down", e))
        }
    }

    fun shutdown() = executor.shutdown()
}
