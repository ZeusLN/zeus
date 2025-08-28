package app.zeusln.zeus;

import android.content.Context;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;

public class NostrConnectModule extends ReactContextBaseJavaModule {
    private static final String MODULE_NAME = "NostrConnectModule";
    private final ReactApplicationContext reactContext;

    public NostrConnectModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    public String getName() {
        return MODULE_NAME;
    }

    @ReactMethod
    public void startNostrConnectService(Promise promise) {
        try {
            NostrConnectService.startService(reactContext);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("ERROR", "Failed to start NostrConnectService: " + e.getMessage());
        }
    }

    @ReactMethod
    public void stopNostrConnectService(Promise promise) {
        try {
            NostrConnectService.stopService(reactContext);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("ERROR", "Failed to stop NostrConnectService: " + e.getMessage());
        }
    }

    @ReactMethod
    public void isNostrConnectServiceRunning(Promise promise) {
        try {
            boolean isRunning = NostrConnectService.isServiceRunning(reactContext);
            promise.resolve(isRunning);
        } catch (Exception e) {
            promise.reject("ERROR", "Failed to check NostrConnectService status: " + e.getMessage());
        }
    }
}
