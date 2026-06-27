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
 * variants. Touches only its own activity-aliases plus {@code .MainActivity};
 * Stealth Mode aliases are owned by {@link StealthMode} and are intentionally
 * untouched here so the two modules can coexist.
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

    // Other launcher-eligible aliases owned by sibling modules. We disable
    // these when switching app icons so exactly one launcher entry is enabled
    // at a time. Stealth Mode is guarded by the JS UI (picker disabled while
    // stealth is active), so this is only reached when stealth should be off.
    private static final String[] FOREIGN_LAUNCHER_ALIASES = new String[] {
        ".StealthCalculatorActivity",
        ".StealthVPNActivity",
        ".StealthQRScannerActivity",
        ".StealthNotepadActivity"
    };

    public AppIcon(ReactApplicationContext reactContext) {
        super(reactContext);
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

            ComponentName mainActivity =
                new ComponentName(packageName, packageName + MAIN_ACTIVITY);
            pm.setComponentEnabledSetting(
                mainActivity,
                isDefault
                    ? PackageManager.COMPONENT_ENABLED_STATE_ENABLED
                    : PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                PackageManager.DONT_KILL_APP
            );

            for (Map.Entry<String, String> entry : APP_ICON_ALIASES.entrySet()) {
                ComponentName aliasComponent =
                    new ComponentName(packageName, packageName + entry.getValue());
                int newState = entry.getValue().equals(targetAlias)
                    ? PackageManager.COMPONENT_ENABLED_STATE_ENABLED
                    : PackageManager.COMPONENT_ENABLED_STATE_DISABLED;
                pm.setComponentEnabledSetting(
                    aliasComponent,
                    newState,
                    PackageManager.DONT_KILL_APP
                );
            }

            // Ensure foreign launcher aliases (Stealth Mode disguises) are
            // disabled so the launcher never shows duplicate Zeus entries.
            for (String alias : FOREIGN_LAUNCHER_ALIASES) {
                ComponentName foreign =
                    new ComponentName(packageName, packageName + alias);
                try {
                    pm.setComponentEnabledSetting(
                        foreign,
                        PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                        PackageManager.DONT_KILL_APP
                    );
                } catch (IllegalArgumentException ignored) {
                    // Alias not present in this build — fine, skip it.
                }
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
