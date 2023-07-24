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

import com.hypertrack.hyperlog.HyperLog;

class GossipFileScheduledSync extends ReactContextBaseJavaModule {
  private final String TAG = "GossipFileScheduledSync";
  private final String GOSSIP_FILE_SCHEDULED_SYNC_WORK_NAME = "GOSSIP_FILE_SCHEDULED_SYNC_WORK";
  private WorkManager workManager;
  private PeriodicWorkRequest periodicWorkRequest;

  public GossipFileScheduledSync(ReactApplicationContext reactContext) {
    super(reactContext);

    workManager = WorkManager.getInstance(getReactApplicationContext());
    periodicWorkRequest = BuildConfig.DEBUG
      ? new PeriodicWorkRequest.Builder(GossipFileScheduledSyncWorker.class, 15, TimeUnit.MINUTES)
          .setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.UNMETERED).build())
          .build()
      : new PeriodicWorkRequest.Builder(GossipFileScheduledSyncWorker.class, 1, TimeUnit.DAYS)
          .setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.UNMETERED).build())
          .build();
  }

  @Override
  public String getName() {
    return "GossipFileScheduledSync";
  }

  @ReactMethod
  public void setupScheduledSyncWork(Promise promise) {
    workManager.enqueueUniquePeriodicWork(GOSSIP_FILE_SCHEDULED_SYNC_WORK_NAME, ExistingPeriodicWorkPolicy.REPLACE, periodicWorkRequest);
    promise.resolve(true);
  }

  @ReactMethod
  public void removeScheduledSyncWork(Promise promise) {
    workManager.cancelUniqueWork(GOSSIP_FILE_SCHEDULED_SYNC_WORK_NAME);
    promise.resolve(true);
  }

  @ReactMethod
  public void checkScheduledSyncWorkStatus(Promise promise) {
    try {
      HyperLog.d(TAG, "Checking unique periodic work");

      ListenableFuture<List<WorkInfo>> future = workManager.getWorkInfosForUniqueWork(GOSSIP_FILE_SCHEDULED_SYNC_WORK_NAME);
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
