package app.zeusln.zeus;

import android.util.Log;
import android.content.ComponentName;
import android.content.Context;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteStatement;

import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.PeriodicWorkRequest;
import androidx.work.NetworkType;
import androidx.work.WorkInfo;
import androidx.work.WorkManager;
import androidx.lifecycle.Observer;
import androidx.annotation.Nullable;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;
import com.facebook.react.modules.storage.ReactDatabaseSupplier;
import com.facebook.react.modules.storage.AsyncLocalStorageUtil;

import com.google.common.util.concurrent.ListenableFuture;
import java.util.List;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;

import com.hypertrack.hyperlog.HyperLog;

class LndMobileScheduledSync extends ReactContextBaseJavaModule {
  private final String TAG = "LndMobileScheduledSync";
  private final String LND_SCHEDULED_SYNC_WORK_NAME = "LND_SCHEDULED_SYNC_WORK";
  private WorkManager workManager;
  private PeriodicWorkRequest periodicWorkRequest;

  public LndMobileScheduledSync(ReactApplicationContext reactContext) {
    super(reactContext);

    workManager = WorkManager.getInstance(getReactApplicationContext());
    periodicWorkRequest = BuildConfig.DEBUG
      ? new PeriodicWorkRequest.Builder(LndMobileScheduledSyncWorker.class, 15, TimeUnit.MINUTES)
          .setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
          .build()
      : new PeriodicWorkRequest.Builder(LndMobileScheduledSyncWorker.class, 2, TimeUnit.HOURS)
          .setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
          .build();
  }

  @Override
  public String getName() {
    return "LndMobileScheduledSync";
  }

  @ReactMethod
  public void setupScheduledSyncWork(Promise promise) {
    workManager.enqueueUniquePeriodicWork(LND_SCHEDULED_SYNC_WORK_NAME, ExistingPeriodicWorkPolicy.REPLACE, periodicWorkRequest);
    promise.resolve(true);
  }

  @ReactMethod
  public void removeScheduledSyncWork(Promise promise) {
    workManager.cancelUniqueWork(LND_SCHEDULED_SYNC_WORK_NAME);
    promise.resolve(true);
  }

  @ReactMethod
  public void checkScheduledSyncWorkStatus(Promise promise) {
    try {
      HyperLog.d(TAG, "Checking unique periodic work");

      ListenableFuture<List<WorkInfo>> future = workManager.getWorkInfosForUniqueWork(LND_SCHEDULED_SYNC_WORK_NAME);
      List<WorkInfo> workInfoList = future.get();
      if (workInfoList.size() == 0) {
        promise.resolve("WORK_NOT_EXIST");
      }
      else if (workInfoList.size() > 1) {
        HyperLog.w(TAG, "Found more than 1 work");
      }

      for (WorkInfo workInfo : workInfoList) {
        WorkInfo.State state = workInfo.getState();
        promise.resolve(state.toString());
        return;
      }
    } catch (Throwable e) {
      HyperLog.e(TAG, "Could not create periodic work", e);
      promise.reject("Could not create periodic work", e);
    }
  }
}
