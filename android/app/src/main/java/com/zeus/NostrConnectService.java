package app.zeusln.zeus;

import android.app.ActivityManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.database.sqlite.SQLiteDatabase;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;
import static android.app.Notification.FOREGROUND_SERVICE_IMMEDIATE;

import com.reactnativecommunity.asyncstorage.AsyncLocalStorageUtil;
import com.reactnativecommunity.asyncstorage.ReactDatabaseSupplier;

public class NostrConnectService extends Service {
    private static final String TAG = "NostrConnectService";
    private final int ONGOING_NOTIFICATION_ID = 1002;
    
    private static boolean isServiceRunning = false;
    private NotificationManager notificationManager;
    
    private final IBinder binder = new NostrConnectBinder();
    public class NostrConnectBinder extends android.os.Binder {
        NostrConnectService getService() {
            return NostrConnectService.this;
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        isServiceRunning = true;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startid) {
        if (intent != null && intent.getAction() != null) {
            if (intent.getAction().equals("app.zeusln.zeus.android.intent.action.STOP_NOSTR_SERVICE")) {
                stopForeground(true);
                stopSelf();
                return START_NOT_STICKY;
            } else if (intent.getAction().equals("app.zeusln.zeus.android.intent.action.UPDATE_NOTIFICATION")) {
                if (notificationManager == null) {
                    notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                }
                notificationManager.notify(ONGOING_NOTIFICATION_ID, buildNotification());
                return START_NOT_STICKY;
            }
        }
        
        boolean persistentServicesEnabled = getPersistentNWCServicesEnabled(this);
        
        // persistent services on, start service as foreground-svc
        if (persistentServicesEnabled) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationChannel chan = new NotificationChannel(BuildConfig.APPLICATION_ID, "Nostr Wallet Connect", NotificationManager.IMPORTANCE_NONE);
                chan.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);
                notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                assert notificationManager != null;
                notificationManager.createNotificationChannel(chan);
            }

            Notification notification = buildNotification();

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(ONGOING_NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
            } else {
                startForeground(ONGOING_NOTIFICATION_ID, notification);
            }
        }

        // else noop, instead of calling startService, start will be handled by binding
        return startid;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return binder;
    }

    @Override
    public boolean onUnbind(Intent intent) {
        // Stop the service when no clients are bound, but only if persistent services are disabled
        if (!getPersistentNWCServicesEnabled(this)) {
            stopForeground(true);
            stopSelf();
        }
        return false;
    }

    @Override
    public void onRebind(Intent intent) {
        super.onRebind(intent);
    }

    @Override
    public void onDestroy() {
        isServiceRunning = false;
        if (notificationManager != null) {
            notificationManager.cancelAll();
        }
        super.onDestroy();
    }



    private Notification buildNotification() {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, notificationIntent, PendingIntent.FLAG_IMMUTABLE);
        Intent stopIntent = new Intent(this, NostrConnectService.class);
        stopIntent.setAction("app.zeusln.zeus.android.intent.action.STOP_NOSTR_SERVICE");
        PendingIntent stopPendingIntent = PendingIntent.getService(this, 0, stopIntent, PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder notificationBuilder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            notificationBuilder = new Notification.Builder(this, BuildConfig.APPLICATION_ID);
        } else {
            notificationBuilder = new Notification.Builder(this);
        }
        notificationBuilder
            .setContentText(getLocalizedString("androidNotification.nwcRunningBackground"))
            .setSmallIcon(R.drawable.ic_stat_ic_notification_lnd)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .addAction(0, getLocalizedString("androidNotification.nwcShutdown"), stopPendingIntent);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            notificationBuilder.setForegroundServiceBehavior(FOREGROUND_SERVICE_IMMEDIATE);
        }
        return notificationBuilder.build();
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

    private boolean getPersistentNWCServicesEnabled(Context context) {
        try {
            ReactDatabaseSupplier dbSupplier = ReactDatabaseSupplier.getInstance(context);
            SQLiteDatabase db = dbSupplier.get();
            String persistentNWCServicesEnabled = AsyncLocalStorageUtil.getItemImpl(db, "persistentNWCServicesEnabled");
            Log.d(TAG, "getPersistentNWCServicesEnabled: AsyncStorage key 'persistentNWCServicesEnabled' = '" + persistentNWCServicesEnabled + "'");
            
            if (persistentNWCServicesEnabled != null) {
                boolean result = persistentNWCServicesEnabled.equals("true");
                Log.d(TAG, "getPersistentNWCServicesEnabled: Parsed result = " + result);
                return result;
            } else {
                Log.d(TAG, "getPersistentNWCServicesEnabled: Key not found in AsyncStorage, returning false");
            }
        } catch (Exception e) {
            Log.w(TAG, "getPersistentNWCServicesEnabled: Exception reading AsyncStorage: " + e.getMessage());
            e.printStackTrace();
        }
        Log.d(TAG, "getPersistentNWCServicesEnabled: Returning default false");
        return false;
    }

    private String getLocalizedString(String key) {
        String translation = LndMobile.translationCache.get(key);
        return translation != null ? translation : "MISSING STRING";
    }
}
