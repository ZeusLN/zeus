package app.zeusln.zeus;

import lndmobile.NativeCallback
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule

import android.util.Log

class AndroidStreamingCallback: NativeCallback  {
    protected lateinit var eventId: String
    protected lateinit var streamCallback: (event: String, data: String) -> Unit

    override fun sendResult(data: String) {
        streamCallback(eventId, data)
    }

    fun setEventName(name: String) {
        eventId = name
    }

    fun setCallback(callback: (event: String, data: String) -> Unit) {
        streamCallback = callback
    }
}
