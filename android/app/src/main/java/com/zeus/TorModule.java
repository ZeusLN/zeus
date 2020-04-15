package com.zeusln.zeus;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;
import com.facebook.react.uimanager.IllegalViewOperationException;

import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Callback;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.HashMap;

import com.zeusln.zeus.TorService;
import com.zeusln.zeus.TorManager;
import com.zeusln.zeus.util.WebUtil;
import android.content.Intent;
import android.content.Context;

import android.util.Log;

import io.reactivex.android.schedulers.AndroidSchedulers;
import io.reactivex.disposables.CompositeDisposable;
import io.reactivex.disposables.Disposable;
import io.reactivex.schedulers.Schedulers;

import com.facebook.react.modules.core.DeviceEventManagerModule;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.Arguments;
import androidx.annotation.Nullable;

public class TorModule extends ReactContextBaseJavaModule {
  private static ReactApplicationContext reactContext;
  private CompositeDisposable compositeDisposables = new CompositeDisposable();

  public String getName() {
      return "TorModule";
  }

  private void sendEvent(ReactContext reactContext,
                       String eventName,
                       @Nullable WritableMap params) {
    reactContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
        .emit(eventName, params);
  }

  @ReactMethod
  public void startTor() {
      Disposable disposableTorStatus = TorManager.getInstance(reactContext.getApplicationContext())
                .torStatus
                .subscribeOn(Schedulers.newThread())
                .observeOn(AndroidSchedulers.mainThread())
                .subscribe(state -> {
                    WritableMap params = Arguments.createMap();
                    if (state == TorManager.CONNECTION_STATES.CONNECTING) {
                        params.putString("status", "Connecting");
                    } else if (state == TorManager.CONNECTION_STATES.CONNECTED) {
                        params.putString("status", "Connected");
                        params.putString("currentPort", String.valueOf(TorManager.getInstance(reactContext.getApplicationContext()).currentPort));
                    } else {
                        params.putString("status", "Disconnected");
                    }
                    sendEvent(reactContext, "TorStatusReminder", params);
                });
      compositeDisposables.add(disposableTorStatus);
      Intent startIntent = new Intent(reactContext.getApplicationContext(), TorService.class);
      startIntent.setAction(TorService.START_SERVICE);
      reactContext.startService(startIntent);
  }

  @ReactMethod
  public void stopTor() {
      Intent startIntent = new Intent(reactContext.getApplicationContext(), TorService.class);
      startIntent.setAction(TorService.STOP_SERVICE);
      reactContext.startService(startIntent);
  }

  @ReactMethod
  public void getCurrentPort(Callback successCallback, Callback errorCallback) {
      try {
          int port = TorManager.getInstance(reactContext.getApplicationContext()).currentPort;
          Log.i("reactDebug", String.valueOf(port));
          successCallback.invoke(port);
      } catch (IllegalViewOperationException e) {
          errorCallback.invoke(e.getMessage());
      }
  }

  @ReactMethod
  public void makeRestCall(ReadableMap params, Callback successCallback, Callback errorCallback) {
      try {
          // int port = TorManager.getInstance(reactContext.getApplicationContext()).currentPort;
          // Log.i("reactDebug", String.valueOf(port));

          // HashMap<String,String> args = new HashMap<String,String>();
          // args.put("active", StringUtils.join(xpubs, "|"));
          // args.put("at", getAccessToken());

          String response;
          String url = params.getString("url");
          ReadableMap data = params.getMap("data");
          if (params.hasKey("method") && params.getString("method").equals("GET")) {
              Log.i("restDebug", "GET");
              try {
                  response = WebUtil.getInstance(reactContext.getApplicationContext()).getURL(url);
                  Log.i("restDebug", response);
                  successCallback.invoke(response);
              } catch(Exception e) {
                  Log.i("exception get", e.getMessage());
              }
          } else if (params.hasKey("method") && params.getString("method").equals("POST")) {
              Log.i("restDebug", "POST");
              // response = WebUtil.getInstance(reactContext).postURL(url, data);
          } else if (params.hasKey("method") && params.getString("method").equals("DELETE")) {
              Log.i("restDebug", "GET");
              // response = WebUtil.getInstance(reactContext).deleteURL(url, data);
          }
          // Log.i("restDebug", response);
          // successCallback.invoke(response);
      } catch (IllegalViewOperationException e) {
          errorCallback.invoke(e.getMessage());
      }
  }

  TorModule(ReactApplicationContext context) {
      super(context);
      reactContext = context;
  }

}