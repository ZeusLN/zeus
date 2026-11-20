package app.zeusln.zeus;

import android.app.Activity;
import android.nfc.Tag;
import android.nfc.NfcAdapter;
import android.nfc.NdefMessage;
import android.nfc.tech.Ndef;
import android.nfc.NdefRecord;
import android.content.Intent;
import android.net.Uri;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;
import android.os.Build;
import android.os.Parcelable;
import android.os.PowerManager;
import android.provider.Settings;

import java.util.Arrays;
import java.io.UnsupportedEncodingException;
import java.io.InputStream;
import java.io.FilterInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;

class MobileTools extends ReactContextBaseJavaModule {
  final String TAG = "MobileTools";

  // A shared image is read from the app that shared it, which can take as
  // long as it likes to serve it. The read runs on its own thread, so the
  // native modules thread (which also runs every keychain call) stays free,
  // and the promise settles after SHARED_IMAGE_TIMEOUT_MS at the latest.
  static final long SHARED_IMAGE_TIMEOUT_MS = 5000;
  static final long SHARED_IMAGE_MAX_BYTES = 32L * 1024 * 1024;
  private static final ExecutorService sharedImageReaders =
      Executors.newCachedThreadPool();
  private static final ScheduledExecutorService sharedImageDeadlines =
      Executors.newSingleThreadScheduledExecutor();
  // The shares (by intent) whose reader thread is still running. A share
  // that timed out stays on the activity and is taken again on every resume,
  // and a reader parked in a provider that never returns would be joined by
  // another one each time. While a share's reader runs, a take of the same
  // share finds nothing, so each share has at most one reader, and two takes
  // cannot both deliver its image.
  private static final Set<Intent> sharedImageReads =
      ConcurrentHashMap.newKeySet();

  public MobileTools(ReactApplicationContext reactContext) {
    super(reactContext);
  }

  @Override
  public String getName() {
    return "MobileTools";
  }

  @ReactMethod
  public void getIntentNfcData(Promise promise) {
    // https://code.tutsplus.com/tutorials/reading-nfc-tags-with-android--mobile-17278
    // Read and clear the same intent: MainActivity.onNewIntent can replace
    // the activity's intent on the UI thread while this runs, and a second
    // getIntent() could clear a newer tag than the one read here.
    Activity activity = getReactApplicationContext().getCurrentActivity();
    if (activity == null) {
      promise.resolve(null);
      return;
    }
    Intent intent = activity.getIntent();
    if (intent == null) {
      promise.resolve(null);
      return;
    }

    // MainActivity is exported, so any local app can start it with any
    // Parcelable under EXTRA_TAG. Check the type instead of casting, and
    // treat an extra that cannot be unparcelled (BadParcelableException,
    // e.g. a class this app does not have) as no tag.
    Tag tag = null;
    try {
      if (!intent.hasExtra(NfcAdapter.EXTRA_TAG)) {
        promise.resolve(null);
        return;
      }
      Parcelable extra;
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        extra = intent.getParcelableExtra(NfcAdapter.EXTRA_TAG, Tag.class);
      } else {
        extra = intent.getParcelableExtra(NfcAdapter.EXTRA_TAG);
      }
      if (extra instanceof Tag) {
        tag = (Tag) extra;
      }
    } catch (RuntimeException e) {
      android.util.Log.w(TAG, "Could not read NFC tag extra", e);
    }

    // Consume the tag. The activity keeps its intent until Android delivers
    // another one, and this is called again on every resume.
    intent.removeExtra(NfcAdapter.EXTRA_TAG);
    intent.removeExtra(NfcAdapter.EXTRA_NDEF_MESSAGES);

    if (tag == null) {
      promise.resolve(null);
      return;
    }

    Ndef ndef = Ndef.get(tag);
    if (ndef == null) {
      promise.resolve(null);
      return;
    }

    NdefMessage ndefMessage = ndef.getCachedNdefMessage();
    if (ndefMessage == null) {
      promise.resolve(null);
      return;
    }

    NdefRecord[] records = ndefMessage.getRecords();
    if (records.length > 0) {
      // Get first record and ignore the rest
      NdefRecord record = records[0];
      if (record.getTnf() == NdefRecord.TNF_WELL_KNOWN && Arrays.equals(record.getType(), NdefRecord.RTD_TEXT)) {
        String text = textRecordText(record.getPayload());
        if (text != null) {
          promise.resolve(text);
          return;
        }
      }
    }
    promise.resolve(null);
  }

  /*
   * Returns the text of an NFC Forum Text record payload ("Text Record Type
   * Definition" 3.2.1), or null if the payload is malformed.
   *
   * The status byte holds the encoding in bit 7 (0 UTF-8, 1 UTF-16) and the
   * length of the IANA language code in bits 5..0. The language code follows
   * the status byte and the text follows the language code.
   */
  static String textRecordText(byte[] payload) {
    if (payload == null || payload.length == 0) {
      return null;
    }

    String textEncoding = ((payload[0] & 0x80) == 0) ? "UTF-8" : "UTF-16";
    int languageCodeLength = payload[0] & 0x3F;
    int textStart = 1 + languageCodeLength;
    if (textStart > payload.length) {
      return null;
    }

    try {
      return new String(payload, textStart, payload.length - textStart, textEncoding);
    } catch (UnsupportedEncodingException e) {
      return null;
    }
  }

  // JS stops waiting for the image soon after settleByMs, its Date.now()
  // deadline (the same wall clock as System.currentTimeMillis()). This call
  // can wait behind other native calls before it runs, and a read that ran
  // past JS's deadline would consume the share with nobody to receive the
  // image. So the read gives up at settleByMs or after
  // SHARED_IMAGE_TIMEOUT_MS, whichever comes first.
  @ReactMethod
  public void takeSharedImageBase64(double settleByMs, Promise promise) {
    long timeoutMs = Math.min(SHARED_IMAGE_TIMEOUT_MS,
        (long) settleByMs - System.currentTimeMillis());

    // Read and clear the same intent: MainActivity.onNewIntent can replace
    // the activity's intent on the UI thread while this runs, and a second
    // getIntent() could clear a newer share than the one read here.
    Activity activity = getReactApplicationContext().getCurrentActivity();
    if (activity == null) {
      promise.resolve(null);
      return;
    }
    Intent intent = activity.getIntent();
    if (intent == null) {
      promise.resolve(null);
      return;
    }

    try {
      android.util.Log.d(TAG, "Intent action: " + intent.getAction());
      android.util.Log.d(TAG, "Intent type: " + intent.getType());

      if (Intent.ACTION_SEND.equals(intent.getAction()) &&
          intent.getType() != null && intent.getType().startsWith("image/")) {

        Uri imageUri;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
          imageUri = intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri.class);
        } else {
          imageUri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
        }
        android.util.Log.d(TAG, "Image URI: " + imageUri);

        if (imageUri != null) {
          readSharedImage(intent, imageUri, timeoutMs, promise);
          return;
        }
      }
      android.util.Log.d(TAG, "No valid shared image found");
      promise.resolve(null);
    } catch (Exception e) {
      android.util.Log.e(TAG, "Error processing shared image", e);
      promise.reject("SHARE_ERROR", e.getMessage());
    }
  }

  // Settles the promise exactly once: with the image, or with
  // SHARE_TIMEOUT when the sending app has not served it in time. On timeout
  // the stream is closed, which ends a read blocked on it. An openFile()
  // that never returns cannot be interrupted, so its reader thread stays
  // parked, but the promise is settled all the same. The share is consumed
  // only when the promise settles with the image, so a read that times out
  // or fails leaves it for the next one, once its reader has finished.
  private void readSharedImage(
      Intent intent, Uri imageUri, long timeoutMs, Promise promise) {
    // JS has given up on this call, or is about to: leave the share for the
    // next read without opening it
    if (timeoutMs <= 0) {
      android.util.Log.w(TAG, "Shared image read started after its deadline");
      promise.reject("SHARE_TIMEOUT", "Shared image was not served in time");
      return;
    }

    if (!sharedImageReads.add(intent)) {
      android.util.Log.d(TAG, "Shared image is still being read");
      promise.resolve(null);
      return;
    }

    AtomicBoolean settled = new AtomicBoolean(false);
    AtomicReference<InputStream> stream = new AtomicReference<>();

    Future<?> read = sharedImageReaders.submit(() -> {
      try {
        InputStream inputStream = getReactApplicationContext()
            .getContentResolver().openInputStream(imageUri);
        String base64String = null;

        if (inputStream != null) {
          stream.set(inputStream);
          Bitmap bitmap = null;
          try {
            // the deadline may have passed while the provider opened it
            if (!settled.get()) {
              bitmap = BitmapFactory.decodeStream(
                  new CappedInputStream(inputStream, SHARED_IMAGE_MAX_BYTES));
            }
          } finally {
            inputStream.close();
          }

          if (bitmap != null) {
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            bitmap.compress(Bitmap.CompressFormat.JPEG, 100, baos);
            byte[] imageBytes = baos.toByteArray();
            base64String = Base64.encodeToString(imageBytes, Base64.DEFAULT);
            android.util.Log.d(TAG, "Successfully converted image to base64, length: " + base64String.length());
          }
        }

        if (settled.compareAndSet(false, true)) {
          if (base64String == null) {
            android.util.Log.d(TAG, "No valid shared image found");
          } else {
            // The activity keeps its intent until Android delivers another
            // one, and this is called again on every resume.
            intent.setAction(null);
            intent.removeExtra(Intent.EXTRA_STREAM);
          }
          promise.resolve(base64String);
        }
      } catch (Exception e) {
        if (settled.compareAndSet(false, true)) {
          android.util.Log.e(TAG, "Error processing shared image", e);
          promise.reject("SHARE_ERROR", e.getMessage());
        }
      } finally {
        sharedImageReads.remove(intent);
      }
    });

    sharedImageDeadlines.schedule(() -> {
      if (!settled.compareAndSet(false, true)) return;
      android.util.Log.w(TAG, "Shared image not served within " + timeoutMs + " ms");
      promise.reject("SHARE_TIMEOUT", "Shared image was not served in time");
      read.cancel(true);
      // Closing a provider's stream can itself block, so it runs on the
      // reader pool. This thread runs every share's deadline.
      InputStream inputStream = stream.get();
      if (inputStream != null) {
        sharedImageReaders.execute(() -> {
          try {
            inputStream.close();
          } catch (IOException e) {
            // the reader closes it again when its read fails
          }
        });
      }
    }, timeoutMs, TimeUnit.MILLISECONDS);
  }

  // Fails the read once a shared image passes the byte cap, so a sending
  // app cannot keep the decoder reading until the deadline with a stream
  // that does not end
  static class CappedInputStream extends FilterInputStream {
    private long remaining;

    CappedInputStream(InputStream in, long limit) {
      super(in);
      remaining = limit;
    }

    // At the cap, an image that ends there is allowed: read one more byte
    // and fail only if there is one
    private void checkCap() throws IOException {
      if (remaining <= 0 && super.read() >= 0) {
        throw new IOException("Shared image too large");
      }
    }

    @Override
    public int read() throws IOException {
      checkCap();
      if (remaining <= 0) return -1;
      int b = super.read();
      if (b >= 0) remaining--;
      return b;
    }

    @Override
    public int read(byte[] b, int off, int len) throws IOException {
      if (len == 0) return 0;
      checkCap();
      if (remaining <= 0) return -1;
      int n = super.read(b, off, (int) Math.min(len, remaining));
      if (n > 0) remaining -= n;
      return n;
    }

    @Override
    public long skip(long n) throws IOException {
      checkCap();
      if (remaining <= 0) return 0;
      long skipped = super.skip(Math.min(n, remaining));
      if (skipped > 0) remaining -= skipped;
      return skipped;
    }

    // mark/reset would let the decoder read past the cap
    @Override
    public boolean markSupported() {
      return false;
    }
  }

  @ReactMethod
  public void isBatterySaverEnabled(Promise promise) {
    ReactApplicationContext context = getReactApplicationContext();
    try {
      PowerManager pm = (PowerManager) context.getSystemService(
          android.content.Context.POWER_SERVICE
      );
      boolean isPowerSaveMode = pm.isPowerSaveMode();
      android.util.Log.d(
          TAG, "PowerManager.isPowerSaveMode(): " + isPowerSaveMode
      );

      try {
        int lowPowerSetting = Settings.Global.getInt(
            context.getContentResolver(), "low_power", 0
        );
        boolean settingEnabled = (lowPowerSetting == 1);
        android.util.Log.d(
            TAG,
            "Settings.Global.low_power: " + lowPowerSetting +
                " (enabled: " + settingEnabled + ")"
        );
        promise.resolve(isPowerSaveMode || settingEnabled);
        return;
      } catch (Exception settingError) {
        android.util.Log.w(
            TAG, "Could not check low_power setting", settingError
        );
      }

      promise.resolve(isPowerSaveMode);
    } catch (Exception e) {
      android.util.Log.e(TAG, "Battery saver check failed", e);
      promise.resolve(false);
    }
  }
}
