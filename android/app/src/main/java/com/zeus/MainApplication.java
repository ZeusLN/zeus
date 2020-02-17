package com.zeusln.zeus;

import android.app.Application;
import android.util.Log;
import android.content.Intent;
import com.facebook.react.PackageList;
import com.facebook.hermes.reactexecutor.HermesExecutorFactory;
import com.facebook.react.bridge.JavaScriptExecutorFactory;
import com.facebook.react.shell.MainReactPackage;

import com.facebook.react.ReactApplication;
import io.realm.react.RealmReactPackage;
import com.BV.LinearGradient.LinearGradientPackage;
import com.facebook.react.modules.network.OkHttpClientProvider;
import com.wix.RNCameraKit.RNCameraKitPackage;
import com.swmansion.gesturehandler.react.RNGestureHandlerPackage;
import com.oblador.vectoricons.VectorIconsPackage;
import com.facebook.react.ReactNativeHost;
import com.facebook.react.ReactPackage;
import android.content.Context;

import com.reactlibrary.securekeystore.RNSecureKeyStorePackage;

import com.facebook.soloader.SoLoader;
import com.zeusln.zeus.extensions.CustomClientFactory;
import com.microsoft.ActivityResultPackage;

import java.lang.reflect.InvocationTargetException;
import java.util.List;

import com.zeusln.zeus.CustomTorPackage;

public class MainApplication extends Application implements ReactApplication {
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
      SoLoader.init(this, /* native exopackage */ false);
      /* Add this row for https errors */
      OkHttpClientProvider.setOkHttpClientFactory(new CustomClientFactory());
  }
}
