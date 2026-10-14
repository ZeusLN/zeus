package app.zeusln.zeus;

import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;

import java.util.Map;
import java.util.HashMap;
import java.util.Collections;

/**
 * Native module that switches the Zeus app launcher icon between branded
 * variants. Exactly one launcher entry may be enabled at a time, so switching
 * icons also disables the Stealth Mode disguise aliases owned by
 * {@link StealthMode} — and StealthMode symmetrically disables (on enable) or
 * restores (on disable) the aliases owned here.
 */
public class AppIcon extends ReactContextBaseJavaModule {
    private static final String TAG = "AppIcon";
    private static final String PREFS_NAME = "app_icon_prefs";
    private static final String PREF_CURRENT_VARIANT = "current_variant";

    private static final String MAIN_ACTIVITY = ".MainActivity";
    private static final String DEFAULT_VARIANT = "default";

    private static final Map<String, String> APP_ICON_ALIASES;
    static {
        Map<String, String> map = new HashMap<>();
        map.put("AppIconGradientActivity", ".AppIconGradientActivity");
        map.put("AppIconYellowActivity", ".AppIconYellowActivity");
        map.put("AppIconGradientInverseActivity", ".AppIconGradientInverseActivity");
        map.put("AppIconRedActivity", ".AppIconRedActivity");
        map.put("AppIconGradientRedActivity", ".AppIconGradientRedActivity");
        map.put("AppIconBlackAndWhiteActivity", ".AppIconBlackAndWhiteActivity");
        APP_ICON_ALIASES = Collections.unmodifiableMap(map);
    }

    public AppIcon(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    // Package-private accessors so StealthMode can restore the user's chosen
    // icon variant and keep the two modules' launcher aliases mutually
    // exclusive without duplicating this list.
    static String[] appIconAliasSuffixes() {
        return APP_ICON_ALIASES.values().toArray(new String[0]);
    }

    /**
     * Alias suffix for the stored icon variant, or {@code null} when the
     * default icon (plain {@code .MainActivity}) is selected.
     */
    static String storedAliasSuffix(Context context) {
        String variant = context
            .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString(PREF_CURRENT_VARIANT, DEFAULT_VARIANT);
        return APP_ICON_ALIASES.get(variant);
    }

    @Override
    public String getName() {
        return "AppIcon";
    }

    private SharedPreferences getPreferences() {
        return getReactApplicationContext()
            .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    @ReactMethod
    public void setVariant(String variant, Promise promise) {
        try {
            Context context = getReactApplicationContext();
            PackageManager pm = context.getPackageManager();
            String packageName = context.getPackageName();

            String targetAlias = APP_ICON_ALIASES.get(variant);
            boolean isDefault = DEFAULT_VARIANT.equals(variant) || targetAlias == null;
            String targetSuffix = isDefault ? MAIN_ACTIVITY : targetAlias;

            // Enable the chosen entry first so the launcher never has zero
            // enabled Zeus entries, then disable the rest.
            pm.setComponentEnabledSetting(
                new ComponentName(packageName, packageName + targetSuffix),
                PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
                PackageManager.DONT_KILL_APP
            );

            if (!isDefault) {
                pm.setComponentEnabledSetting(
                    new ComponentName(packageName, packageName + MAIN_ACTIVITY),
                    PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                    PackageManager.DONT_KILL_APP
                );
            }

            for (Map.Entry<String, String> entry : APP_ICON_ALIASES.entrySet()) {
                if (entry.getValue().equals(targetSuffix)) continue;
                pm.setComponentEnabledSetting(
                    new ComponentName(packageName, packageName + entry.getValue()),
                    PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                    PackageManager.DONT_KILL_APP
                );
            }

            // Ensure Stealth Mode disguise aliases are disabled so the
            // launcher never shows duplicate Zeus entries. The JS UI blocks
            // the picker while stealth is active, so this is only reached
            // when stealth should be off.
            for (String alias : StealthMode.stealthAliasSuffixes()) {
                ComponentName stealthAlias =
                    new ComponentName(packageName, packageName + alias);
                pm.setComponentEnabledSetting(
                    stealthAlias,
                    PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                    PackageManager.DONT_KILL_APP
                );
            }

            getPreferences().edit()
                .putString(
                    PREF_CURRENT_VARIANT,
                    isDefault ? DEFAULT_VARIANT : variant
                )
                .apply();

            promise.resolve(true);
        } catch (Exception e) {
            android.util.Log.e(TAG, "Error setting app icon variant", e);
            promise.reject("APP_ICON_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void getVariant(Promise promise) {
        try {
            String stored = getPreferences()
                .getString(PREF_CURRENT_VARIANT, DEFAULT_VARIANT);
            promise.resolve(stored);
        } catch (Exception e) {
            promise.reject("APP_ICON_ERROR", e.getMessage());
        }
    }
}
