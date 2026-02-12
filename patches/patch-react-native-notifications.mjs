// Fix react-native-notifications for New Architecture (RN 0.82+)
// The library tries to use ReactInstanceManager which is unsupported in bridgeless mode
// See: https://github.com/wix/react-native-notifications/issues/1071

import fs from 'fs';

export function patchReactNativeNotifications() {
    console.log('Patching react-native-notifications');

    const fcmTokenPath =
        './node_modules/react-native-notifications/lib/android/app/src/main/java/com/wix/reactnativenotifications/fcm/FcmToken.java';

    if (!fs.existsSync(fcmTokenPath)) {
        console.log('  - Skipping: FcmToken.java not found');
        return;
    }

    const fcmTokenContent = `package com.wix.reactnativenotifications.fcm;

import android.content.Context;
import android.os.Bundle;
import android.util.Log;

import com.facebook.react.ReactApplication;
import com.facebook.react.ReactInstanceManager;
import com.facebook.react.bridge.ReactContext;
import com.google.firebase.messaging.FirebaseMessaging;
import com.wix.reactnativenotifications.BuildConfig;
import com.wix.reactnativenotifications.core.JsIOHelper;

import static com.wix.reactnativenotifications.Defs.LOGTAG;
import static com.wix.reactnativenotifications.Defs.TOKEN_RECEIVED_EVENT_NAME;

public class FcmToken implements IFcmToken {

    final protected Context mAppContext;
    final protected JsIOHelper mJsIOHelper;

    protected static String sToken;

    protected FcmToken(Context appContext) {
        if (!(appContext instanceof ReactApplication)) {
            throw new IllegalStateException("Application instance isn't a react-application");
        }
        mJsIOHelper = new JsIOHelper();
        mAppContext = appContext;
    }

    public static IFcmToken get(Context context) {
        Context appContext = context.getApplicationContext();
        if (appContext instanceof INotificationsFcmApplication) {
            return ((INotificationsFcmApplication) appContext).getFcmToken(context);
        }
        return new FcmToken(appContext);
    }

    @Override
    public void onNewTokenReady() {
        synchronized (mAppContext) {
            refreshToken();
        }
    }

    @Override
    public void onManualRefresh() {
        synchronized (mAppContext) {
            if (sToken == null) {
                if(BuildConfig.DEBUG) Log.i(LOGTAG, "Manual token refresh => asking for new token");
                refreshToken();
            } else {
                if(BuildConfig.DEBUG) Log.i(LOGTAG, "Manual token refresh => publishing existing token ("+sToken+")");
                sendTokenToJS();
            }
        }
    }

    @Override
    public void onAppReady() {
        synchronized (mAppContext) {
            if (sToken == null) {
                if(BuildConfig.DEBUG) Log.i(LOGTAG, "App initialized => asking for new token");
                refreshToken();
            } else {
                // Except for first run, this should be the case.
                if(BuildConfig.DEBUG) Log.i(LOGTAG, "App initialized => publishing existing token ("+sToken+")");
                sendTokenToJS();
            }
        }
    }

    protected void refreshToken() {
        FirebaseMessaging.getInstance().getToken()
            .addOnCompleteListener(task -> {
                if (!task.isSuccessful()) {
                    if (BuildConfig.DEBUG) Log.w(LOGTAG, "Fetching FCM registration token failed", task.getException());
                    return;
                }
                sToken = task.getResult();
                if (mAppContext instanceof IFcmTokenListenerApplication) {
                    ((IFcmTokenListenerApplication) mAppContext).onNewFCMToken(sToken);
                }
                if (BuildConfig.DEBUG) Log.i(LOGTAG, "FCM has a new token" + "=" + sToken);
                sendTokenToJS();
            });
    }

    protected void sendTokenToJS() {
        ReactContext reactContext = null;

        // Try New Architecture first (ReactHost) - available in RN 0.76+
        try {
            reactContext = ((ReactApplication) mAppContext).getReactHost().getCurrentReactContext();
        } catch (NoSuchMethodError | RuntimeException e) {
            // getReactHost() doesn't exist in older RN versions or throws in some cases
            // Fall back to Old Architecture (ReactNativeHost)
        }

        // Fallback to Old Architecture if New Architecture didn't work
        if (reactContext == null) {
            try {
                final ReactInstanceManager instanceManager = ((ReactApplication) mAppContext).getReactNativeHost().getReactInstanceManager();
                reactContext = instanceManager.getCurrentReactContext();
            } catch (RuntimeException e) {
                // getReactNativeHost() throws RuntimeException in New Architecture
                // This is expected, we'll just continue with null reactContext
            }
        }

        // Note: Cannot assume react-context exists cause this is an async dispatched service.
        if (reactContext != null && reactContext.hasActiveReactInstance()) {
            Bundle tokenMap = new Bundle();
            tokenMap.putString("deviceToken", sToken);
            mJsIOHelper.sendEventToJS(TOKEN_RECEIVED_EVENT_NAME, tokenMap, reactContext);
        }
    }

}
`;

    fs.writeFileSync(fcmTokenPath, fcmTokenContent);
    console.log('  - Patched FcmToken.java for New Architecture support');

    // Fix autolinking config for RN 0.84+
    // The library's react-native.config.js uses reactNativeHost.getApplication()
    // but in RN 0.84, PackageList(Application) sets reactNativeHost to null.
    // Change to use the application field directly.
    const configPath =
        './node_modules/react-native-notifications/react-native.config.js';

    if (fs.existsSync(configPath)) {
        let configContent = fs.readFileSync(configPath, 'utf8');
        if (configContent.includes('reactNativeHost.getApplication()')) {
            configContent = configContent.replace(
                'reactNativeHost.getApplication()',
                'application'
            );
            fs.writeFileSync(configPath, configContent);
            console.log('  - Patched react-native.config.js for RN 0.84 compatibility');
        }
    }
}
