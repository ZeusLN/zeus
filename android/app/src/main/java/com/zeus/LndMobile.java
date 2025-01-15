package app.zeusln.zeus;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.content.ContextCompat;

import android.Manifest;
import android.app.ActivityManager;
import android.database.sqlite.SQLiteDatabase;
import android.os.FileObserver;
import android.os.Process;
import android.util.Base64;
import android.util.Log;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.os.Environment;
import android.os.Message;
import android.os.Messenger;
import android.os.Handler;
import android.os.Bundle;
import android.os.IBinder;
import android.os.RemoteException;

import android.nfc.Tag;
import android.nfc.NfcAdapter;
import android.nfc.NdefMessage;
import android.nfc.tech.Ndef;
import android.nfc.NdefRecord;

import java.io.BufferedReader;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.InputStreamReader;
import java.util.Arrays;
import java.io.UnsupportedEncodingException;

import java.io.PrintWriter;
import java.io.File;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.Random;
import java.util.EnumSet;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableType;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import com.reactnativecommunity.asyncstorage.ReactDatabaseSupplier;
import com.reactnativecommunity.asyncstorage.AsyncLocalStorageUtil;
// import org.torproject.jni.TorService;

// TODO break this class up
class LndMobile extends ReactContextBaseJavaModule {
  private final String TAG = "LndMobile";
  Messenger messenger;
  private boolean lndMobileServiceBound = false;
  private Messenger lndMobileServiceMessenger; // The service
  private HashMap<Integer, Promise> requests = new HashMap<>();

  public enum LndStatus {
      SERVICE_BOUND, PROCESS_STARTED, WALLET_UNLOCKED;
      public static final EnumSet<LndStatus> ALL_OPTS = EnumSet.allOf(LndStatus.class);
      public final int flag;

      LndStatus() {
        this.flag = 1 << this.ordinal();
      }
  }

  @Override
  public Map<String, Object> getConstants() {
    final Map<String, Object> constants = new HashMap<>();
    constants.put("STATUS_SERVICE_BOUND", LndStatus.SERVICE_BOUND.flag);
    constants.put("STATUS_PROCESS_STARTED", LndStatus.PROCESS_STARTED.flag);
    constants.put("STATUS_WALLET_UNLOCKED", LndStatus.WALLET_UNLOCKED.flag); // NOT IN USE

    return constants;
  }

  class IncomingHandler extends Handler {
    @Override
    public void handleMessage(Message msg) {
      Bundle bundle = msg.getData();

      switch (msg.what) {
        case LndMobileService.MSG_GRPC_COMMAND_RESULT:
        case LndMobileService.MSG_START_LND_RESULT:
        case LndMobileService.MSG_REGISTER_CLIENT_ACK:
        case LndMobileService.MSG_STOP_LND_RESULT:
        case LndMobileService.MSG_PONG: {
          final int request = msg.arg1;

          if (!requests.containsKey(request)) {
            return;
          }

          final Promise promise = requests.remove(request);

          if (bundle.containsKey("error_code")) {
            promise.reject(bundle.getString("error_code"), bundle.getString("error_desc"));
          } else {
            final byte[] bytes = (byte[]) bundle.get("response");
            String b64 = "";
            if (bytes != null && bytes.length > 0) {
              b64 = Base64.encodeToString(bytes, Base64.NO_WRAP);
            }
            WritableMap params = Arguments.createMap();
            params.putString("data", b64);
            promise.resolve(params);
          }

          break;
        }
        case LndMobileService.MSG_GOSSIP_SYNC_RESULT: {
          final int request = msg.arg1;
          final Promise promise = requests.remove(request);
          if (bundle.containsKey("response")) {
            final byte[] bytes = (byte[]) bundle.get("response");
            promise.resolve("response=" + new String(bytes, StandardCharsets.UTF_8));
          } else if (bundle.containsKey("error_code")) {
            promise.reject(bundle.getString("error_code"), bundle.getString("error_desc"));
          } else {
            promise.reject("noresponse");
          }
          break;
        }
        case LndMobileService.MSG_GRPC_STREAM_RESULT: {
          // TODO EOF Stream error
          final String method = (String) bundle.get("method");
          WritableMap params = Arguments.createMap();

          if (bundle.containsKey("error_code")) {
            params.putString("error_code", bundle.getString("error_code"));
            params.putString("error_desc", bundle.getString("error_desc"));
          } else {
            final byte[] bytes = (byte[]) bundle.get("response");
            String b64 = "";
            if (bytes != null && bytes.length > 0) {
              b64 = Base64.encodeToString(bytes, Base64.NO_WRAP);
            }
            params.putString("data", b64);
          }

          getReactApplicationContext()
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
            .emit(method, params);
          break;
        }
        case LndMobileService.MSG_CHECKSTATUS_RESPONSE: {
          final int request = msg.arg1;

          if (!requests.containsKey(request)) {
            return;
          }

          final Promise promise = requests.remove(request);
          int flags = msg.arg2;
          promise.resolve(flags);
          break;
        }
        case LndMobileService.MSG_GRPC_STREAM_STARTED:
        case LndMobileService.MSG_GRPC_STREAM_WRITE: {
          final int request = msg.arg1;
          final Promise promise = requests.remove(request);
          if (promise != null) {
            promise.resolve("done");
          }
          break;
        }
      }
    }
  }

  class LndMobileServiceConnection implements ServiceConnection {
    private int request;

    LndMobileServiceConnection(int request) {
      this.request = request;
    }

    @Override
    public void onServiceConnected(ComponentName name, IBinder service) {
      lndMobileServiceBound = true;
      lndMobileServiceMessenger = new Messenger(service);

      try {
        Message msg = Message.obtain(null, LndMobileService.MSG_REGISTER_CLIENT, request, 0);
        msg.replyTo = messenger;
        lndMobileServiceMessenger.send(msg);
      } catch (RemoteException e) {
        // In this case the service has crashed before we could even
        // do anything with it; we can count on soon being
        // disconnected (and then reconnected if it can be restarted)
        // so there is no need to do anything here.
        Log.e(TAG, "LndMobileServiceConnection:onServiceConnected exception");
        Log.e(TAG, e.getMessage());
      }
    }

    @Override
    public void onServiceDisconnected(ComponentName className) {
      // This is called when the connection with the service has been
      // unexpectedly disconnected -- that is, its process crashed.
      lndMobileServiceMessenger = null;
      lndMobileServiceBound = false;
    }
  }

  private LndMobileServiceConnection lndMobileServiceConnection;

  private boolean getPersistentServicesEnabled(Context context) {
    ReactDatabaseSupplier dbSupplier = ReactDatabaseSupplier.getInstance(context);
    SQLiteDatabase db = dbSupplier.get();
    String persistentServicesEnabled = AsyncLocalStorageUtil.getItemImpl(db, "persistentServicesEnabled");
    if (persistentServicesEnabled != null) {
      return persistentServicesEnabled.equals("true");
    }
    // HyperlogLog.w(TAG, "Could not find persistentServicesEnabled in asyncStorage");
    return false;
  }

  public LndMobile(ReactApplicationContext reactContext) {
    super(reactContext);
  }

  @Override
  public String getName() {
    return "LndMobile";
  }

  @ReactMethod
  public void checkLndMobileServiceConnected(Promise p) {
    if (lndMobileServiceBound) {
      p.resolve(true);
    }
    else {
      p.resolve(false);
    }
  }

  @ReactMethod
  public void sendPongToLndMobileservice(Promise promise) {
    int req = new Random().nextInt();
    requests.put(req, promise);

    Message message = Message.obtain(null, LndMobileService.MSG_PING, req, 0);
    message.replyTo = messenger;

    try {
      lndMobileServiceMessenger.send(message);
    } catch (RemoteException e) {
      promise.reject(TAG, "Could not Send MSG_PONG to LndMobileService", e);
    }
  }

  @ReactMethod
  public void initialize(Promise promise) {
    if (!lndMobileServiceBound) {
      int req = new Random().nextInt();
      requests.put(req, promise);

      lndMobileServiceConnection = new LndMobileServiceConnection(req);
      messenger = new Messenger(new IncomingHandler()); // me
      Intent intent = new Intent(getReactApplicationContext(), LndMobileService.class);
      if (getPersistentServicesEnabled(getReactApplicationContext())) {
        getReactApplicationContext().startForegroundService(intent);
      }
      // else rely on bindService to start LND
      getReactApplicationContext().bindService(
        intent,
        lndMobileServiceConnection,
        Context.BIND_AUTO_CREATE
      );

      lndMobileServiceBound = true;

      // Note: Promise is returned from MSG_REGISTER_CLIENT_ACK message from LndMobileService
    } else {
      promise.resolve(0);
    }
  }

  @ReactMethod
  public void unbindLndMobileService(Promise promise) {
    if (lndMobileServiceBound) {
      int req = new Random().nextInt();
      requests.put(req, promise);

      if (lndMobileServiceMessenger != null) {
        try {
          Message message = Message.obtain(null, LndMobileService.MSG_UNREGISTER_CLIENT, req);
          message.replyTo = messenger;
          lndMobileServiceMessenger.send(message);
        } catch (RemoteException e) {
          // ignore
        }
      }

      getReactApplicationContext().unbindService(lndMobileServiceConnection);
      lndMobileServiceBound = false;
    }
  }

  // TODO unbind LndMobileService?

  @ReactMethod
  public void checkStatus(Promise promise) {
    int req = new Random().nextInt();
    requests.put(req, promise);

    Message message = Message.obtain(null, LndMobileService.MSG_CHECKSTATUS, req, 0);
    message.replyTo = messenger;

    try {
      lndMobileServiceMessenger.send(message);
    } catch (RemoteException e) {
      promise.reject(TAG, "Could not Send MSG_CHECKSTATUS to LndMobileService", e);
    }
  }

  @ReactMethod
  public void startLnd(String args, Boolean isTorEnabled, Boolean isTestnet, Promise promise) {
    // TODO args is only used on iOS right now
    int req = new Random().nextInt();
    requests.put(req, promise);

    Message message = Message.obtain(null, LndMobileService.MSG_START_LND, req, 0);
    message.replyTo = messenger;

    Bundle bundle = new Bundle();

    String params = "--lnddir=" + getReactApplicationContext().getFilesDir().getPath();
    if (isTorEnabled) {
      // int listenPort = ZeusTorUtils.getListenPort(isTestnet);
      // String controlSocket = "unix://" + getReactApplicationContext().getDir(TorService.class.getSimpleName(), Context.MODE_PRIVATE).getAbsolutePath() + "/data/ControlSocket";
      // params += " --tor.active --tor.control=" + controlSocket;
      // params += " --tor.v3 --listen=localhost:" + listenPort;
    } else {
      // If Tor isn't active, make sure we aren't
      // listening at all
      params += " --nolisten";
    }
    bundle.putString(
      "args",
      params + " " + args
    );
    message.setData(bundle);

    try {
      lndMobileServiceMessenger.send(message);
    } catch (RemoteException e) {
      promise.reject(TAG, "Could not Send MSG_START_LND to LndMobileService", e);
    }
  }

  @ReactMethod
  public void stopLnd(Promise promise) {
    int req = new Random().nextInt();
    requests.put(req, promise);

    Message message = Message.obtain(null, LndMobileService.MSG_STOP_LND, req, 0);
    message.replyTo = messenger;

    try {
      lndMobileServiceMessenger.send(message);
    } catch (RemoteException e) {
      promise.reject(TAG, "Could not Send MSG_STOP_LND to LndMobileService", e);
    }
  }

  @ReactMethod
  public void gossipSync(String serviceUrl, Promise promise) {
    int req = new Random().nextInt();
    requests.put(req, promise);

    Message message = Message.obtain(null, LndMobileService.MSG_GOSSIP_SYNC, req, 0);
    message.replyTo = messenger;
    Bundle bundle = new Bundle();
    bundle.putString(
      "serviceUrl",
      serviceUrl
    );
    // TODO remove unused param
    bundle.putString(
      "networkType",
      ""
    );
    message.setData(bundle);

    try {
      lndMobileServiceMessenger.send(message);
    } catch (RemoteException e) {
      promise.reject(TAG, "Could not Send MSG_GOSSIP_SYNC to LndMobileService", e);
    }
  }

  @ReactMethod
  public void cancelGossipSync(Promise promise) {
    int req = new Random().nextInt();
    requests.put(req, promise);

    Message message = Message.obtain(null, LndMobileService.MSG_CANCEL_GOSSIP_SYNC, req, 0);
    message.replyTo = messenger;

    try {
      lndMobileServiceMessenger.send(message);
    } catch (RemoteException e) {
      promise.reject(TAG, "Could not Send MSG_CANCEL_GOSSIP_SYNC to LndMobileService", e);
    }
  }

  @ReactMethod
  public void sendCommand(String method, String payloadStr, final Promise promise) {
    int req = new Random().nextInt();
    requests.put(req, promise);

    Message message = Message.obtain(null, LndMobileService.MSG_GRPC_COMMAND, req, 0);
    message.replyTo = messenger;

    Bundle bundle = new Bundle();
    bundle.putString("method", method);
    bundle.putByteArray("payload", Base64.decode(payloadStr, Base64.NO_WRAP));
    message.setData(bundle);

    try {
      lndMobileServiceMessenger.send(message);
    } catch (RemoteException e) {
      promise.reject(TAG, "Could not Send MSG_GRPC_COMMAND to LndMobileService", e);
    }
  }

  @ReactMethod
  public void sendStreamCommand(String method, String payloadStr, boolean streamOnlyOnce, Promise promise) {
    int req = new Random().nextInt();
    requests.put(req, promise);

    Message message = Message.obtain(null, LndMobileService.MSG_GRPC_STREAM_COMMAND, req, 0);
    message.replyTo = messenger;

    Bundle bundle = new Bundle();
    bundle.putString("method", method);
    bundle.putByteArray("payload", Base64.decode(payloadStr, Base64.NO_WRAP));
    bundle.putBoolean("stream_only_once", streamOnlyOnce);
    message.setData(bundle);

    try {
      lndMobileServiceMessenger.send(message);
    } catch (RemoteException e) {
      promise.reject(TAG, "Could not Send MSG_GRPC_STREAM_COMMAND to LndMobileService", e);
    }

    promise.resolve("done");
  }

  @ReactMethod
  public void sendBidiStreamCommand(String method, boolean streamOnlyOnce, Promise promise) {
    int req = new Random().nextInt();
    requests.put(req, promise);

    Message message = Message.obtain(null, LndMobileService.MSG_GRPC_BIDI_STREAM_COMMAND, req, 0);
    message.replyTo = messenger;

    Bundle bundle = new Bundle();
    bundle.putString("method", method);
    bundle.putBoolean("stream_only_once", streamOnlyOnce);
    message.setData(bundle);

    try {
      lndMobileServiceMessenger.send(message);
    } catch (RemoteException e) {
      promise.reject(TAG, "Could not Send MSG_GRPC_BIDI_STREAM_COMMAND to LndMobileService", e);
    }

    promise.resolve("done");
  }

  @ReactMethod
  public void writeToStream(String method, String payloadStr, Promise promise) {
    int req = new Random().nextInt();
    requests.put(req, promise);

    Message message = Message.obtain(null, LndMobileService.MSG_GRPC_STREAM_WRITE, req, 0);
    message.replyTo = messenger;

    Bundle bundle = new Bundle();
    bundle.putString("method", method);
    bundle.putByteArray("payload", Base64.decode(payloadStr, Base64.NO_WRAP));
    message.setData(bundle);

    try {
      lndMobileServiceMessenger.send(message);
    } catch (RemoteException e) {
      promise.reject(TAG, "Could not Send MSG_GRPC_STREAM_WRITE to LndMobileService", e);
    }

    promise.resolve("done");
  }

  @ReactMethod
  void unlockWallet(String password, Promise promise) {
    int req = new Random().nextInt();
    requests.put(req, promise);

    Message message = Message.obtain(null, LndMobileService.MSG_UNLOCKWALLET, req, 0);
    message.replyTo = messenger;

    Bundle bundle = new Bundle();
    bundle.putString("password", password);
    message.setData(bundle);

    try {
      lndMobileServiceMessenger.send(message);
    } catch (RemoteException e) {
      promise.reject(TAG, "Could not Send MSG_UNLOCKWALLET to LndMobileService", e);
    }
  }

  @ReactMethod
  void initWallet(ReadableArray seed, String password, int recoveryWindow, String channelBackupsBase64, Promise promise) {
    int req = new Random().nextInt();
    requests.put(req, promise);

    ArrayList<String> seedList = new ArrayList();
    for (int i = 0; i < seed.size(); i++) {
      if (seed.getType(i) == ReadableType.String) {
        seedList.add(seed.getString(i));
      }
    }

    Message message = Message.obtain(null, LndMobileService.MSG_INITWALLET, req, 0);
    message.replyTo = messenger;

    Bundle bundle = new Bundle();
    // TODO(hsjoberg): this could possibly be faster if we
    // just encode it to a bytearray using the grpc lib here,
    // instead of letting LndMobileService do that part
    bundle.putStringArrayList("seed", seedList);
    bundle.putString("password", password);
    bundle.putInt("recoveryWindow", recoveryWindow);
    bundle.putString("channelBackupsBase64", channelBackupsBase64);
    message.setData(bundle);

    try {
      lndMobileServiceMessenger.send(message);
    } catch (RemoteException e) {
      promise.reject(TAG, "Could not Send MSG_INITWALLET to LndMobileService", e);
    }
  }
}
