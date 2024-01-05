package app.zeusln.zeus;

import android.annotation.SuppressLint;
import android.app.ActivityManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.os.Bundle;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.os.Message;
import android.os.Messenger;
import android.os.Process;
import android.os.RemoteException;
import android.util.Log;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteStatement;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.concurrent.futures.CallbackToFutureAdapter;
import com.google.common.util.concurrent.ListenableFuture;
import androidx.work.ListenableWorker;
import androidx.work.WorkerParameters;

import com.facebook.react.bridge.ReactApplicationContext;
import com.reactnativecommunity.asyncstorage.ReactDatabaseSupplier;
import com.reactnativecommunity.asyncstorage.AsyncLocalStorageUtil;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.ReadableMap;

import com.oblador.keychain.KeychainModule;
import com.google.protobuf.ByteString;
// import com.hypertrack.Hyperlog.Hyperlog;

import org.torproject.jni.TorService;

public class LndMobileScheduledSyncWorker extends ListenableWorker {
  private final String TAG = "LndScheduledSyncWorker";
  private final String HANDLERTHREAD_NAME = "zeus_lndmobile_sync";
  private Handler incomingHandler;
  private boolean lndMobileServiceBound = false;
  private Messenger messengerService; // The service
  private Messenger messenger; // Me
  private ReactDatabaseSupplier dbSupplier;
  private boolean lndStarted = false;
  private boolean torEnabled = false;
  private int torSocksPort = -1;
  private boolean torStarted = false;
  private boolean persistentServicesEnabled = false;
  // Keeps track of how many times we've tried to get info
  // If this keeps going without `syncedToChain` flipping to `true`
  // we'll close down lnd and the worker
  private int numGetInfoCalls = 0;

  ZeusTor zeusTor;

  // private enum WorkState {
  //   NOT_STARTED, BOUND, WALLET_UNLOCKED, WAITING_FOR_SYNC, DONE;
  //   public static final EnumSet<WorkState> ALL_OPTS = EnumSet.allOf(WorkState.class);
  //   public final int flag;

  //   WorkState() {
  //     this.flag = 1 << this.ordinal();
  //   }
  // }
  // WorkState currentState = WorkState.NOT_STARTED;

  public LndMobileScheduledSyncWorker(@NonNull Context context, @NonNull WorkerParameters workerParams) {
    super(context, workerParams);
    dbSupplier = ReactDatabaseSupplier.getInstance(getApplicationContext());
    zeusTor = new ZeusTor(new ReactApplicationContext(getApplicationContext()));
  }

  @Override
  public ListenableFuture<Result> startWork() {
    torEnabled = getTorEnabled();
    persistentServicesEnabled = getPersistentServicesEnabled();

    return CallbackToFutureAdapter.getFuture(completer -> {
      // Hyperlog.i(TAG, "------------------------------------");
      // Hyperlog.i(TAG, "Starting scheduled sync work");
      // Hyperlog.i(TAG, "I am " + getApplicationContext().getPackageName());
      writeLastScheduledSyncAttemptToDb();

      // Hyperlog.i(TAG, "MainActivity.started = " + MainActivity.started);
      if (persistentServicesEnabled || MainActivity.started) {
        // Hyperlog.i(TAG, "MainActivity is started or persistentServicesEnabled = " + persistentServicesEnabled + ", quitting job");
        completer.set(Result.success());
        return null;
      }

      KeychainModule keychain = new KeychainModule(new ReactApplicationContext(getApplicationContext()));

      WritableMap keychainOptions = Arguments.createMap();
      WritableMap keychainOptionsAuthenticationPrompt = Arguments.createMap();
      keychainOptionsAuthenticationPrompt.putString("title", "Authenticate to retrieve secret");
      keychainOptionsAuthenticationPrompt.putString("cancel", "Cancel");
      keychainOptions.putMap("authenticationPrompt", keychainOptionsAuthenticationPrompt);

      keychain.getInternetCredentialsForServer("password", keychainOptions, new PromiseWrapper() {
        @Override
        public void onSuccess(@Nullable Object value) {
          // Hyperlog.d(TAG, "onSuccess");

          if (value == null) {
            // Hyperlog.e(TAG, "Failed to get wallet password, got null from keychain provider");
            completer.set(Result.failure());
            return;
          } else {
            // Hyperlog.d(TAG, "Password data retrieved from keychain");
            final String password = ((ReadableMap) value).getString("password");
            // Hyperlog.d(TAG, "Password retrieved");

            if (torEnabled) {
              //            boolean startTorResult = startTor();
              //            if (!startTorResult) {
              //              Log.e(TAG, "Could not start Tor");
              //              future.set(Result.failure());
              //              return;
              //            }
              zeusTor.startTor(new PromiseWrapper() {
                @Override
                void onSuccess(@Nullable Object value) {
                  // Hyperlog.i(TAG, "Tor started");
                  // Hyperlog.i(TAG, "torSocksPort: " + (int) value);
                  torStarted = true;
                  torSocksPort = (int) value;

                  startLndWorkThread(completer, password);
                }

                @Override
                void onFail(Throwable throwable) {
                  // Hyperlog.e(TAG, "Failed to start Tor", throwable);
                  zeusTor.stopTor(new PromiseWrapper() {
                    @Override
                    void onSuccess(@Nullable Object value) {
                    }

                    @Override
                    void onFail(Throwable throwable) {
                    }
                  });
                  completer.set(Result.failure());
                }
              });
            } else {
              startLndWorkThread(completer, password);
            }
          }
        }

        @Override
        public void onFail(Throwable throwable) {
          // Hyperlog.d(TAG, "Failed to get wallet password " + throwable.getMessage(), throwable);
          completer.set(Result.failure());
        }
      });
      return null;
    });
  }

  private void startLndWorkThread(CallbackToFutureAdapter.Completer<Result> completer, String password) {
    // Make sure we don't attempt to start lnd twice.
    // A better fix in the future would be to actually
    // use MSG_CHECKSTATUS in the future
    HandlerThread thread = new HandlerThread(HANDLERTHREAD_NAME) {
      @SuppressLint("HandlerLeak")
      @Override
      public void run() {
        incomingHandler = new Handler() {
          @Override
          public void handleMessage(Message msg) {
            // Hyperlog.d(TAG, "Handling new incoming message from LndMobileService, msg id: " + msg.what);
            // Hyperlog.v(TAG, msg.toString());
            Bundle bundle;

            try {
              switch (msg.what) {
                case LndMobileService.MSG_REGISTER_CLIENT_ACK: {
                  try {
                    if (!lndStarted) {
                      // Hyperlog.i(TAG, "Sending MSG_START_LND request");
                      startLnd();
                    } else {
                      // Just exit if we reach this scenario
                      // Hyperlog.w(TAG, "WARNING, Got MSG_REGISTER_CLIENT_ACK when lnd should already be started, quitting work.");
                      unbindLndMobileService();
                      completer.set(Result.success());
                      return;
                    }
                  } catch (Throwable t) {
                    t.printStackTrace();
                  }
                  break;
                }
                case LndMobileService.MSG_START_LND_RESULT: {
                  // TODO(hsjoberg): check for "lnd already started" error? (strictly not needed though)
                  lndStarted = true;
                  subscribeStateRequest();
                  break;
                }
                case LndMobileService.MSG_GRPC_STREAM_RESULT: {
                  bundle = msg.getData();
                  final byte[] response = bundle.getByteArray("response");
                  final String method = bundle.getString("method");

                  if (method.equals("SubscribeState")) {
                    try {
                      lnrpc.Stateservice.SubscribeStateResponse state = lnrpc.Stateservice.SubscribeStateResponse.parseFrom(response);
                      lnrpc.Stateservice.WalletState currentState = state.getState();
                      if (currentState == lnrpc.Stateservice.WalletState.LOCKED) {
                        // Hyperlog.i(TAG, "Got WalletState.LOCKED");
                        // Hyperlog.i(TAG, "SubscribeState reports wallet is locked. Sending UnlockWallet request");
                        unlockWalletRequest(password);
                      } else if (currentState == lnrpc.Stateservice.WalletState.UNLOCKED) {
                        // Hyperlog.i(TAG, "Got WalletState.UNLOCKED");
                        // Hyperlog.i(TAG, "Waiting for WalletState.RPC_ACTIVE");
                      } else if (currentState == lnrpc.Stateservice.WalletState.RPC_ACTIVE) {
                        // Hyperlog.i(TAG, "Got WalletState.RPC_ACTIVE");
                        // Hyperlog.i(TAG, "LndMobileService reports RPC server ready. Sending GetInfo request");
                        getInfoRequest();
                      } else if (currentState == lnrpc.Stateservice.WalletState.SERVER_ACTIVE) {
                        // Hyperlog.i(TAG, "Got WalletState.SERVER_ACTIVE");
                        // Hyperlog.i(TAG, "We do not care about that.");
                      } else  {
                        // Hyperlog.w(TAG, "SubscribeState got unknown state " + currentState);
                      }
                    } catch (Throwable t) {
                      t.printStackTrace();
                    }
                  } else {
                    // Hyperlog.w(TAG, "Warning: Got unknown MSG_GRPC_STREAM_RESULT for method: " + method);
                  }
                  break;
                }
                case LndMobileService.MSG_GRPC_COMMAND_RESULT: {
                  bundle = msg.getData();
                  final byte[] response = bundle.getByteArray("response");
                  final String method = bundle.getString("method");

                  if (method.equals("UnlockWallet")) {
                    // Hyperlog.i(TAG, "Got MSG_GRPC_COMMAND_RESULT for UnlockWallet. Waiting for SubscribeState to send event before doing anything");
                  } else if (method.equals("GetInfo")) {
                    try {
                      lnrpc.LightningOuterClass.GetInfoResponse res = lnrpc.LightningOuterClass.GetInfoResponse.parseFrom(response);
                      // Hyperlog.d(TAG, "GetInfo response");
                      // Hyperlog.v(TAG, "blockHash:     " + res.getBlockHash());
                      // Hyperlog.d(TAG, "blockHeight:   " + Integer.toString(res.getBlockHeight()));
                      // Hyperlog.i(TAG, "syncedToChain: " + Boolean.toString(res.getSyncedToChain()));
                      // Hyperlog.i(TAG, "syncedToGraph: " + Boolean.toString(res.getSyncedToGraph()));

                      if (res.getSyncedToChain() && res.getSyncedToGraph()) {
                        // Hyperlog.i(TAG, "Syncs are done, letting lnd work for 10s before quitting");
                        writeLastScheduledSyncToDb();

                        Handler handler = new Handler();
                        handler.postDelayed(new Runnable() {
                          public void run() {
                            stopWorker(true, completer);
                          }
                        }, 10000);
                      }
                      else {
                        if (++numGetInfoCalls == 20) {
                          // Hyperlog.e(TAG, "GetInfo was called " + numGetInfoCalls + " times and still no syncedToChain = true. shutting down worker.");
                          stopWorker(false, completer);
                        } else{
                          // Hyperlog.i(TAG, "Sleeping 10s then checking again");
                          Handler handler = new Handler();
                          handler.postDelayed(new Runnable() {
                            public void run() {
                              try {
                                getInfoRequest();
                              }
                              catch (Throwable t) {
                                // Hyperlog.e(TAG, "Job handler got an exception, shutting down worker.", t);
                                stopWorker(false, completer);
                              }
                            }
                          }, 10000);
                        }
                      }
                    } catch (Throwable t) {
                      t.printStackTrace();
                    }
                  }
                  else {
                    Log.w(TAG, "Got unexpected method in MSG_GRPC_COMMAND_RESULT from LndMobileService. " +
                              "Expected GetInfo or UnlockWallet, got " + method);
                  }
                  break;
                }
                default:
                  super.handleMessage(msg);
              }
            } catch (Throwable t) {
              // Hyperlog.e(TAG, "Job handler got an exception, shutting down worker.", t);
              stopWorker(false, completer);
            }
          }
        };

        messenger = new Messenger(incomingHandler); // me
        bindLndMobileService();
      }
    };
    // FIXME(hsjoberg):
    // Calling thread.start() causes fatal exception:
    // java.lang.RuntimeException: Can't create handler inside thread Thread[zeus_lndmobile_sync,5,main] that has not called Looper.prepare()
    // Calling run instead, this is really wrong through.
    // Maybe use AsyncTask instead?
    thread.run();
  }

  private void stopWorker(boolean success, CallbackToFutureAdapter.Completer<Result> completer) {
    // Hyperlog.i(TAG, "Job is done. Quitting");
    unbindLndMobileService();

    if (torStarted) {
//      if (!MainActivity.started) {
        // Hyperlog.i(TAG, "Stopping Tor");
         zeusTor.stopTor(new PromiseWrapper() {
           @Override
           void onSuccess(@Nullable Object value) {
             // Hyperlog.i(TAG,"Tor stopped");
           }

          @Override
          void onFail(Throwable throwable) {
            // Hyperlog.e(TAG, "Fail while stopping Tor", throwable);
          }
        });
//      } else {
//        // Hyperlog.w(TAG, "MainActivity was started when shutting down sync work. I will not stop Tor");
//      }
    }

    new Handler().postDelayed(new Runnable() {
      @Override
      public void run() {
        // Hyperlog.i(TAG, "Calling future.set(Result.success());");
        completer.set(success ? Result.success() : Result.failure());
      }
    }, 1500);
  }

  private boolean startTor(CallbackToFutureAdapter.Completer<Result> completer) {
    // Hyperlog.i(TAG, "Starting Tor");
    zeusTor.startTor(new PromiseWrapper() {
      @Override
      void onSuccess(@Nullable Object value) {
        // Hyperlog.i(TAG, "Tor started");
        // Hyperlog.i(TAG, "torSocksPort: " + (int) value);
        torStarted = true;
        torSocksPort = (int) value;
      }

      @Override
      void onFail(Throwable throwable) {
        // Hyperlog.e(TAG, "Failed to start Tor", throwable);
        zeusTor.stopTor(new PromiseWrapper() {
          @Override
          void onSuccess(@Nullable Object value) {}

          @Override
          void onFail(Throwable throwable) {}
        });
        completer.set(Result.failure());
      }
    });
    int torTries = 0;
    while (!torStarted) {
      if (torTries++ > 40) {
        // Hyperlog.e(TAG, "Couldn't start Tor.");
        completer.set(Result.failure());
        return false;
      }
      // Hyperlog.i(TAG, "Waiting for Tor to start");
      try {
        Thread.sleep(1500);
      } catch (InterruptedException e) {
        e.printStackTrace();
      }
    }
    return true;
  }

  private void startLnd() throws RemoteException {
    Message message = Message.obtain(null, LndMobileService.MSG_START_LND, 0, 0);
    message.replyTo = messenger;
    Bundle bundle = new Bundle();
    String params = "--lnddir=" + getApplicationContext().getFilesDir().getPath();
    if (torEnabled) {
      String controlSocket = "unix://" + getApplicationContext().getDir(TorService.class.getSimpleName(), Context.MODE_PRIVATE).getAbsolutePath() + "/data/ControlSocket";
      // Hyperlog.d(TAG, "Adding Tor params for starting lnd, torSocksPort: " + torSocksPort + ", controlSocket: " + controlSocket);
      params += " --tor.active --tor.socks=127.0.0.1:" + torSocksPort + " --tor.control=" + controlSocket;
      params += " --nolisten";
    }
    else {
      // If Tor isn't active, make sure we aren't
      // listening at all
      params += " --nolisten";
    }
    bundle.putString("args", params);
    message.setData(bundle);
    messengerService.send(message);
  }

  private void subscribeStateRequest() throws RemoteException {
    Message message = Message.obtain(null, LndMobileService.MSG_GRPC_STREAM_COMMAND, 0, 0);
    message.replyTo = messenger;
    Bundle bundle = new Bundle();
    bundle.putString("method", "SubscribeState");
    bundle.putByteArray("payload", lnrpc.Stateservice.SubscribeStateRequest.newBuilder().build().toByteArray());
    message.setData(bundle);
    messengerService.send(message);
  }

  private void unlockWalletRequest(String password) throws RemoteException {
    Message message = Message.obtain(null, LndMobileService.MSG_GRPC_COMMAND, 0, 0);
    message.replyTo = messenger;
    Bundle bundle = new Bundle();
    bundle.putString("method", "UnlockWallet");
    bundle.putByteArray("payload", lnrpc.Walletunlocker.UnlockWalletRequest.newBuilder().setWalletPassword(ByteString.copyFromUtf8(password)).build().toByteArray());
    message.setData(bundle);
    messengerService.send(message);
  }

  private void getInfoRequest() throws RemoteException {
    Message message = Message.obtain(null, LndMobileService.MSG_GRPC_COMMAND, 0, 0);
    message.replyTo = messenger;
    Bundle getinfoBundle = new Bundle();
    getinfoBundle.putString("method", "GetInfo");
    getinfoBundle.putByteArray("payload", lnrpc.LightningOuterClass.GetInfoRequest.newBuilder().build().toByteArray());
    message.setData(getinfoBundle);
    messengerService.send(message);
  }

  private void bindLndMobileService() {
    getApplicationContext().bindService(
      new Intent(getApplicationContext(), LndMobileService.class),
      serviceConnection,
      Context.BIND_AUTO_CREATE
    );
    lndMobileServiceBound = true;
  }

  private void unbindLndMobileService() {
    if (lndMobileServiceBound) {
      if (messengerService != null) {
        try {
          Message message = Message.obtain(null, LndMobileService.MSG_UNREGISTER_CLIENT);
          message.replyTo = messenger;
          messengerService.send(message);
        } catch (RemoteException e) {
          // Hyperlog.e(TAG, "Unable to send unbind request to LndMobileService", e);
        }
      }

      getApplicationContext().unbindService(serviceConnection);
      lndMobileServiceBound = false;
      // Hyperlog.i(TAG, "Unbinding LndMobileService");
    }
  }

  private boolean getPersistentServicesEnabled() {
    SQLiteDatabase db = dbSupplier.get();
    String persistentServicesEnabled = AsyncLocalStorageUtil.getItemImpl(db, "persistentServicesEnabled");
    if (persistentServicesEnabled != null) {
      return persistentServicesEnabled.equals("true");
    }
    // Hyperlog.w(TAG, "Could not find persistentServicesEnabled in asyncStorage");
    return false;
  }

  private boolean getTorEnabled() {
    SQLiteDatabase db = dbSupplier.get();
    String torEnabled = AsyncLocalStorageUtil.getItemImpl(db, "torEnabled");
    if (torEnabled != null) {
      return torEnabled.equals("true");
    }
    // Hyperlog.w(TAG, "Could not find torEnabled in asyncStorage");
    return false;
  }

  private void writeLastScheduledSyncAttemptToDb() {
    SQLiteDatabase db = dbSupplier.get();
    String key = "lastScheduledSyncAttempt";
    Long tsLong = System.currentTimeMillis() / 1000;
    String value = tsLong.toString();
    String sql = "INSERT OR REPLACE INTO catalystLocalStorage VALUES (?, ?);";
    SQLiteStatement statement = db.compileStatement(sql);
    try {
      db.beginTransaction();
      statement.clearBindings();
      statement.bindString(1, key);
      statement.bindString(2, value);
      statement.execute();
      db.setTransactionSuccessful();
    } catch (Exception e) {
      // Hyperlog.w(TAG, e.getMessage(), e);
    } finally {
      try {
        db.endTransaction();
      } catch (Exception e) {
        // Hyperlog.w(TAG, e.getMessage(), e);
      }
    }
  }

  private void writeLastScheduledSyncToDb() {
    SQLiteDatabase db = dbSupplier.get();
    String key = "lastScheduledSync";
    Long tsLong = System.currentTimeMillis() / 1000;
    String value = tsLong.toString();
    String sql = "INSERT OR REPLACE INTO catalystLocalStorage VALUES (?, ?);";
    SQLiteStatement statement = db.compileStatement(sql);
    try {
      db.beginTransaction();
      statement.clearBindings();
      statement.bindString(1, key);
      statement.bindString(2, value);
      statement.execute();
      db.setTransactionSuccessful();
    } catch (Exception e) {
      // Hyperlog.w(TAG, e.getMessage(), e);
    } finally {
      try {
        db.endTransaction();
      } catch (Exception e) {
        // Hyperlog.w(TAG, e.getMessage(), e);
      }
    }
  }

  private boolean checkLndProcessExists() {
    String packageName = getApplicationContext().getPackageName();
    ActivityManager am = (ActivityManager) getApplicationContext().getSystemService(Context.ACTIVITY_SERVICE);
    for (ActivityManager.RunningAppProcessInfo p : am.getRunningAppProcesses()) {
      // Hyperlog.d(TAG, "Process " + p.processName);
      if (p.processName.equals(packageName + ":zeusLndMobile")) {
        // Hyperlog.d(TAG, "Found " + packageName + ":zeusLndMobile pid: " + String.valueOf(p.pid));
        return true;
      }
    }
    return false;
  }

  private boolean killLndProcess() {
    String packageName = getApplicationContext().getPackageName();
    ActivityManager am = (ActivityManager) getApplicationContext().getSystemService(Context.ACTIVITY_SERVICE);
    for (ActivityManager.RunningAppProcessInfo p : am.getRunningAppProcesses()) {
      if (p.processName.equals(packageName + ":zeusLndMobile")) {
        // Hyperlog.i(TAG, "Killing " + packageName + ":zeusLndMobile with pid: " + String.valueOf(p.pid));
        Process.killProcess(p.pid);
        return true;
      }
    }
    return false;
  }

  private ServiceConnection serviceConnection = new ServiceConnection() {
    @Override
    public void onServiceConnected(ComponentName name, IBinder service) {
        lndMobileServiceBound = true;
        messengerService = new Messenger(service);

        try {
            Message msg = Message.obtain(null,
                    LndMobileService.MSG_REGISTER_CLIENT);
            msg.replyTo = messenger;
            messengerService.send(msg);
        } catch (RemoteException e) {
          // Hyperlog.e(TAG, "Unable to send MSG_REGISTER_CLIENT to LndMobileService", e);
        }
    }

    @Override
    public void onServiceDisconnected(ComponentName className) {
      messengerService = null;
      lndMobileServiceBound = false;
    }
  };
}
