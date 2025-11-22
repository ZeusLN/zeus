package app.zeusln.zeus;

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
import android.os.PowerManager;
import android.provider.Settings;

import java.util.Arrays;
import java.io.UnsupportedEncodingException;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;

class MobileTools extends ReactContextBaseJavaModule {
  final String TAG = "MobileTools";

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
  public void getSharedImageBase64(Promise promise) {
    try {
      Intent intent = getReactApplicationContext()
          .getCurrentActivity().getIntent();

      android.util.Log.d(TAG, "Intent action: " + intent.getAction());
      android.util.Log.d(TAG, "Intent type: " + intent.getType());

      if (Intent.ACTION_SEND.equals(intent.getAction()) && 
          intent.getType() != null && intent.getType().startsWith("image/")) {
        
        Uri imageUri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
        android.util.Log.d(TAG, "Image URI: " + imageUri);
        
        if (imageUri != null) {
          InputStream inputStream = getReactApplicationContext()
              .getContentResolver().openInputStream(imageUri);
          
          if (inputStream != null) {
            Bitmap bitmap = BitmapFactory.decodeStream(inputStream);
            inputStream.close();
            
            if (bitmap != null) {
              ByteArrayOutputStream baos = new ByteArrayOutputStream();
              bitmap.compress(Bitmap.CompressFormat.JPEG, 100, baos);
              byte[] imageBytes = baos.toByteArray();
              String base64String = Base64.encodeToString(imageBytes, Base64.DEFAULT);
              
              android.util.Log.d(TAG, "Successfully converted image to base64, length: " + base64String.length());
              promise.resolve(base64String);
              return;
            }
          }
        }
      }
      android.util.Log.d(TAG, "No valid shared image found");
      promise.resolve(null);
    } catch (Exception e) {
      android.util.Log.e(TAG, "Error processing shared image", e);
      promise.reject("SHARE_ERROR", e.getMessage());
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
