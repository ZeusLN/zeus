package app.zeusln.zeus;

import android.content.Context
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import okhttp3.OkHttpClient
import java.io.IOException
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.Proxy;
import java.security.cert.X509Certificate

import app.zeusln.zeus.AndroidCallback

import lndmobile.Lndmobile;

class LncModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String {
    return "LncModule"
  }

  @ReactMethod
  fun registerLocalPrivCreateCallback(namespace: String, onLocalPrivCreate: Callback) {
     val lpccb = AndroidCallback()
     lpccb.setCallback(onLocalPrivCreate)

     Lndmobile.registerLocalPrivCreateCallback(namespace, lpccb)
  }

  @ReactMethod
  fun registerRemoteKeyReceiveCallback(namespace: String, onRemoteKeyReceive: Callback) {
     val rkrcb = AndroidCallback()
     rkrcb.setCallback(onRemoteKeyReceive)

     Lndmobile.registerRemoteKeyReceiveCallback(namespace, rkrcb)
  }

  @ReactMethod
  fun registerAuthDataCallback(namespace: String, onAuthData: Callback) {
     val oacb = AndroidCallback()
     oacb.setCallback(onAuthData)

     Lndmobile.registerAuthDataCallback(namespace, oacb)
  }

  @ReactMethod
  fun initLNC(namespace: String) {
     Lndmobile.initLNC(namespace, "info")
  }

  @ReactMethod
  fun isConnected(namespace: String, promise: Promise) {
     try {
        var response = Lndmobile.isConnected(namespace)
        promise.resolve(response);
     } catch(e: Throwable) {
        promise.reject("request Error", e);
     }
  }

  @ReactMethod
  fun status(namespace: String, promise: Promise) {
     try {
        var response = Lndmobile.status(namespace)
        promise.resolve(response);
     } catch(e: Throwable) {
        promise.reject("request Error", e);
     }
  }

  @ReactMethod
  fun expiry(namespace: String, promise: Promise) {
     try {
        var response = Lndmobile.getExpiry(namespace)
        promise.resolve(response);
     } catch(e: Throwable) {
        promise.reject("request Error", e);
     }
  }

  @ReactMethod
  fun isReadOnly(namespace: String, promise: Promise) {
     try {
        var response = Lndmobile.isReadOnly(namespace)
        promise.resolve(response);
     } catch(e: Throwable) {
        promise.reject("request Error", e);
     }
  }

  @ReactMethod
  fun hasPerms(namespace: String, permission: String, promise: Promise) {
     try {
        var response = Lndmobile.hasPermissions(namespace, permission)
        promise.resolve(response);
     } catch(e: Throwable) {
        promise.reject("request Error", e);
     }
  }

  @ReactMethod
  fun connectServer(namespace: String, mailboxServerAddr: String, isDevServer: Boolean = false, connectPhrase: String, localStatic: String, remoteStatic: String, promise: Promise) {
     Log.d("connectMailbox", "called with connectPhrase: " + connectPhrase
     + " and mailboxServerAddr: " + mailboxServerAddr);

     try {
         Lndmobile.connectServer(namespace, mailboxServerAddr, isDevServer, connectPhrase, localStatic ?: "", remoteStatic ?: "")
         promise.resolve(null)
     } catch (e: Exception) {
         val exceptionAsString = e.toString()
         promise.resolve(exceptionAsString)
     }
  }

  @ReactMethod
  fun disconnect(namespace: String) {
     Lndmobile.disconnect(namespace)
  }

  @ReactMethod
  fun invokeRPC(namespace: String, route: String, requestData: String, rnCallback: Callback) {
     Log.d("request", "called with route: " + route
     + " and requestData: " + requestData);

     val gocb = AndroidCallback()
     gocb.setCallback(rnCallback)
     Lndmobile.invokeRPC(namespace, route, requestData, gocb)
  }

  private fun sendEvent(event: String, data: String) {
      val params = Arguments.createMap().apply {
        putString("result", data)
      }
      getReactApplicationContext()
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(event, params)
  }

  @ReactMethod
  fun initListener(namespace: String, eventName: String, request: String) {
     val gocb = AndroidStreamingCallback()
     gocb.setEventName(eventName)
     gocb.setCallback(::sendEvent)
     Lndmobile.invokeRPC(namespace, eventName, request, gocb)
  }
}
