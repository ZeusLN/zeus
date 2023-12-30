package app.zeusln.zeus;

import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.PeriodicWorkRequest;
import androidx.work.NetworkType;
import androidx.work.WorkInfo;
import androidx.work.WorkManager;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;

import com.google.common.util.concurrent.ListenableFuture;
import java.util.List;
import java.util.concurrent.TimeUnit;

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
      ListenableFuture<List<WorkInfo>> future = workManager.getWorkInfosForUniqueWork(LND_SCHEDULED_SYNC_WORK_NAME);
      List<WorkInfo> workInfoList = future.get();
      if (workInfoList.size() == 0) {
        promise.resolve("WORK_NOT_EXIST");
      }

      for (WorkInfo workInfo : workInfoList) {
        WorkInfo.State state = workInfo.getState();
        promise.resolve(state.toString());
        return;
      }
    } catch (Throwable e) {
      promise.reject("Could not create periodic work", e);
    }
  }
}
