package app.zeusln.zeus;

import android.annotation.SuppressLint;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Message;
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

import com.facebook.react.modules.storage.ReactDatabaseSupplier;
import com.facebook.react.modules.storage.AsyncLocalStorageUtil;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.ReadableMap;

import com.oblador.keychain.KeychainModule;
import com.google.protobuf.ByteString;
import com.hypertrack.hyperlog.HyperLog;

import org.brotli.dec.BrotliInputStream;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.URL;
import java.net.HttpURLConnection;
import java.util.zip.GZIPInputStream;

public class GossipFileScheduledSyncWorker extends ListenableWorker {
  private final String TAG = "GossipFileScheduledSyncWorker";
  private ReactDatabaseSupplier dbSupplier;
  private boolean persistentServicesEnabled = false;

  public GossipFileScheduledSyncWorker(@NonNull Context context, @NonNull WorkerParameters workerParams) {
    super(context, workerParams);
    dbSupplier = ReactDatabaseSupplier.getInstance(getApplicationContext());
  }

  @Override
  public ListenableFuture<Result> startWork() {
    persistentServicesEnabled = getPersistentServicesEnabled();

    return CallbackToFutureAdapter.getFuture(completer -> {
      HyperLog.i(TAG, "------------------------------------");
      HyperLog.i(TAG, "Starting scheduled sync work");
      HyperLog.i(TAG, "I am " + getApplicationContext().getPackageName());
      writeLastScheduledSyncAttemptToDb();

      if (persistentServicesEnabled) {
        HyperLog.i(TAG, "persistentServicesEnabled = " + persistentServicesEnabled + ", quitting job");
        completer.set(Result.success());
        return null;
      }
      HyperLog.i(TAG, "Starting gossip file download");
      startGossipWorkThread(completer);
      return null;
    });
  }

  private void startGossipWorkThread(CallbackToFutureAdapter.Completer<Result> completer) {
    Thread thread = new Thread(new Runnable() {
      @Override
      public void run() {
        HyperLog.i(TAG, "Handling periodic gossip file download");
        try {
          URL url = new URL("https://maps.eldamar.icu/mainnet/graph/graph-001d.db");
          File dgraph = new File(getApplicationContext().getCacheDir().getAbsolutePath() + "/dgraph");
          dgraph.mkdirs();
          FileOutputStream out = new FileOutputStream(new File(getApplicationContext().getCacheDir().getAbsolutePath() + "/dgraph/channel.db"));
          HttpURLConnection con = (HttpURLConnection) url.openConnection();
          con.setRequestProperty("Accept-Encoding", "br, gzip");
          InputStream stream = null;
          if ("gzip".equals(con.getContentEncoding())) {
            stream = new GZIPInputStream(con.getInputStream());
          } else if ("br".equals(con.getContentEncoding())) {
            stream = new BrotliInputStream(con.getInputStream());
          } else {
            stream = con.getInputStream();
          }
          out.write(stream.readAllBytes());
          out.close();
          stream.close();
        } catch (Throwable e) {
          Log.e(TAG, e.getMessage());
          HyperLog.e(TAG, e.getMessage());
          completer.set(Result.failure());
          return;
        }
        HyperLog.i(TAG, "Periodic gossip file download finished");
        completer.set(Result.success());
        writeLastScheduledSyncToDb();
      }
    });
    thread.start();
  }

  private boolean getPersistentServicesEnabled() {
    SQLiteDatabase db = dbSupplier.get();
    String persistentServicesEnabled = AsyncLocalStorageUtil.getItemImpl(db, "persistentServicesEnabled");
    if (persistentServicesEnabled != null) {
      return persistentServicesEnabled.equals("true");
    }
    HyperLog.w(TAG, "Could not find persistentServicesEnabled in asyncStorage");
    return false;
  }

  private void writeLastScheduledSyncAttemptToDb() {
    SQLiteDatabase db = dbSupplier.get();
    String key = "lastScheduledGossipSyncAttempt";
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
      HyperLog.w(TAG, e.getMessage(), e);
    } finally {
      try {
        db.endTransaction();
      } catch (Exception e) {
        HyperLog.w(TAG, e.getMessage(), e);
      }
    }
  }

  private void writeLastScheduledSyncToDb() {
    SQLiteDatabase db = dbSupplier.get();
    String key = "lastScheduledGossipSync";
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
      HyperLog.w(TAG, e.getMessage(), e);
    } finally {
      try {
        db.endTransaction();
      } catch (Exception e) {
        HyperLog.w(TAG, e.getMessage(), e);
      }
    }
  }
}
