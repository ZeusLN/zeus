package app.zeusln.zeus;

import lndmobile.NativeCallback
import com.facebook.react.bridge.Callback

class AndroidCallback: NativeCallback  {
    protected lateinit var rnCallback: Callback

    override fun sendResult(data: String) {
        rnCallback.invoke(data)
    }

    fun setCallback(callback: Callback) {
        rnCallback = callback
    }
}
