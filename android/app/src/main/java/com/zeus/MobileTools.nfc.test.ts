import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Compiles getIntentNfcData out of MobileTools.java against small stand-ins
// for the Android and React Native classes it uses, and runs it on a JVM.
// Skipped when no JDK is installed.
const hasJdk = (() => {
    try {
        execFileSync('javac', ['-version'], { stdio: 'pipe' });
        execFileSync('java', ['-version'], { stdio: 'pipe' });
        return true;
    } catch {
        return false;
    }
})();

const MOBILE_TOOLS = path.join(__dirname, 'MobileTools.java');

const extractMethod = () => {
    const source = fs.readFileSync(MOBILE_TOOLS, 'utf8');
    const start = source.indexOf('  public void getIntentNfcData(');
    const end = source.indexOf(
        '  @ReactMethod\n  public void getSharedImageBase64',
        start
    );
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    return source.slice(start, end);
};

const LOG_STUB = `package android.util;

public class Log {
  public static int w(String tag, String msg) { return 0; }
  public static int w(String tag, String msg, Throwable tr) { return 0; }
}
`;

// The stand-ins keep the Android signatures that matter here: the untyped
// getParcelableExtra is generic over Parcelable, so the caller's assignment
// decides the cast, and Intent is itself a Parcelable.
const HARNESS = (
    method: string
) => `import java.io.UnsupportedEncodingException;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;

class NfcHarness {
  final String TAG = "MobileTools";

  interface Parcelable {}

  static class BadParcelableException extends RuntimeException {
    BadParcelableException(String message) { super(message); }
  }

  static class Build {
    static class VERSION { static int SDK_INT; }
    static class VERSION_CODES { static final int TIRAMISU = 33; }
  }

  static class NfcAdapter {
    static final String EXTRA_TAG = "android.nfc.extra.TAG";
    static final String EXTRA_NDEF_MESSAGES = "android.nfc.extra.NDEF_MESSAGES";
  }

  // Stands in for an extra whose class this app cannot load
  static class Unreadable implements Parcelable {}

  static class Intent implements Parcelable {
    final Map<String, Object> extras = new HashMap<>();
    boolean hasExtra(String name) { return extras.containsKey(name); }
    @SuppressWarnings("unchecked")
    <T extends Parcelable> T getParcelableExtra(String name) {
      return (T) read(name);
    }
    <T> T getParcelableExtra(String name, Class<T> clazz) {
      Object value = read(name);
      return clazz.isInstance(value) ? clazz.cast(value) : null;
    }
    void removeExtra(String name) { extras.remove(name); }
    private Object read(String name) {
      Object value = extras.get(name);
      if (value instanceof Unreadable) {
        throw new BadParcelableException("ClassNotFoundException");
      }
      return value;
    }
  }

  static class Activity {
    final Intent intent = new Intent();
    Intent getIntent() { return intent; }
  }

  static class ReactApplicationContext {
    final Activity activity = new Activity();
    Activity getCurrentActivity() { return activity; }
  }

  static class NdefRecord {
    static final short TNF_WELL_KNOWN = 1;
    static final byte[] RTD_TEXT = { 'T' };
    final byte[] payload;
    NdefRecord(byte[] payload) { this.payload = payload; }
    short getTnf() { return TNF_WELL_KNOWN; }
    byte[] getType() { return RTD_TEXT; }
    byte[] getPayload() { return payload; }
  }

  static class NdefMessage implements Parcelable {
    final NdefRecord[] records;
    NdefMessage(NdefRecord... records) { this.records = records; }
    NdefRecord[] getRecords() { return records; }
  }

  static class Tag implements Parcelable {
    final NdefMessage message;
    Tag(NdefMessage message) { this.message = message; }
  }

  static class Ndef {
    final Tag tag;
    Ndef(Tag tag) { this.tag = tag; }
    static Ndef get(Tag tag) { return new Ndef(tag); }
    NdefMessage getCachedNdefMessage() { return tag.message; }
  }

  static class Promise {
    int settled;
    Object value;
    void resolve(Object value) { this.value = value; settled++; }
    void reject(String code, String message) { settled++; }
  }

  final ReactApplicationContext context = new ReactApplicationContext();
  ReactApplicationContext getReactApplicationContext() { return context; }

${method}

  static String quote(Object value) {
    return value == null ? "null" : "\\"" + value + "\\"";
  }

  // args: <SDK_INT> <none|text|intent|unreadable>
  // Calls getIntentNfcData twice on the same intent and prints each result.
  public static void main(String[] args) {
    Build.VERSION.SDK_INT = Integer.parseInt(args[0]);
    NfcHarness tools = new NfcHarness();
    Map<String, Object> extras = tools.context.activity.intent.extras;
    NdefMessage message = new NdefMessage(
        new NdefRecord(new byte[] { 2, 'e', 'n', 'o', 'k' }));
    switch (args[1]) {
      case "none": break;
      case "text": extras.put(NfcAdapter.EXTRA_TAG, new Tag(message)); break;
      case "intent": extras.put(NfcAdapter.EXTRA_TAG, new Intent()); break;
      case "unreadable": extras.put(NfcAdapter.EXTRA_TAG, new Unreadable()); break;
      default: throw new IllegalArgumentException(args[1]);
    }
    if (!args[1].equals("none")) {
      extras.put(NfcAdapter.EXTRA_NDEF_MESSAGES, new Parcelable[] { message });
    }

    StringBuilder calls = new StringBuilder();
    for (int i = 0; i < 2; i++) {
      Promise promise = new Promise();
      String error = null;
      try {
        tools.getIntentNfcData(promise);
      } catch (Throwable t) {
        error = t.getClass().getName();
      }
      if (i > 0) calls.append(",");
      calls.append("{\\"settled\\":").append(promise.settled)
          .append(",\\"value\\":").append(quote(promise.value))
          .append(",\\"error\\":").append(quote(error)).append("}");
    }
    System.out.println("{\\"calls\\":[" + calls + "],\\"extrasLeft\\":"
        + extras.size() + "}");
  }
}
`;

(hasJdk ? describe : describe.skip)(
    'MobileTools.getIntentNfcData (compiled, needs a JDK)',
    () => {
        let dir: string;

        beforeAll(() => {
            dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zeus-nfc-tag-'));
            const harness = path.join(dir, 'NfcHarness.java');
            const log = path.join(dir, 'Log.java');
            fs.writeFileSync(harness, HARNESS(extractMethod()));
            fs.writeFileSync(log, LOG_STUB);
            execFileSync('javac', ['-nowarn', '-d', dir, harness, log], {
                stdio: 'pipe'
            });
        }, 60000);

        afterAll(() => {
            if (dir) fs.rmSync(dir, { recursive: true, force: true });
        });

        const run = (sdk: number, fixture: string) =>
            JSON.parse(
                execFileSync(
                    'java',
                    ['-cp', dir, 'NfcHarness', String(sdk), fixture],
                    { encoding: 'utf8', timeout: 10000 }
                )
            );

        const NO_TAG = { settled: 1, value: null, error: null };

        describe.each([32, 33])('SDK %i', (sdk) => {
            it('returns the text of a tag once and consumes it', () => {
                expect(run(sdk, 'text')).toEqual({
                    calls: [{ settled: 1, value: 'ok', error: null }, NO_TAG],
                    extrasLeft: 0
                });
            });

            it('resolves with no data when there is no tag', () => {
                expect(run(sdk, 'none')).toEqual({
                    calls: [NO_TAG, NO_TAG],
                    extrasLeft: 0
                });
            });

            // Any local app can start the exported MainActivity with an
            // Intent, which is a Parcelable, under android.nfc.extra.TAG
            it('ignores and consumes a tag extra of another type', () => {
                expect(run(sdk, 'intent')).toEqual({
                    calls: [NO_TAG, NO_TAG],
                    extrasLeft: 0
                });
            });

            it('ignores and consumes a tag extra that cannot be unparcelled', () => {
                expect(run(sdk, 'unreadable')).toEqual({
                    calls: [NO_TAG, NO_TAG],
                    extrasLeft: 0
                });
            });
        });
    }
);
