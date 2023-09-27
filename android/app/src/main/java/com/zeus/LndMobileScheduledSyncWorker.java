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

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.concurrent.futures.ResolvableFuture;
import androidx.work.ListenableWorker;
import androidx.work.WorkerParameters;

import com.google.common.util.concurrent.ListenableFuture;
import com.google.protobuf.ByteString;

import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteStatement;

import com.facebook.react.bridge.ReactApplicationContext;
import com.reactnativecommunity.asyncstorage.ReactDatabaseSupplier;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.ReadableMap;

import com.oblador.keychain.KeychainModule;

public class LndMobileScheduledSyncWorker extends ListenableWorker {
  private final String TAG = "LndScheduledSyncWorker";
  private final String HANDLERTHREAD_NAME = "zeus_lndmobile_sync";
  private ResolvableFuture future = ResolvableFuture.create();
  private Handler incomingHandler;
  private boolean lndMobileServiceBound = false;
  private Messenger messengerService; // The service
  private Messenger messenger; // Me
  private ReactDatabaseSupplier dbSupplier;
  private boolean lndStarted = false;
  // Keeps track of how many times we've tried to get info
  // If this keeps going without `syncedToChain` flipping to `true`
  // we'll close down lnd and the worker
  private int numGetInfoCalls = 0;

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
  }

  @Override
  public ListenableFuture<Result> startWork() {
    writeLastScheduledSyncAttemptToDb();

    if (MainActivity.started) {
      future.set(Result.success());
      return future;
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
        if (value == null) {
          future.set(Result.failure());
          return;
        }
        else {
          final String password = ((ReadableMap) value).getString("password");
          startLndWorkThread(future, password);
        }
      }

      @Override
      public void onFail(Throwable throwable) {
        future.set(Result.failure());
      }
    });

    return future;
  }

  private void startLndWorkThread(ResolvableFuture future, String password) {
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
            Bundle bundle;

            try {
              switch (msg.what) {
                case LndMobileService.MSG_REGISTER_CLIENT_ACK: {
                  try {
                    if (!lndStarted) {
                      startLnd();
                    } else {
                      // Just exit if we reach this scenario
                      unbindLndMobileService();
                      future.set(Result.success());
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
                        unlockWalletRequest(password);
                      } else if (currentState == lnrpc.Stateservice.WalletState.RPC_ACTIVE) {
                        getInfoRequest();
                      }
                    } catch (Throwable t) {
                      t.printStackTrace();
                    }
                  }
                  break;
                }
                case LndMobileService.MSG_GRPC_COMMAND_RESULT: {
                  bundle = msg.getData();
                  final byte[] response = bundle.getByteArray("response");
                  final String method = bundle.getString("method");

                  if (method.equals("GetInfo")) {
                    try {
                      lnrpc.LightningOuterClass.GetInfoResponse res = lnrpc.LightningOuterClass.GetInfoResponse.parseFrom(response);

                      if (res.getSyncedToChain() && res.getSyncedToGraph()) {
                        writeLastScheduledSyncToDb();

                        Handler handler = new Handler();
                        handler.postDelayed(new Runnable() {
                          public void run() {
                            stopWorker(true);
                          }
                        }, 10000);
                      }
                      else {
                        if (++numGetInfoCalls == 20) {
                          stopWorker(false);
                        } else{
                          Handler handler = new Handler();
                          handler.postDelayed(new Runnable() {
                            public void run() {
                              try {
                                getInfoRequest();
                              }
                              catch (Throwable t) {
                                stopWorker(false);
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
              stopWorker(false);
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

  private void stopWorker(boolean success) {
    unbindLndMobileService();

    new Handler().postDelayed(new Runnable() {
      @Override
      public void run() {
        future.set(success ? Result.success() : Result.failure());
      }
    }, 1500);
  }

  private void startLnd() throws RemoteException {
    Message message = Message.obtain(null, LndMobileService.MSG_START_LND, 0, 0);
    message.replyTo = messenger;
    Bundle bundle = new Bundle();
    String params = "--lnddir=" + getApplicationContext().getFilesDir().getPath();
    params += " --nolisten";
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
          // ignore
        }
      }

      getApplicationContext().unbindService(serviceConnection);
      lndMobileServiceBound = false;
    }
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
      // ignore
    } finally {
      try {
        db.endTransaction();
      } catch (Exception e) {
        // ignore
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
      // ignore
    } finally {
      try {
        db.endTransaction();
      } catch (Exception e) {
        // ignore
      }
    }
  }

  private boolean checkLndProcessExists() {
    String packageName = getApplicationContext().getPackageName();
    ActivityManager am = (ActivityManager) getApplicationContext().getSystemService(Context.ACTIVITY_SERVICE);
    for (ActivityManager.RunningAppProcessInfo p : am.getRunningAppProcesses()) {
      if (p.processName.equals(packageName + ":blixtLndMobile")) {
        return true;
      }
    }
    return false;
  }

  private boolean killLndProcess() {
    String packageName = getApplicationContext().getPackageName();
    ActivityManager am = (ActivityManager) getApplicationContext().getSystemService(Context.ACTIVITY_SERVICE);
    for (ActivityManager.RunningAppProcessInfo p : am.getRunningAppProcesses()) {
      if (p.processName.equals(packageName + ":blixtLndMobile")) {
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
        Message msg = Message.obtain(null, LndMobileService.MSG_REGISTER_CLIENT);
        msg.replyTo = messenger;
        messengerService.send(msg);
      } catch (RemoteException e) {
        // ignore
      }
    }

    @Override
    public void onServiceDisconnected(ComponentName className) {
      messengerService = null;
      lndMobileServiceBound = false;
    }
  };
}
