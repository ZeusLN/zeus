package app.zeusln.zeus

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder

// Foreground service that keeps the app process, and with it the in-process
// Tor daemon, alive while ZEUS is in the background. It holds no Tor state of
// its own: TorStore pushes the status text from JS, and the notification's
// New circuit action is handed back to JS through TorServiceModule.
class TorService : Service() {

    companion object {
        private const val ONGOING_NOTIFICATION_ID = 1004
        private const val CHANNEL_SUFFIX = ".tor"
        private const val ACTION_UPDATE = "app.zeusln.zeus.android.intent.action.UPDATE_TOR_NOTIFICATION"
        private const val ACTION_NEW_IDENTITY = "app.zeusln.zeus.android.intent.action.TOR_NEW_IDENTITY"

        @Volatile private var title: String = "Tor"
        @Volatile private var text: String = ""
        @Volatile private var newIdentityLabel: String = ""
        @Volatile private var running = false

        @JvmStatic
        fun startService(context: Context, title: String, text: String, newIdentityLabel: String) {
            setContent(title, text, newIdentityLabel)
            context.startForegroundService(Intent(context, TorService::class.java))
        }

        @JvmStatic
        fun updateNotification(context: Context, title: String, text: String, newIdentityLabel: String) {
            setContent(title, text, newIdentityLabel)
            if (!running) return
            val intent = Intent(context, TorService::class.java)
            intent.action = ACTION_UPDATE
            context.startService(intent)
        }

        @JvmStatic
        fun stopService(context: Context) {
            context.stopService(Intent(context, TorService::class.java))
        }

        private fun setContent(title: String, text: String, newIdentityLabel: String) {
            this.title = title
            this.text = text
            this.newIdentityLabel = newIdentityLabel
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_NEW_IDENTITY -> {
                TorServiceModule.emitNewIdentity()
                return START_NOT_STICKY
            }
            ACTION_UPDATE -> {
                val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                manager.notify(ONGOING_NOTIFICATION_ID, buildNotification())
                return START_NOT_STICKY
            }
        }

        // A null intent means the system restarted the service after killing
        // the process. The Tor daemon died with the process, so there is no
        // status to show until the app starts it again.
        if (intent == null) {
            stopSelf()
            return START_NOT_STICKY
        }

        val channel = NotificationChannel(
            BuildConfig.APPLICATION_ID + CHANNEL_SUFFIX,
            "Tor",
            NotificationManager.IMPORTANCE_LOW
        )
        channel.lockscreenVisibility = Notification.VISIBILITY_PRIVATE
        channel.setShowBadge(false)
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.createNotificationChannel(channel)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(ONGOING_NOTIFICATION_ID, buildNotification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        } else {
            startForeground(ONGOING_NOTIFICATION_ID, buildNotification())
        }
        running = true
        return START_NOT_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        running = false
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.cancel(ONGOING_NOTIFICATION_ID)
        super.onDestroy()
    }

    private fun buildNotification(): Notification {
        val contentIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE
        )

        val newIdentityIntent = Intent(this, TorService::class.java)
        newIdentityIntent.action = ACTION_NEW_IDENTITY
        val newIdentityPendingIntent = PendingIntent.getService(
            this,
            0,
            newIdentityIntent,
            PendingIntent.FLAG_IMMUTABLE
        )

        val builder = Notification.Builder(this, BuildConfig.APPLICATION_ID + CHANNEL_SUFFIX)
            .setContentTitle(title)
            .setContentText(text)
            .setSmallIcon(R.drawable.ic_stat_ic_notification_zeus)
            .setContentIntent(contentIntent)
            .setOngoing(true)
            .setOnlyAlertOnce(true)

        // TorStore sends an empty label while Tor is not running
        if (newIdentityLabel.isNotEmpty()) {
            builder.addAction(Notification.Action.Builder(null, newIdentityLabel, newIdentityPendingIntent).build())
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            builder.setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE)
        }

        return builder.build()
    }
}
