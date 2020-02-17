package com.zeusln.zeus;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;

import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import com.zeusln.zeus.TorService;
import com.zeusln.zeus.TorManager;
import android.content.Intent;
import android.content.Context;

public class TorModule extends ReactContextBaseJavaModule {
  private static ReactApplicationContext reactContext;

  public String getName() {
      return "TorModule";
  }

  @ReactMethod
  public void startTor() {
      Intent startIntent = new Intent(reactContext.getApplicationContext(), TorService.class);
      startIntent.setAction(TorService.START_SERVICE);
      reactContext.startService(startIntent);
  }

  TorModule(ReactApplicationContext context) {
      super(context);
      reactContext = context;
  }

}