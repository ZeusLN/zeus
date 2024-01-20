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
import com.facebook.react.modules.permissions.PermissionsModule;

import com.jakewharton.processphoenix.ProcessPhoenix;
import com.oblador.keychain.KeychainModule;

// import org.torproject.jni.TorService;
import com.reactnativecommunity.asyncstorage.ReactDatabaseSupplier;
import com.reactnativecommunity.asyncstorage.AsyncLocalStorageUtil;

// TODO break this class up
class LndMobileTools extends ReactContextBaseJavaModule {
  final String TAG = "LndMobileTools";

  public LndMobileTools(ReactApplicationContext reactContext) {
    super(reactContext);
  }

  private boolean getPersistentServicesEnabled(Context context) {
    ReactDatabaseSupplier dbSupplier = ReactDatabaseSupplier.getInstance(context);
    SQLiteDatabase db = dbSupplier.get();
    String persistentServicesEnabled = AsyncLocalStorageUtil.getItemImpl(db, "persistentServicesEnabled");
    if (persistentServicesEnabled != null) {
      return persistentServicesEnabled.equals("true");
    }
    // Hyperlog.w(TAG, "Could not find persistentServicesEnabled in asyncStorage");
    return false;
  }

  @Override
  public String getName() {
    return "LndMobileTools";
  }

  @ReactMethod
  void writeConfig(String config, Promise promise) {
    String filename = getReactApplicationContext().getFilesDir().toString() + "/lnd.conf";

    try {
      new File(filename).getParentFile().mkdirs();
      PrintWriter out = new PrintWriter(filename);
      out.println(config);
      out.close();
    } catch (Exception e) {
      promise.reject("Couldn't write: " + filename, e);
      return;
    }
    promise.resolve("File written: " + filename);
  }

  @ReactMethod
  public void killLnd(Promise promise) {
    boolean result = killLndProcess();
    promise.resolve(result);
  }

  private boolean killLndProcess() {
    String packageName = getReactApplicationContext().getPackageName();
    ActivityManager am = (ActivityManager) getCurrentActivity().getSystemService(Context.ACTIVITY_SERVICE);
    for (ActivityManager.RunningAppProcessInfo p : am.getRunningAppProcesses()) {
      if (p.processName.equals(packageName + ":zeusLndMobile")) {
        Process.killProcess(p.pid);
        return true;
      }
    }
    return false;
  }

  @ReactMethod
  public void copyLndLog(String network, Promise promise) {
    Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
    intent.addCategory(Intent.CATEGORY_OPENABLE);
    intent.setType("text/plain");
    intent.putExtra(Intent.EXTRA_TITLE, "lnd.log");
    if (network == "testnet") {
      getReactApplicationContext().getCurrentActivity().startActivityForResult(intent, MainActivity.INTENT_COPYLNDLOGTESTNET);
    } else {
      getReactApplicationContext().getCurrentActivity().startActivityForResult(intent, MainActivity.INTENT_COPYLNDLOG);
    }
    promise.resolve(true);
  }

  @ReactMethod
  public void tailLog(Integer numberOfLines, String network, Promise promise) {
    File file = new File(
      getReactApplicationContext().getFilesDir().toString() +
      "/logs/bitcoin/" +
      network +
      "/lnd.log"
    );

    java.io.RandomAccessFile fileHandler = null;
    try {
      fileHandler = new java.io.RandomAccessFile(file, "r");
      long fileLength = fileHandler.length() - 1;
      StringBuilder sb = new StringBuilder();
      int line = 0;

      for(long filePointer = fileLength; filePointer != -1; filePointer--){
        fileHandler.seek( filePointer );
        int readByte = fileHandler.readByte();

        if (readByte == 0xA) {
          if (filePointer < fileLength) {
            line = line + 1;
          }
        } else if (readByte == 0xD) {
          if (filePointer < fileLength-1) {
              line = line + 1;
          }
        }
        if (line >= numberOfLines) {
          break;
        }
        sb.append((char) readByte);
      }

      String lastLine = sb.reverse().toString();
      promise.resolve(lastLine);
    } catch (java.io.FileNotFoundException e) {
      e.printStackTrace();
      promise.reject(e);
    } catch (java.io.IOException e) {
      e.printStackTrace();
      promise.reject(e);
    }
    finally {
      if (fileHandler != null) {
        try {
          fileHandler.close();
        } catch (java.io.IOException e) {}
      }
    }
  }

  private FileObserver logObserver;

  @ReactMethod
  public void observeLndLogFile(String network, Promise p) {
    if (logObserver != null) {
      p.resolve(true);
      return;
    }

    File appDir = getReactApplicationContext().getFilesDir();

    final String logDir = appDir + "/logs/bitcoin/" + network;
    final String logFile = logDir + "/lnd.log";

    FileInputStream stream = null;
    while (true) {
      try {
        stream = new FileInputStream(logFile);
      } catch (FileNotFoundException e) {
        File dir = new File(logDir);
        dir.mkdirs();
        File f = new File(logFile);
        try {
          f.createNewFile();
          continue;
        } catch (IOException e1) {
          e1.printStackTrace();
          return;
        }
      }
      break;
    }

    final InputStreamReader istream = new InputStreamReader(stream);
    final BufferedReader buf = new BufferedReader(istream);
    try {
      readToEnd(buf, false);
    } catch (IOException e) {
      e.printStackTrace();
      return;
    }

    logObserver = new FileObserver(logFile) {
      @Override
      public void onEvent(int event, String file) {
        if(event != FileObserver.MODIFY) {
          return;
        }
        try {
          readToEnd(buf, true);
        } catch (IOException e) {
          e.printStackTrace();
        }
      }
    };
    logObserver.startWatching();
    Log.i(TAG, "Started watching " + logFile);
    p.resolve(true);
  }

  private void readToEnd(BufferedReader buf, boolean emit) throws IOException {
    String s = "";
    while ( (s = buf.readLine()) != null ) {
      if (!emit) {
        continue;
      }
      getReactApplicationContext()
              .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
              .emit("lndlog", s);
    }
  }

  @ReactMethod
  public void saveChannelsBackup(String base64Backups, Promise promise) {
    MainActivity.tmpChanBackup = Base64.decode(base64Backups, Base64.NO_WRAP);
    SimpleDateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd_HH-mm-ss");

    Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
    intent.addCategory(Intent.CATEGORY_OPENABLE);
    intent.setType("text/plain");
    intent.putExtra(Intent.EXTRA_TITLE, "zeus-channels-backup-" + dateFormat.format(new Date()) + ".bin");
    getReactApplicationContext().getCurrentActivity().startActivityForResult(intent, MainActivity.INTENT_EXPORTCHANBACKUP);
    promise.resolve(true);
  }

  @ReactMethod
  public void saveChannelBackupFile(String network, Promise promise) {
    SimpleDateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd_HH-mm-ss");

    Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
    intent.addCategory(Intent.CATEGORY_OPENABLE);
    intent.setType("text/plain");
    intent.putExtra(Intent.EXTRA_TITLE, "zeus-channels-backup-" + dateFormat.format(new Date()) + ".bin");
    if (network == "testnet") {
      getReactApplicationContext().getCurrentActivity().startActivityForResult(intent, MainActivity.INTENT_EXPORTCHANBACKUPFILETESTNET);
    } else {
      getReactApplicationContext().getCurrentActivity().startActivityForResult(intent, MainActivity.INTENT_EXPORTCHANBACKUPFILE);
    }
    promise.resolve(true);
  }

  @ReactMethod
  public void DEBUG_getWalletPasswordFromKeychain(Promise promise) {
    KeychainModule keychain = new KeychainModule(getReactApplicationContext());

    WritableMap keychainOptions = Arguments.createMap();
    WritableMap keychainOptionsAuthenticationPrompt = Arguments.createMap();
    keychainOptionsAuthenticationPrompt.putString("title", "Authenticate to retrieve secret");
    keychainOptionsAuthenticationPrompt.putString("cancel", "Cancel");
    keychainOptions.putMap("authenticationPrompt", keychainOptionsAuthenticationPrompt);

    keychain.getInternetCredentialsForServer("password", keychainOptions, new PromiseWrapper() {
      @Override
      public void onSuccess(@Nullable Object value) {
        if (value != null) {
          promise.resolve(((ReadableMap) value).getString("password"));
          return;
        }
        promise.reject("fail2");
      }

      @Override
      public void onFail(Throwable throwable) {
        Log.d(TAG, "error", throwable);
        promise.reject(throwable.getMessage());
      }
    });
  }

  @ReactMethod
  public void getIntentStringData(Promise promise) {
    String sharedText = getReactApplicationContext()
      .getCurrentActivity().getIntent().getStringExtra(Intent.EXTRA_TEXT);

    if (sharedText != null) {
      Log.d(TAG, sharedText);
      promise.resolve(sharedText);
    }
    else {
      Log.d(TAG, "sharedText null");
      promise.resolve(null);
    }
  }

  @ReactMethod
  public void getIntentNfcData(Promise promise) {
    // https://code.tutsplus.com/tutorials/reading-nfc-tags-with-android--mobile-17278
    Tag tag = getReactApplicationContext()
      .getCurrentActivity().getIntent().getParcelableExtra(NfcAdapter.EXTRA_TAG);
    if (tag == null) {
      promise.resolve(null);
      return;
    }

    Ndef ndef = Ndef.get(tag);
    if (ndef == null) {
      promise.resolve(null);
    }

    NdefMessage ndefMessage = ndef.getCachedNdefMessage();

    NdefRecord[] records = ndefMessage.getRecords();
    if (records.length > 0) {
      // Get first record and ignore the rest
      NdefRecord record = records[0];
      if (record.getTnf() == NdefRecord.TNF_WELL_KNOWN && Arrays.equals(record.getType(), NdefRecord.RTD_TEXT)) {
        /*
         * See NFC forum specification for "Text Record Type Definition" at 3.2.1
         *
         * http://www.nfc-forum.org/specs/
         *
         * bit_7 defines encoding
         * bit_6 reserved for future use, must be 0
         * bit_5..0 length of IANA language code
        */
        byte[] payload = record.getPayload();

        // Get the Text Encoding
        String textEncoding = ((payload[0] & 128) == 0) ? "UTF-8" : "UTF-16";

        // Get the Language Code
        int languageCodeLength = payload[0] & 0063;

        // String languageCode = new String(payload, 1, languageCodeLength, "US-ASCII");
        // e.g. "en"

        try {
          String s = new String(payload, languageCodeLength + 1, payload.length - languageCodeLength - 1, textEncoding);
          promise.resolve(s);
          return;
        } catch (UnsupportedEncodingException e) {
          // ignore
        }
      }
    }
    promise.resolve(null);
  }

  @ReactMethod
  public void DEBUG_deleteWallet(String network, Promise promise) {
    String filename = getReactApplicationContext().getFilesDir().toString() + "/data/chain/bitcoin/" + network + "/wallet.db";
    File file = new File(filename);
    promise.resolve(file.delete());
  }

  @ReactMethod
  public void DEBUG_deleteDatafolder(Promise promise) {
    String filename = getReactApplicationContext().getFilesDir().toString() + "/data/";
    File file = new File(filename);
    deleteRecursive(file);
    promise.resolve(null);
  }

  void deleteRecursive(File fileOrDirectory) {
    if (fileOrDirectory.isDirectory()) {
      for (File child : fileOrDirectory.listFiles()) {
        deleteRecursive(child);
      }
    }
  }

  @ReactMethod
  public void DEBUG_deleteSpeedloaderLastrunFile(Promise promise) {
    String filename = getReactApplicationContext().getCacheDir().toString() + "/lastrun";
    File file = new File(filename);
    promise.resolve(file.delete());
  }

  @ReactMethod
  public void DEBUG_deleteSpeedloaderDgraphDirectory(Promise promise) {
    String filename = getReactApplicationContext().getCacheDir().toString() + "/dgraph";
    File file = new File(filename);
    deleteRecursive(file);
    promise.resolve(null);
  }

  @ReactMethod
  public void DEBUG_deleteNeutrinoFiles(String network, Promise promise) {
    String chainFolder = getReactApplicationContext().getFilesDir().toString() + "/data/chain/bitcoin/" + network;

    String neutrinoDb = chainFolder + "/neutrino.db";
    String blockHeadersBin = chainFolder + "/block_headers.bin";
    String regHeadersBin = chainFolder + "/reg_filter_headers.bin";
    File neutrinoDbFile = new File(neutrinoDb);
    File blockHeadersBinFile = new File(blockHeadersBin);
    File regHeadersBinFiles = new File(regHeadersBin);
    promise.resolve(neutrinoDbFile.delete() && blockHeadersBinFile.delete() && regHeadersBinFiles.delete());
  }

  @ReactMethod
  public void DEBUG_listProcesses(Promise promise) {
    String processes = "";

    String packageName = getReactApplicationContext().getPackageName();
    ActivityManager am = (ActivityManager) getCurrentActivity().getSystemService(Context.ACTIVITY_SERVICE);
    for (ActivityManager.RunningAppProcessInfo p : am.getRunningAppProcesses()) {
      processes += p.processName + "\n";
    }

    promise.resolve(processes);
  }

  @ReactMethod
  public void checkLndProcessExist(Promise promise) {
    String packageName = getReactApplicationContext().getPackageName();
    ActivityManager am = (ActivityManager) getReactApplicationContext().getSystemService(Context.ACTIVITY_SERVICE);
    for (ActivityManager.RunningAppProcessInfo p : am.getRunningAppProcesses()) {
      if (p.processName.equals(packageName + ":zeusLndMobile")) {
        promise.resolve(true);
        return;
      }
    }
    promise.resolve(false);
  }

  @ReactMethod
  public void deleteTLSCerts(Promise promise) {
    String tlsKeyFilename = getReactApplicationContext().getFilesDir().toString() + "/tls.key";
    File tlsKeyFile = new File(tlsKeyFilename);
    boolean tlsKeyFileDeletion = tlsKeyFile.delete();

    String tlsCertFilename = getReactApplicationContext().getFilesDir().toString() + "/tls.cert";
    File tlsCertFile = new File(tlsCertFilename);
    boolean tlsCertFileDeletion = tlsCertFile.delete();

    promise.resolve(tlsKeyFileDeletion && tlsCertFileDeletion);
  }

  @ReactMethod
  public void restartApp() {
    // Intent stopTorIntent = new Intent(getReactApplicationContext(), TorService.class);
    // stopTorIntent.setAction("org.torproject.android.intent.action.STOP");
    // getReactApplicationContext().stopService(stopTorIntent);
    Intent stopLndIntent = new Intent(getReactApplicationContext(), LndMobileService.class);
    stopLndIntent.setAction("app.zeusln.zeus.android.intent.action.STOP");
    getReactApplicationContext().startService(stopLndIntent);
    ProcessPhoenix.triggerRebirth(getReactApplicationContext());
  }

  private void checkWriteExternalStoragePermission(@NonNull RequestWriteExternalStoragePermissionCallback successCallback,
                                                   @NonNull Runnable failCallback,
                                                   @NonNull Runnable failPermissionCheckcallback) {
    PermissionsModule permissions = new PermissionsModule(getReactApplicationContext());

    PromiseWrapper requestPromiseWrapper = new PromiseWrapper() {
      @Override
      public void onSuccess(@Nullable Object value) {
        successCallback.success(value);
      }

      @Override
      public void onFail(Throwable throwable) {
        failCallback.run();
      }
    };

    PromiseWrapper checkPromiseWrapper = new PromiseWrapper() {
      @Override
      void onSuccess(@Nullable Object value) {
        permissions.requestPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE, requestPromiseWrapper);
      }

      @Override
      void onFail(Throwable throwable) {
        failPermissionCheckcallback.run();
      }
    };

    permissions.checkPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE, checkPromiseWrapper);
  }

  private interface RequestWriteExternalStoragePermissionCallback {
    void success(@Nullable Object value);
  }
}
