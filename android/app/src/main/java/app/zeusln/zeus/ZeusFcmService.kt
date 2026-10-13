package app.zeusln.zeus

import android.content.Intent
import android.util.Log

import androidx.core.content.ContextCompat

import com.google.firebase.messaging.RemoteMessage
import com.wix.reactnativenotifications.fcm.FcmInstanceIdListenerService

/**
 * FCM entry point. Subclasses the react-native-notifications service so
 * ordinary alert notifications and token refreshes keep working, but
 * intercepts ZEUS Pay 'self' invoice-request data messages: those must wake
 * the app from a killed state, which the library never does (it only posts a
 * tray notification and emits to an existing JS context).
 *
 * High-priority FCM data messages grant a temporary exemption from the
 * Android 12+ background foreground-service-start restriction, which is what
 * makes startForegroundService legal here.
 */
class ZeusFcmService : FcmInstanceIdListenerService() {

    companion object {
        private const val TAG = "ZeusFcmService"
        // Requests older than this can't be answered in time: the server
        // holds the LNURL-pay callback for ~27s.
        private const val MAX_REQUEST_AGE_SECONDS = 25L
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val data = message.data

        if (data["type"] == "invoice_request" && data["request_id"] != null) {
            val ts = data["ts"]?.toLongOrNull() ?: 0L
            val ageSeconds = System.currentTimeMillis() / 1000 - ts
            if (ts > 0 && ageSeconds > MAX_REQUEST_AGE_SECONDS) {
                Log.i(TAG, "Dropping stale invoice request (age ${ageSeconds}s)")
                return
            }

            Log.i(TAG, "Starting SelfPayHeadlessService for invoice request")
            val intent = Intent(this, SelfPayHeadlessService::class.java)
            for ((key, value) in data) {
                intent.putExtra(key, value)
            }
            try {
                ContextCompat.startForegroundService(this, intent)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to start SelfPayHeadlessService: ${e.message}")
            }
            return
        }

        super.onMessageReceived(message)
    }
}
