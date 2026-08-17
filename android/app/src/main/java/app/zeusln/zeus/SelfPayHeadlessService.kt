package app.zeusln.zeus

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build

import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

/**
 * Foreground HeadlessJsTaskService that answers a ZEUS Pay 'self' invoice
 * request from a killed state: boots the JS runtime (reusing the app's
 * React context when one is alive), which starts the LDK node, generates
 * the invoice, POSTs it back to the ZEUS Pay server, and reports settlement.
 *
 * Uses headless JS instead of a pure-native path on purpose: the LDK
 * mnemonic lives inside the encrypted settings blob, and only the JS layer
 * knows how to decrypt and parse it. Duplicating that in Kotlin would fork
 * funds-critical code.
 */
class SelfPayHeadlessService : HeadlessJsTaskService() {

    companion object {
        private const val ONGOING_NOTIFICATION_ID = 1004
        // Node start (~5-10s) + invoice + settlement-report window
        private const val TASK_TIMEOUT_MS = 75_000L
    }

    override fun onCreate() {
        super.onCreate()
        startAsForeground()
        // The device may be dozing when the FCM message lands
        acquireWakeLockNow(this)
    }

    private fun startAsForeground() {
        val channelId = BuildConfig.APPLICATION_ID + ".selfpay"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val chan = NotificationChannel(
                channelId,
                "ZEUS Pay",
                NotificationManager.IMPORTANCE_LOW
            )
            chan.lockscreenVisibility = Notification.VISIBILITY_PRIVATE
            val notificationManager =
                getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(chan)
        }

        val notificationIntent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, notificationIntent, PendingIntent.FLAG_IMMUTABLE
        )

        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, channelId)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }

        builder
            .setContentText(getLocalizedString("androidNotification.receivingPayment"))
            .setSmallIcon(R.drawable.ic_stat_ic_notification_zeus)
            .setContentIntent(pendingIntent)
            .setOngoing(true)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            builder.setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE)
        }

        val notification = builder.build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                ONGOING_NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
            )
        } else {
            startForeground(ONGOING_NOTIFICATION_ID, notification)
        }
    }

    override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig? {
        val extras = intent?.extras ?: return null
        return HeadlessJsTaskConfig(
            "ZeusSelfPayRequest",
            Arguments.fromBundle(extras),
            TASK_TIMEOUT_MS,
            // allowed while the app is foregrounded: the JS task dedupes by
            // request_id against the socket/notification handlers, so it
            // exits quickly when the app already answered
            true
        )
    }

    override fun onDestroy() {
        stopForeground(STOP_FOREGROUND_REMOVE)
        super.onDestroy()
    }

    private fun getLocalizedString(key: String): String {
        val translation = LndMobile.translationCache[key]
        return translation ?: "Receiving a payment…"
    }
}
