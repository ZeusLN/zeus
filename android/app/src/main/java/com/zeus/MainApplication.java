package app.zeusln.zeus;

import android.app.Application;
import android.util.Log;
import com.facebook.react.PackageList;
//import com.facebook.hermes.reactexecutor.HermesExecutorFactory;
import com.facebook.react.bridge.JavaScriptExecutorFactory;
import com.facebook.react.shell.MainReactPackage;

import com.facebook.react.bridge.JSIModulePackage;

import com.facebook.react.ReactApplication;
// import com.swmansion.gesturehandler.react.RNGestureHandlerPackage;
import com.oblador.vectoricons.VectorIconsPackage;
import com.facebook.react.ReactNativeHost;
import com.facebook.react.ReactPackage;
import com.remobile.qrcodeLocalImage.RCTQRCodeLocalImagePackage; 
import android.content.Context;

import com.facebook.soloader.SoLoader;

import java.lang.reflect.InvocationTargetException;
import java.util.List;

import com.reactnativerestart.RestartPackage;

public class MainApplication extends Application implements ReactApplication {

    private final ReactNativeHost mReactNativeHost =
      new ReactNativeHost(this) {
        @Override
        public boolean getUseDeveloperSupport() {
          return BuildConfig.DEBUG;
        }
        @Override
        protected List<ReactPackage> getPackages() {
          new RCTQRCodeLocalImagePackage();   
          @SuppressWarnings("UnnecessaryLocalVariable")
          List<ReactPackage> packages = new PackageList(this).getPackages();
          packages.add(new MobileToolsPackage());
          packages.add(new LndMobilePackage());
          packages.add(new LndMobileToolsPackage());
          packages.add(new GossipFileScheduledSyncPackage());
          packages.add(new LndMobileScheduledSyncPackage());
          packages.add(new LncPackage());
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
  }
}
