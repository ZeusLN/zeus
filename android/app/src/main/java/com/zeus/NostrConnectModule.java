package app.zeusln.zeus;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.os.IBinder;
import android.util.Log;
import android.database.sqlite.SQLiteDatabase;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.ReadableMapKeySetIterator;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;

import com.reactnativecommunity.asyncstorage.AsyncLocalStorageUtil;
import com.reactnativecommunity.asyncstorage.ReactDatabaseSupplier;

import java.util.HashMap;
import java.util.Map;
import java.util.Random;

public class NostrConnectModule extends ReactContextBaseJavaModule {
    private static final String TAG = "NostrConnectModule";
    private static final String MODULE_NAME = "NostrConnectModule";
    
    private boolean nostrConnectServiceBound = false;
    private NostrConnectServiceConnection nostrConnectServiceConnection;
    private Map<Integer, Promise> requests = new HashMap<>();

    public NostrConnectModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return MODULE_NAME;
    }
    
    private boolean getPersistentNWCServicesEnabled() {
        try {
            ReactDatabaseSupplier dbSupplier = ReactDatabaseSupplier.getInstance(getReactApplicationContext());
            SQLiteDatabase db = dbSupplier.get();
            String persistentNWCServicesEnabled = AsyncLocalStorageUtil.getItemImpl(db, "persistentNWCServicesEnabled");
            if (persistentNWCServicesEnabled != null) {
                return persistentNWCServicesEnabled.equals("true");
            }
        } catch (Exception e) {
            Log.w(TAG, "Could not find persistentNWCServicesEnabled in asyncStorage: " + e.getMessage());
        }
        return false;
    }
    
    @ReactMethod
    public void initialize(Promise promise) {
        if (!nostrConnectServiceBound) {
            int req = new Random().nextInt();
            requests.put(req, promise);
            
            nostrConnectServiceConnection = new NostrConnectServiceConnection(req);
            Intent intent = new Intent(getReactApplicationContext(), NostrConnectService.class);
            
            if (getPersistentNWCServicesEnabled()) {
                getReactApplicationContext().startForegroundService(intent);
            }
            // Always bind to the service for connection management
            getReactApplicationContext().bindService(
                intent,
                nostrConnectServiceConnection,
                Context.BIND_AUTO_CREATE
            );
            
            nostrConnectServiceBound = true;
            
        } else {
            promise.resolve(0);
        }
    }
    
    @ReactMethod
    public void unbindNostrConnectService(Promise promise) {
        if (nostrConnectServiceBound) {
            getReactApplicationContext().unbindService(nostrConnectServiceConnection);
            nostrConnectServiceBound = false;
        }
        promise.resolve(true);
    }

    @ReactMethod
    public void startNostrConnectService(Promise promise) {
        try {
            NostrConnectService.startService(getReactApplicationContext());
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("ERROR", "Failed to start NostrConnectService: " + e.getMessage());
        }
    }

    @ReactMethod
    public void stopNostrConnectService(Promise promise) {
        try {
            NostrConnectService.stopService(getReactApplicationContext());
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("ERROR", "Failed to stop NostrConnectService: " + e.getMessage());
        }
    }

    @ReactMethod
    public void isNostrConnectServiceRunning(Promise promise) {
        try {
            boolean isRunning = NostrConnectService.isServiceRunning(getReactApplicationContext());
            promise.resolve(isRunning);
        } catch (Exception e) {
            promise.reject("ERROR", "Failed to check NostrConnectService status: " + e.getMessage());
        }
    }

    @ReactMethod
    public void updateTranslationCache(String locale, ReadableMap translations) {
        LndMobile.translationCache.clear();
        ReadableMapKeySetIterator iterator = translations.keySetIterator();
        while (iterator.hasNextKey()) {
            String key = iterator.nextKey();
            LndMobile.translationCache.put(key, translations.getString(key));
        }

        // Update the notification in NostrConnectService if it's running
        Intent intent = new Intent(getReactApplicationContext(), NostrConnectService.class);
        intent.setAction("app.zeusln.zeus.android.intent.action.UPDATE_NOTIFICATION");
        getReactApplicationContext().startService(intent);
    }
    
    class NostrConnectServiceConnection implements ServiceConnection {
        private final int request;
        
        NostrConnectServiceConnection(int request) {
            this.request = request;
        }
        
        public void onServiceConnected(ComponentName className, IBinder service) {
            Promise promise = requests.get(request);
            if (promise != null) {
                promise.resolve(0);
                requests.remove(request);
            }
        }
        
        public void onServiceDisconnected(ComponentName className) {
        }
    }
}
