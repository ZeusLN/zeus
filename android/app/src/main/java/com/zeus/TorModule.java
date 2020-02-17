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
import android.view.View;
import android.app.Activity;

public class TorModule extends ReactContextBaseJavaModule {
  private static ReactApplicationContext reactContext;
  Activity context;

  public String getName() {
      return "TorModule";
  }

  @ReactMethod
  public void startTor(View view) {
      Intent startIntent = new Intent(context.getApplicationContext(), TorService.class);
      startIntent.setAction(TorService.START_SERVICE);
      startService(startIntent);
  }

  TorModule(ReactApplicationContext context) {
      super(context);
      reactContext = context;
  }

}