package app.zeusln.zeus

import android.util.Log

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

class TorServiceModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "TorServiceModule"
        private const val NEW_IDENTITY_EVENT = "TorServiceNewIdentity"

        @Volatile private var reactContext: ReactApplicationContext? = null

        @JvmStatic
        fun emitNewIdentity() {
            try {
                reactContext
                    ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    ?.emit(NEW_IDENTITY_EVENT, null)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to emit new identity event: ${e.message}")
            }
        }
    }

    init {
        TorServiceModule.reactContext = reactContext
    }

    override fun getName(): String = "TorServiceModule"

    @ReactMethod
    fun startService(title: String, text: String, newIdentityLabel: String, promise: Promise) {
        try {
            TorService.startService(reactApplicationContext, title, text, newIdentityLabel)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("TOR_SERVICE_START_FAILED", e.message, e)
        }
    }

    @ReactMethod
    fun updateNotification(title: String, text: String, newIdentityLabel: String, promise: Promise) {
        try {
            TorService.updateNotification(reactApplicationContext, title, text, newIdentityLabel)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("TOR_SERVICE_UPDATE_FAILED", e.message, e)
        }
    }

    @ReactMethod
    fun stopService(promise: Promise) {
        try {
            TorService.stopService(reactApplicationContext)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("TOR_SERVICE_STOP_FAILED", e.message, e)
        }
    }
}
