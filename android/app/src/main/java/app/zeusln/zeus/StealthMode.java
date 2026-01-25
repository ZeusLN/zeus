package app.zeusln.zeus;

import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Handler;
import android.os.Looper;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;

public class StealthMode extends ReactContextBaseJavaModule {
    private static final String TAG = "StealthMode";
    private static final String PREFS_NAME = "stealth_mode_prefs";
    private static final String PREF_STEALTH_APP = "stealth_app";
    private static final String PREF_STEALTH_ENABLED = "stealth_enabled";

    // Activity and alias names - must match AndroidManifest.xml
    private static final String MAIN_ACTIVITY = ".MainActivity";
    private static final String ALIAS_CALCULATOR = ".StealthCalculatorActivity";
    private static final String ALIAS_VPN = ".StealthVPNActivity";
    private static final String ALIAS_QRSCANNER = ".StealthQRScannerActivity";
    private static final String ALIAS_NOTEPAD = ".StealthNotepadActivity";

    public StealthMode(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return "StealthMode";
    }

    private SharedPreferences getPreferences() {
        return getReactApplicationContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    private String getAliasForApp(String stealthApp) {
        switch (stealthApp) {
            case "calculator":
                return ALIAS_CALCULATOR;
            case "vpn":
                return ALIAS_VPN;
            case "qrscanner":
                return ALIAS_QRSCANNER;
            case "notepad":
                return ALIAS_NOTEPAD;
            default:
                return null; // null means use MainActivity directly
        }
    }

    private String[] getStealthAliases() {
        return new String[]{
            ALIAS_CALCULATOR,
            ALIAS_VPN,
            ALIAS_QRSCANNER,
            ALIAS_NOTEPAD
        };
    }

    @ReactMethod
    public void enableStealthMode(String stealthApp, Promise promise) {
        try {
            Context context = getReactApplicationContext();
            PackageManager pm = context.getPackageManager();
            String packageName = context.getPackageName();
            String targetAlias = getAliasForApp(stealthApp);
            boolean isStealthMode = targetAlias != null;

            // Handle MainActivity (the real activity with LAUNCHER intent)
            ComponentName mainActivityComponent = new ComponentName(packageName, packageName + MAIN_ACTIVITY);
            pm.setComponentEnabledSetting(
                mainActivityComponent,
                isStealthMode
                    ? PackageManager.COMPONENT_ENABLED_STATE_DISABLED
                    : PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
                PackageManager.DONT_KILL_APP
            );

            // Handle all stealth aliases
            for (String alias : getStealthAliases()) {
                ComponentName componentName = new ComponentName(packageName, packageName + alias);
                int newState = alias.equals(targetAlias)
                    ? PackageManager.COMPONENT_ENABLED_STATE_ENABLED
                    : PackageManager.COMPONENT_ENABLED_STATE_DISABLED;

                pm.setComponentEnabledSetting(
                    componentName,
                    newState,
                    PackageManager.DONT_KILL_APP
                );
            }

            // Save preference
            getPreferences().edit()
                .putString(PREF_STEALTH_APP, stealthApp)
                .putBoolean(PREF_STEALTH_ENABLED, isStealthMode)
                .apply();

            promise.resolve(true);
        } catch (Exception e) {
            android.util.Log.e(TAG, "Error enabling stealth mode", e);
            promise.reject("STEALTH_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void disableStealthMode(Promise promise) {
        enableStealthMode("zeus", promise);
    }

    @ReactMethod
    public void getStealthStatus(Promise promise) {
        try {
            SharedPreferences prefs = getPreferences();
            WritableMap result = Arguments.createMap();
            result.putBoolean("enabled", prefs.getBoolean(PREF_STEALTH_ENABLED, false));
            result.putString("app", prefs.getString(PREF_STEALTH_APP, "zeus"));
            promise.resolve(result);
        } catch (Exception e) {
            promise.reject("STEALTH_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void isStealthModeActive(Promise promise) {
        try {
            Context context = getReactApplicationContext();
            PackageManager pm = context.getPackageManager();
            String packageName = context.getPackageName();

            ComponentName mainComponent = new ComponentName(packageName, packageName + MAIN_ACTIVITY);
            int state = pm.getComponentEnabledSetting(mainComponent);

            // If MainActivity is disabled, stealth mode is active
            boolean isActive = (state == PackageManager.COMPONENT_ENABLED_STATE_DISABLED);
            promise.resolve(isActive);
        } catch (Exception e) {
            promise.reject("STEALTH_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void fixStealthModeIfNeeded(Promise promise) {
        try {
            Context context = getReactApplicationContext();
            PackageManager pm = context.getPackageManager();
            String packageName = context.getPackageName();

            // Check if MainActivity is enabled
            ComponentName mainComponent = new ComponentName(packageName, packageName + MAIN_ACTIVITY);
            int mainState = pm.getComponentEnabledSetting(mainComponent);
            boolean mainEnabled = (mainState == PackageManager.COMPONENT_ENABLED_STATE_ENABLED ||
                                   mainState == PackageManager.COMPONENT_ENABLED_STATE_DEFAULT);

            // Check if any stealth alias is enabled
            boolean anyAliasEnabled = false;
            for (String alias : getStealthAliases()) {
                ComponentName componentName = new ComponentName(packageName, packageName + alias);
                int state = pm.getComponentEnabledSetting(componentName);
                if (state == PackageManager.COMPONENT_ENABLED_STATE_ENABLED) {
                    anyAliasEnabled = true;
                    break;
                }
            }

            // If nothing is enabled, enable MainActivity (safety check)
            if (!mainEnabled && !anyAliasEnabled) {
                pm.setComponentEnabledSetting(
                    mainComponent,
                    PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
                    PackageManager.DONT_KILL_APP
                );

                // Also disable any stealth aliases to be safe
                for (String alias : getStealthAliases()) {
                    ComponentName componentName = new ComponentName(packageName, packageName + alias);
                    pm.setComponentEnabledSetting(
                        componentName,
                        PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                        PackageManager.DONT_KILL_APP
                    );
                }

                getPreferences().edit()
                    .putString(PREF_STEALTH_APP, "zeus")
                    .putBoolean(PREF_STEALTH_ENABLED, false)
                    .apply();
            }

            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("STEALTH_ERROR", e.getMessage());
        }
    }
}
