package app.zeusln.zeus;

import lndmobile.NativeCallback
import com.facebook.react.bridge.Callback

class AndroidCallback: NativeCallback  {
    protected lateinit var rnCallback: Callback
    private val consumed = java.util.concurrent.atomic.AtomicBoolean(false)

    // Under React Native's new architecture, Callback can only be invoked once.
    // The Go LNC bridge may legitimately fire callbacks more than once for some
    // routes (potentially from different threads); the atomic compare-and-set
    // drops subsequent invocations safely to avoid a fatal abort.
    override fun sendResult(data: String) {
        if (::rnCallback.isInitialized && consumed.compareAndSet(false, true)) {
            rnCallback.invoke(data)
        }
    }

    fun setCallback(callback: Callback) {
        rnCallback = callback
    }
}
