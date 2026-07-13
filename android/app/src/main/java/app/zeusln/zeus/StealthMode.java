package app.zeusln.zeus;

import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;

import java.util.Map;
import java.util.HashMap;
import java.util.Collections;

public class StealthMode extends ReactContextBaseJavaModule {
    private static final String TAG = "StealthMode";
    private static final String PREFS_NAME = "stealth_mode_prefs";
    private static final String PREF_STEALTH_APP = "stealth_app";
    private static final String PREF_STEALTH_ENABLED = "stealth_enabled";

    // Activity name - must match AndroidManifest.xml
    private static final String MAIN_ACTIVITY = ".MainActivity";

    // Stealth app aliases - centralized configuration
    private static final Map<String, String> STEALTH_APPS;
    static {
        Map<String, String> map = new HashMap<>();
        map.put("calculator", ".StealthCalculatorActivity");
        map.put("vpn", ".StealthVPNActivity");
        map.put("qrscanner", ".StealthQRScannerActivity");
        map.put("notepad", ".StealthNotepadActivity");
        STEALTH_APPS = Collections.unmodifiableMap(map);
    }

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
        return STEALTH_APPS.get(stealthApp);
    }

    // Package-private so AppIcon can keep the two modules' launcher aliases
    // mutually exclusive without duplicating this list.
    static String[] stealthAliasSuffixes() {
        return STEALTH_APPS.values().toArray(new String[0]);
    }

    private String[] getStealthAliases() {
        return stealthAliasSuffixes();
    }

    /**
     * Restore the Zeus launcher entry the user chose: the stored custom app
     * icon alias if one is set, otherwise {@code .MainActivity} (default
     * icon). Disables every other Zeus-branded launcher entry so exactly one
     * is left enabled.
     */
    private void restoreZeusLauncher(PackageManager pm, String packageName) {
        String iconAlias =
            AppIcon.storedAliasSuffix(getReactApplicationContext());
        String targetSuffix = iconAlias == null ? MAIN_ACTIVITY : iconAlias;

        // Enable the chosen entry first so the launcher never has zero
        // enabled Zeus entries, then disable the rest.
        pm.setComponentEnabledSetting(
            new ComponentName(packageName, packageName + targetSuffix),
            PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
            PackageManager.DONT_KILL_APP
        );

        if (iconAlias != null) {
            pm.setComponentEnabledSetting(
                new ComponentName(packageName, packageName + MAIN_ACTIVITY),
                PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                PackageManager.DONT_KILL_APP
            );
        }

        for (String alias : AppIcon.appIconAliasSuffixes()) {
            if (alias.equals(targetSuffix)) continue;
            pm.setComponentEnabledSetting(
                new ComponentName(packageName, packageName + alias),
                PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                PackageManager.DONT_KILL_APP
            );
        }
    }

    @ReactMethod
    public void enableStealthMode(String stealthApp, Promise promise) {
        try {
            Context context = getReactApplicationContext();
            PackageManager pm = context.getPackageManager();
            String packageName = context.getPackageName();
            String targetAlias = getAliasForApp(stealthApp);
            boolean isStealthMode = targetAlias != null;

            if (isStealthMode) {
                // Enable the disguise first so the launcher never has zero
                // enabled entries, then hide every Zeus-branded entry —
                // MainActivity and any custom app icon alias — so only the
                // disguise remains.
                pm.setComponentEnabledSetting(
                    new ComponentName(packageName, packageName + targetAlias),
                    PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
                    PackageManager.DONT_KILL_APP
                );
                pm.setComponentEnabledSetting(
                    new ComponentName(packageName, packageName + MAIN_ACTIVITY),
                    PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                    PackageManager.DONT_KILL_APP
                );
                for (String alias : AppIcon.appIconAliasSuffixes()) {
                    pm.setComponentEnabledSetting(
                        new ComponentName(packageName, packageName + alias),
                        PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                        PackageManager.DONT_KILL_APP
                    );
                }
            } else {
                // Restore the user's chosen Zeus icon (default or custom
                // app icon variant)
                restoreZeusLauncher(pm, packageName);
            }

            // Disable all non-target stealth aliases
            for (String alias : getStealthAliases()) {
                if (alias.equals(targetAlias)) continue;
                pm.setComponentEnabledSetting(
                    new ComponentName(packageName, packageName + alias),
                    PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
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

            // Stealth mode is active iff a stealth disguise alias is enabled.
            // MainActivity being disabled is not a reliable signal — custom
            // app icon variants (AppIcon module) also disable it.
            boolean isActive = false;
            for (String alias : getStealthAliases()) {
                ComponentName componentName = new ComponentName(packageName, packageName + alias);
                int state = pm.getComponentEnabledSetting(componentName);
                if (state == PackageManager.COMPONENT_ENABLED_STATE_ENABLED) {
                    isActive = true;
                    break;
                }
            }
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

            // Check if any stealth alias is enabled
            boolean anyStealthAliasEnabled = false;
            for (String alias : getStealthAliases()) {
                ComponentName componentName = new ComponentName(packageName, packageName + alias);
                int state = pm.getComponentEnabledSetting(componentName);
                if (state == PackageManager.COMPONENT_ENABLED_STATE_ENABLED) {
                    anyStealthAliasEnabled = true;
                    break;
                }
            }

            // Not in stealth mode: make sure exactly one Zeus launcher entry
            // is enabled — MainActivity or the stored custom app icon alias.
            // Heals states where no launcher entry (or a stale combination of
            // entries) is enabled. No-op when the state is already correct.
            if (!anyStealthAliasEnabled) {
                restoreZeusLauncher(pm, packageName);

                if (getPreferences().getBoolean(PREF_STEALTH_ENABLED, false)) {
                    getPreferences().edit()
                        .putString(PREF_STEALTH_APP, "zeus")
                        .putBoolean(PREF_STEALTH_ENABLED, false)
                        .apply();
                }
            }

            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("STEALTH_ERROR", e.getMessage());
        }
    }
}
