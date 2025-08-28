package app.zeusln.zeus;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.app.ActivityManager;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

import androidx.core.app.NotificationCompat;

public class NostrConnectService extends Service {
    private static final String TAG = "NostrConnectService";
    private static final int NOTIFICATION_ID = 1002;
    private static final String CHANNEL_ID = "nostr_connect_service";
    
    private static boolean isServiceRunning = false;

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "NostrConnectService created");
        createNotificationChannel();
        isServiceRunning = true;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.d(TAG, "NostrConnectService started");
        
        if (intent != null && intent.getAction() != null) {
            if (intent.getAction().equals("app.zeusln.zeus.android.intent.action.STOP_NOSTR_SERVICE")) {
                Log.i(TAG, "Received stop NostrConnectService Intent");
                stopForeground(true);
                stopSelf();
                return START_NOT_STICKY;
            }
        }

        // Start as foreground service
        startForeground(NOTIFICATION_ID, buildNotification());
        
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        Log.d(TAG, "NostrConnectService destroyed");
        isServiceRunning = false;
        super.onDestroy();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Nostr Wallet Connect Service",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Maintains Nostr Wallet Connect connections in background");
            channel.setShowBadge(false);
            channel.setSound(null, null);
            channel.enableLights(false);
            channel.enableVibration(false);

            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }
    }

    private Notification buildNotification() {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, 
            0, 
            notificationIntent, 
            PendingIntent.FLAG_IMMUTABLE
        );

        Intent stopIntent = new Intent(this, NostrConnectService.class);
        stopIntent.setAction("app.zeusln.zeus.android.intent.action.STOP_NOSTR_SERVICE");
        PendingIntent stopPendingIntent = PendingIntent.getService(
            this, 
            0, 
            stopIntent, 
            PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Nostr Wallet Connect")
            .setContentText("Maintaining connections in background")
            .setSmallIcon(R.drawable.ic_stat_ic_notification_lnd)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .addAction(0, "Stop Service", stopPendingIntent);

        return builder.build();
    }

    public static void startService(Context context) {
        Intent intent = new Intent(context, NostrConnectService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
        }
    }

    public static void stopService(Context context) {
        Intent intent = new Intent(context, NostrConnectService.class);
        intent.setAction("app.zeusln.zeus.android.intent.action.STOP_NOSTR_SERVICE");
        context.startService(intent);
    }

    public static boolean isServiceRunning(Context context) {
        if (!isServiceRunning) {
            return false;
        }
        
        ActivityManager activityManager = (ActivityManager) context.getSystemService(Context.ACTIVITY_SERVICE);
        if (activityManager != null) {
            for (ActivityManager.RunningServiceInfo service : activityManager.getRunningServices(Integer.MAX_VALUE)) {
                if (NostrConnectService.class.getName().equals(service.service.getClassName())) {
                    return true;
                }
            }
        }
        isServiceRunning = false;
        return false;
    }
}
