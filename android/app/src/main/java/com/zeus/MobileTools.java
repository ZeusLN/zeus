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
import android.os.PowerManager;
import android.provider.Settings;

import java.util.Arrays;
import java.io.UnsupportedEncodingException;
import java.io.InputStream;
import java.io.FilterInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
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

    Tag tag;
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      tag = intent.getParcelableExtra(NfcAdapter.EXTRA_TAG, Tag.class);
    } else {
      tag = intent.getParcelableExtra(NfcAdapter.EXTRA_TAG);
    }
    if (tag == null) {
      promise.resolve(null);
      return;
    }

    // Consume the tag. The activity keeps its intent until Android delivers
    // another one, and this is called again on every resume.
    intent.removeExtra(NfcAdapter.EXTRA_TAG);
    intent.removeExtra(NfcAdapter.EXTRA_NDEF_MESSAGES);

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
  public void getSharedImageBase64(Promise promise) {
    try {
      Intent intent = getReactApplicationContext()
          .getCurrentActivity().getIntent();

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
          readSharedImage(imageUri, promise);
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
  // parked, but the promise is settled all the same.
  private void readSharedImage(Uri imageUri, Promise promise) {
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
          }
          promise.resolve(base64String);
        }
      } catch (Exception e) {
        if (settled.compareAndSet(false, true)) {
          android.util.Log.e(TAG, "Error processing shared image", e);
          promise.reject("SHARE_ERROR", e.getMessage());
        }
      }
    });

    sharedImageDeadlines.schedule(() -> {
      if (!settled.compareAndSet(false, true)) return;
      android.util.Log.w(TAG, "Shared image not served within " + SHARED_IMAGE_TIMEOUT_MS + " ms");
      InputStream inputStream = stream.get();
      if (inputStream != null) {
        try {
          inputStream.close();
        } catch (IOException e) {
          // the reader closes it again when its read fails
        }
      }
      read.cancel(true);
      promise.reject("SHARE_TIMEOUT", "Shared image was not served in time");
    }, SHARED_IMAGE_TIMEOUT_MS, TimeUnit.MILLISECONDS);
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

    @Override
    public int read() throws IOException {
      if (remaining <= 0) throw new IOException("Shared image too large");
      int b = super.read();
      if (b >= 0) remaining--;
      return b;
    }

    @Override
    public int read(byte[] b, int off, int len) throws IOException {
      if (len == 0) return 0;
      if (remaining <= 0) throw new IOException("Shared image too large");
      int n = super.read(b, off, (int) Math.min(len, remaining));
      if (n > 0) remaining -= n;
      return n;
    }

    @Override
    public long skip(long n) throws IOException {
      if (remaining <= 0) throw new IOException("Shared image too large");
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
  public void clearSharedIntent(Promise promise) {
    try {
      Intent intent = getReactApplicationContext()
          .getCurrentActivity().getIntent();
      
      android.util.Log.d(TAG, "Clearing shared intent data");
      
      // Clear the intent action and extras to prevent reprocessing
      if (Intent.ACTION_SEND.equals(intent.getAction())) {
        intent.setAction(null);
        intent.removeExtra(Intent.EXTRA_STREAM);
        android.util.Log.d(TAG, "Shared intent data cleared");
      }
      
      promise.resolve(true);
    } catch (Exception e) {
      android.util.Log.e(TAG, "Error clearing shared intent", e);
      promise.reject("CLEAR_ERROR", e.getMessage());
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
