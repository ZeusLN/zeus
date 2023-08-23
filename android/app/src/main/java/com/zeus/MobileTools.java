package app.zeusln.zeus;

import android.nfc.Tag;
import android.nfc.NfcAdapter;
import android.nfc.NdefMessage;
import android.nfc.tech.Ndef;
import android.nfc.NdefRecord;

import java.util.Arrays;
import java.io.UnsupportedEncodingException;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;

import com.hypertrack.hyperlog.HyperLog;

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
      HyperLog.d(TAG, "NFC tag is not NDEF");
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
          HyperLog.e(TAG, "Error returning ndef data", e);
        }
      }
      else {
        HyperLog.d(TAG, "Cannot read NFC Tag Record");
      }
    }
    promise.resolve(null);
  }
}
