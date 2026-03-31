package app.zeusln.zeus

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.database.sqlite.SQLiteDatabase
import android.os.Build
import android.os.IBinder
import android.util.Log

import com.reactnativecommunity.asyncstorage.AsyncLocalStorageUtil
import com.reactnativecommunity.asyncstorage.ReactDatabaseSupplier

class LdkNodeService : Service() {

    companion object {
        private const val TAG = "LdkNodeService"
        private const val ONGOING_NOTIFICATION_ID = 1003
        private const val ACTION_STOP = "app.zeusln.zeus.android.intent.action.STOP_LDK_NODE_SERVICE"
        private const val ACTION_UPDATE_NOTIFICATION = "app.zeusln.zeus.android.intent.action.UPDATE_LDK_NODE_NOTIFICATION"

        @JvmStatic
        fun startService(context: Context) {
            val intent = Intent(context, LdkNodeService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        @JvmStatic
        fun stopService(context: Context) {
            val intent = Intent(context, LdkNodeService::class.java)
            intent.action = ACTION_STOP
            context.startService(intent)
        }
    }

    private var notificationManager: NotificationManager? = null

    private val binder = object : android.os.Binder() {}

    override fun onCreate() {
        super.onCreate()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action != null) {
            when (intent.action) {
                ACTION_STOP -> {
                    stopForeground(STOP_FOREGROUND_REMOVE)
                    stopSelf()
                    return START_NOT_STICKY
                }
                ACTION_UPDATE_NOTIFICATION -> {
                    if (notificationManager == null) {
                        notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                    }
                    notificationManager?.notify(ONGOING_NOTIFICATION_ID, buildNotification())
                    return START_NOT_STICKY
                }
            }
        }

        val persistentEnabled = getPersistentLdkNodeServicesEnabled(this)
        if (persistentEnabled) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val chan = NotificationChannel(
                    BuildConfig.APPLICATION_ID + ".ldknode",
                    "LDK Node",
                    NotificationManager.IMPORTANCE_NONE
                )
                chan.lockscreenVisibility = Notification.VISIBILITY_PRIVATE
                notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                notificationManager?.createNotificationChannel(chan)
            }

            val notification = buildNotification()

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(ONGOING_NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
            } else {
                startForeground(ONGOING_NOTIFICATION_ID, notification)
            }
            return START_STICKY
        }

        return START_NOT_STICKY
    }

    override fun onBind(intent: Intent?): IBinder {
        return binder
    }

    override fun onUnbind(intent: Intent?): Boolean {
        if (!getPersistentLdkNodeServicesEnabled(this)) {
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
        }
        return false
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        if (!getPersistentLdkNodeServicesEnabled(this)) {
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
        }
        super.onTaskRemoved(rootIntent)
    }

    override fun onDestroy() {
        notificationManager?.cancelAll()
        super.onDestroy()
    }

    private fun buildNotification(): Notification {
        val notificationIntent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(this, 0, notificationIntent, PendingIntent.FLAG_IMMUTABLE)

        val stopIntent = Intent(this, LdkNodeService::class.java)
        stopIntent.action = ACTION_STOP
        val stopPendingIntent = PendingIntent.getService(this, 0, stopIntent, PendingIntent.FLAG_IMMUTABLE)

        val channelId = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            BuildConfig.APPLICATION_ID + ".ldknode"
        } else {
            ""
        }

        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, channelId)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }

        builder
            .setContentText(getLocalizedString("androidNotification.ldkNodeRunningBackground"))
            .setSmallIcon(R.drawable.ic_stat_ic_notification_lnd)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .addAction(Notification.Action.Builder(null, getLocalizedString("androidNotification.shutdown"), stopPendingIntent).build())

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            builder.setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE)
        }

        return builder.build()
    }

    private fun getPersistentLdkNodeServicesEnabled(context: Context): Boolean {
        try {
            val dbSupplier = ReactDatabaseSupplier.getInstance(context)
            val db: SQLiteDatabase = dbSupplier.get()
            val value = AsyncLocalStorageUtil.getItemImpl(db, "persistentLdkNodeServicesEnabled")
            if (value != null) {
                return value == "true"
            }
        } catch (e: Exception) {
            Log.w(TAG, "getPersistentLdkNodeServicesEnabled: Exception reading AsyncStorage: ${e.message}")
        }
        return false
    }

    private fun getLocalizedString(key: String): String {
        val translation = LndMobile.translationCache[key]
        return translation ?: "MISSING STRING"
    }
}
