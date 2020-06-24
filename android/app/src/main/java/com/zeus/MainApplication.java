package com.zeusln.zeus;

import android.app.Application;
import android.util.Log;
import android.content.Intent;
import com.facebook.react.PackageList;
import com.facebook.hermes.reactexecutor.HermesExecutorFactory;
import com.facebook.react.bridge.JavaScriptExecutorFactory;
import com.facebook.react.shell.MainReactPackage;

import com.facebook.react.ReactApplication;
import com.BV.LinearGradient.LinearGradientPackage;
import com.wix.RNCameraKit.RNCameraKitPackage;
import com.swmansion.gesturehandler.react.RNGestureHandlerPackage;
import com.oblador.vectoricons.VectorIconsPackage;
import com.facebook.react.ReactNativeHost;
import com.facebook.react.ReactPackage;
import android.content.Context;

import com.reactlibrary.securekeystore.RNSecureKeyStorePackage;

import com.facebook.soloader.SoLoader;
import com.microsoft.ActivityResultPackage;

import java.lang.reflect.InvocationTargetException;
import java.util.List;

import com.zeusln.zeus.CustomTorPackage;
import android.os.Build;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;

public class MainApplication extends Application implements ReactApplication {

    public static String TOR_CHANNEL_ID = "TOR_CHANNEL";
    public static String FOREGROUND_SERVICE_CHANNEL_ID = "FOREGROUND_SERVICE_CHANNEL_ID";

    private final ReactNativeHost mReactNativeHost =
        new ReactNativeHost(this) {
          @Override
          public boolean getUseDeveloperSupport() {
              return BuildConfig.DEBUG;
          }
          @Override
          protected List<ReactPackage> getPackages() {
              @SuppressWarnings("UnnecessaryLocalVariable")
              List<ReactPackage> packages = new PackageList(this).getPackages();
              packages.add(new CustomTorPackage());
              return packages;
          }
          @Override
          protected String getJSMainModuleName() {
              return "index";
          }
      };


  @Override
  public ReactNativeHost getReactNativeHost() {
      return mReactNativeHost;
  }

  @Override
  public void onCreate() {
      super.onCreate();
      setUpChannels();
      SoLoader.init(this, /* native exopackage */ false);
      /* Add this row for https errors */
      OkHttpClientProvider.setOkHttpClientFactory(new CustomClientFactory());
  }

  private void setUpChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel serviceChannel = new NotificationChannel(
                    TOR_CHANNEL_ID,
                    "Tor service ",
                    NotificationManager.IMPORTANCE_DEFAULT
            );
            serviceChannel.setSound(null, null);
            NotificationManager manager = getSystemService(NotificationManager.class);

            NotificationChannel refreshService = new NotificationChannel(
                    FOREGROUND_SERVICE_CHANNEL_ID,
                    "Zeus Service",
                    NotificationManager.IMPORTANCE_DEFAULT
            );
            refreshService.setSound(null, null);
            refreshService.setImportance(NotificationManager.IMPORTANCE_LOW);
            refreshService.setLockscreenVisibility(Notification.VISIBILITY_SECRET);

            if (manager != null) {
                manager.createNotificationChannel(serviceChannel);
                manager.createNotificationChannel(refreshService);
            }
        }
    }
}
