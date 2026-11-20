import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Compiles the shared-image read out of MobileTools.java against stand-ins
// for the Android classes it uses and runs it on a real JDK pipe. Needs a
// JDK, so it is skipped where javac is not installed.
const hasJdk = (() => {
    try {
        execFileSync('javac', ['-version'], { stdio: 'pipe' });
        return true;
    } catch {
        return false;
    }
})();

const MOBILE_TOOLS = path.join(__dirname, 'MobileTools.java');

const slice = (source: string, from: string, to: string) => {
    const start = source.indexOf(from);
    const end = source.indexOf(to, start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    return source.slice(start, end);
};

const extract = () => {
    const source = fs.readFileSync(MOBILE_TOOLS, 'utf8');
    return [
        slice(
            source,
            '  static final long SHARED_IMAGE_TIMEOUT_MS',
            '  public MobileTools('
        ),
        slice(
            source,
            '  @ReactMethod\n  public void takeSharedImageBase64(',
            '  @ReactMethod\n  public void isBatterySaverEnabled('
        )
    ].join('\n');
};

// argv[0] is the provider: "valid" serves a small image at once, "stalled"
// returns a pipe and never writes to it, "blockingClose" does the same and
// never returns from close(), "endless" writes without end, "atCap" and
// "overCap" serve exactly SHARED_IMAGE_MAX_BYTES and one byte more,
// "neverOpens" never returns from openInputStream and "openFails" throws
// from it. argv[1] is the deadline JS
// passes, in ms from the call. argv[2] asks for a second take once the first
// has settled: "sameShare" of the same intent, "newShare" of a new one.
// Prints how long the
// @ReactMethod held its caller, how the promise settled, whether the
// provider was opened, and whether its stream was closed and its reader let
// go.
const HARNESS = (method: string) => `import java.io.*;
import java.util.Set;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;

class Harness {
  @interface ReactMethod {}
  static class android {
    static class util {
      static class Log {
        static int d(String tag, String message) { return 0; }
        static int w(String tag, String message) { return 0; }
        static int e(String tag, String message, Throwable error) { return 0; }
      }
    }
  }
  static class Build {
    static class VERSION { static final int SDK_INT = 34; }
    static class VERSION_CODES { static final int TIRAMISU = 33; }
  }
  static class Uri {}
  static class Intent {
    static final String ACTION_SEND = "android.intent.action.SEND";
    static final String EXTRA_STREAM = "android.intent.extra.STREAM";
    String getAction() { return ACTION_SEND; }
    String getType() { return "image/png"; }
    @SuppressWarnings("unchecked")
    <T> T getParcelableExtra(String key) { return (T) new Uri(); }
    <T> T getParcelableExtra(String key, Class<T> type) { return type.cast(new Uri()); }
    void setAction(String action) { consumed.set(true); }
    void removeExtra(String key) { consumed.set(true); }
  }
  static class Activity { Intent getIntent() { return intent; } }
  static class ContentResolver {
    InputStream openInputStream(Uri uri) {
      opened.set(true);
      opens.incrementAndGet();
      if (openFails) throw new SecurityException("Permission Denial");
      // a binder call into the sending app cannot be interrupted
      while (neverOpens) {
        try { new CountDownLatch(1).await(); }
        catch (InterruptedException e) {}
      }
      return provider;
    }
  }
  static class Context {
    Activity getCurrentActivity() { return new Activity(); }
    ContentResolver getContentResolver() { return new ContentResolver(); }
  }
  static class Promise {
    final CountDownLatch settled = new CountDownLatch(1);
    final AtomicInteger calls = new AtomicInteger();
    volatile String outcome;
    // settled on the thread running the @ReactMethod, before it returned
    volatile boolean inCall;
    // the share still had a reader when the promise settled, so a take
    // made on this result would have been turned away
    volatile boolean readingAtSettle;
    void resolve(Object value) {
      readingAtSettle = sharedImageReads.contains(intent);
      inCall = Thread.currentThread() == caller;
      calls.incrementAndGet();
      outcome = value == null ? "resolved:null" : "resolved:" + value;
      settled.countDown();
    }
    void reject(String code, String message) {
      readingAtSettle = sharedImageReads.contains(intent);
      inCall = Thread.currentThread() == caller;
      calls.incrementAndGet();
      outcome = "rejected:" + code;
      settled.countDown();
    }
  }
  static class Base64 {
    static final int DEFAULT = 0;
    static String encodeToString(byte[] bytes, int flags) {
      return java.util.Base64.getEncoder().encodeToString(bytes);
    }
  }
  static class Bitmap {
    enum CompressFormat { JPEG }
    boolean compress(CompressFormat format, int quality, OutputStream out) {
      try { out.write(new byte[] { 1, 2, 3 }); return true; }
      catch (IOException e) { return false; }
    }
  }
  // Reads the whole stream, as a decoder does, and returns null when the
  // stream fails, as BitmapFactory does
  static class BitmapFactory {
    static Bitmap decodeStream(InputStream in) {
      try {
        byte[] buffer = new byte[8192];
        while (in.read(buffer, 0, buffer.length) >= 0) {}
        return new Bitmap();
      } catch (IOException e) {
        return null;
      }
    }
  }

  static InputStream provider;
  static volatile Intent intent = new Intent();
  static volatile boolean neverOpens;
  static volatile boolean openFails;
  static final AtomicInteger opens = new AtomicInteger();
  static volatile Thread caller;
  static final AtomicBoolean opened = new AtomicBoolean();
  static final AtomicLong served = new AtomicLong();
  static final AtomicBoolean closed = new AtomicBoolean();
  static final AtomicBoolean consumed = new AtomicBoolean();
  static final CountDownLatch readerDone = new CountDownLatch(1);

  // The provider's end of the stream: counts what the reader takes and
  // notes when it is closed and when the reader stops reading
  static InputStream watched(InputStream in) {
    return new FilterInputStream(in) {
      @Override public int read(byte[] b, int off, int len) throws IOException {
        try {
          int n = super.read(b, off, len);
          if (n > 0) served.addAndGet(n);
          if (n < 0) readerDone.countDown();
          return n;
        } catch (IOException e) {
          readerDone.countDown();
          throw e;
        }
      }
      @Override public void close() throws IOException {
        closed.set(true);
        super.close();
      }
    };
  }

  static InputStream bytes(long length) {
    return watched(new InputStream() {
      long left = length;
      @Override public int read() {
        if (left <= 0) return -1;
        left--;
        return 0;
      }
      @Override public int read(byte[] b, int off, int len) {
        if (left <= 0) return -1;
        int n = (int) Math.min(len, left);
        left -= n;
        return n;
      }
    });
  }

  static InputStream blockingClose() throws IOException {
    return watched(new PipedInputStream(new PipedOutputStream()) {
      @Override public void close() {
        try { new CountDownLatch(1).await(); }
        catch (InterruptedException e) {}
      }
    });
  }

  final String TAG = "MobileTools";
  Context getReactApplicationContext() { return new Context(); }

  ${method}

  public static void main(String[] args) throws Exception {
    switch (args[0]) {
      case "valid":
        provider = watched(new ByteArrayInputStream(new byte[] { 1, 2, 3, 4 }));
        break;
      case "stalled":
        // The sending app keeps the write end and never writes to it
        PipedOutputStream writer = new PipedOutputStream();
        provider = watched(new PipedInputStream(writer));
        break;
      case "blockingClose":
        provider = blockingClose();
        break;
      case "atCap":
        provider = bytes(SHARED_IMAGE_MAX_BYTES);
        break;
      case "overCap":
        provider = bytes(SHARED_IMAGE_MAX_BYTES + 1);
        break;
      case "neverOpens":
        neverOpens = true;
        break;
      case "openFails":
        openFails = true;
        break;
      case "endless":
        provider = watched(new InputStream() {
          @Override public int read() { return 0; }
          @Override public int read(byte[] b, int off, int len) { return len; }
        });
        break;
    }

    long settleByOffsetMs = Long.parseLong(args[1]);
    Promise promise = new Promise();
    long start = System.nanoTime();
    caller = Thread.currentThread();
    new Harness().takeSharedImageBase64(
        System.currentTimeMillis() + settleByOffsetMs, promise);
    caller = null;
    long heldMs = (System.nanoTime() - start) / 1000000;

    boolean settled = promise.settled.await(SHARED_IMAGE_TIMEOUT_MS + 3000, TimeUnit.MILLISECONDS);
    long settledMs = (System.nanoTime() - start) / 1000000;
    boolean readerStopped = args[0].equals("stalled")
        ? readerDone.await(3, TimeUnit.SECONDS)
        : readerDone.getCount() == 0;
    // a second settle would show up here
    Thread.sleep(200);

    // A close that blocked the deadline thread would also keep the next
    // share's deadline from firing
    String secondOutcome = null;
    boolean secondInCall = false;
    String secondTake = args.length > 2 ? args[2] : "none";
    if (args[0].equals("blockingClose")) {
      provider = blockingClose();
      secondTake = "newShare";
    }
    if (!secondTake.equals("none")) {
      if (secondTake.equals("newShare")) intent = new Intent();
      Promise second = new Promise();
      caller = Thread.currentThread();
      new Harness().takeSharedImageBase64(
          System.currentTimeMillis() + settleByOffsetMs, second);
      caller = null;
      second.settled.await(SHARED_IMAGE_TIMEOUT_MS + 3000, TimeUnit.MILLISECONDS);
      secondOutcome = second.outcome;
      secondInCall = second.inCall;
    }

    System.out.println("{\\"heldMs\\":" + heldMs
        + ",\\"settled\\":" + settled
        + ",\\"settledMs\\":" + settledMs
        + ",\\"outcome\\":\\"" + promise.outcome + "\\""
        + ",\\"secondOutcome\\":\\"" + secondOutcome + "\\""
        + ",\\"settleCalls\\":" + promise.calls.get()
        + ",\\"settledInCall\\":" + promise.inCall
        + ",\\"secondInCall\\":" + secondInCall
        + ",\\"readingAtSettle\\":" + promise.readingAtSettle
        + ",\\"opened\\":" + opened.get()
        + ",\\"opens\\":" + opens.get()
        + ",\\"served\\":" + served.get()
        + ",\\"closed\\":" + closed.get()
        + ",\\"consumed\\":" + consumed.get()
        + ",\\"readerStopped\\":" + readerStopped
        + ",\\"timeoutMs\\":" + SHARED_IMAGE_TIMEOUT_MS
        + ",\\"maxBytes\\":" + SHARED_IMAGE_MAX_BYTES + "}");
    System.exit(0);
  }
}
`;

(hasJdk ? describe : describe.skip)(
    'MobileTools.takeSharedImageBase64 (compiled, needs a JDK)',
    () => {
        let dir: string;

        beforeAll(() => {
            dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shared-image-'));
            const source = path.join(dir, 'Harness.java');
            fs.writeFileSync(source, HARNESS(extract()));
            execFileSync('javac', ['-d', dir, source], { stdio: 'pipe' });
        }, 60000);

        afterAll(() => {
            if (dir) fs.rmSync(dir, { recursive: true, force: true });
        });

        // What ShareIntentProcessor passes for a call that runs at once:
        // its 8 s timeout less the 1 s it leaves for the result to reach it
        const JS_SETTLE_BY_MS = 7000;

        const run = (
            provider: string,
            settleByMs = JS_SETTLE_BY_MS,
            secondTake = 'none'
        ) =>
            JSON.parse(
                execFileSync(
                    'java',
                    [
                        '-cp',
                        dir,
                        'Harness',
                        provider,
                        String(settleByMs),
                        secondTake
                    ],
                    { encoding: 'utf8', timeout: 20000 }
                )
            );

        it('reads an image the sending app serves at once', () => {
            const result = run('valid');

            expect(result.outcome).toBe('resolved:AQID');
            expect(result.settleCalls).toBe(1);
            expect(result.closed).toBe(true);
            expect(result.consumed).toBe(true);
        }, 20000);

        // React Native runs every native module method, including each
        // keychain call, on one thread. A sending app that never writes to
        // its stream held that thread for as long as it liked.
        it('does not hold the native modules thread for a stalled sender', () => {
            const result = run('stalled');

            expect(result.heldMs).toBeLessThan(1000);
            expect(result.settled).toBe(true);
            expect(result.outcome).toBe('rejected:SHARE_TIMEOUT');
            expect(result.settleCalls).toBe(1);
            expect(result.settledMs).toBeGreaterThanOrEqual(
                result.timeoutMs - 100
            );
            expect(result.settledMs).toBeLessThan(result.timeoutMs + 2000);
            // the stream is closed, so the reader thread is let go
            expect(result.closed).toBe(true);
            expect(result.readerStopped).toBe(true);
            // left in place for the next read
            expect(result.consumed).toBe(false);
        }, 20000);

        // JS stops waiting soon after the deadline it passes, and the call
        // can wait behind other native calls before it runs. A read that ran
        // past that deadline would consume the share with nobody to receive
        // the image.
        it('gives up by the deadline JS passes when that comes first', () => {
            const result = run('stalled', 2000);

            expect(result.outcome).toBe('rejected:SHARE_TIMEOUT');
            expect(result.settleCalls).toBe(1);
            expect(result.settledMs).toBeGreaterThanOrEqual(1900);
            expect(result.settledMs).toBeLessThan(3000);
            expect(result.consumed).toBe(false);
        }, 20000);

        it('keeps its own deadline when JS would wait longer', () => {
            const result = run('stalled', 60000);

            expect(result.settled).toBe(true);
            expect(result.outcome).toBe('rejected:SHARE_TIMEOUT');
            expect(result.settledMs).toBeLessThan(result.timeoutMs + 2000);
        }, 20000);

        it('does not open a share when it starts after the deadline JS passed', () => {
            const result = run('valid', -1000);

            expect(result.outcome).toBe('rejected:SHARE_TIMEOUT');
            expect(result.settleCalls).toBe(1);
            // rejected before the method returned, so no reader was started
            expect(result.settledInCall).toBe(true);
            expect(result.opened).toBe(false);
            expect(result.consumed).toBe(false);
        }, 20000);

        it('settles a stalled sender whose close() never returns', () => {
            const result = run('blockingClose');

            expect(result.outcome).toBe('rejected:SHARE_TIMEOUT');
            expect(result.settledMs).toBeLessThan(result.timeoutMs + 2000);
            expect(result.secondOutcome).toBe('rejected:SHARE_TIMEOUT');
        }, 30000);

        // A share that timed out stays on the activity and is taken again
        // on every resume. A sending app that never returns from the open
        // keeps its reader thread for good, and each later take would park
        // another one.
        it('does not open a share again while its reader is still parked', () => {
            const result = run('neverOpens', 1000, 'sameShare');

            expect(result.heldMs).toBeLessThan(1000);
            expect(result.outcome).toBe('rejected:SHARE_TIMEOUT');
            expect(result.secondOutcome).toBe('resolved:null');
            // resolved before the method returned, so no reader was started
            expect(result.secondInCall).toBe(true);
            expect(result.opens).toBe(1);
        }, 20000);

        it('still reads a new share while an earlier reader is parked', () => {
            const result = run('neverOpens', 1000, 'newShare');

            expect(result.secondOutcome).toBe('rejected:SHARE_TIMEOUT');
            expect(result.opens).toBe(2);
        }, 20000);

        it('opens a share again once the reader that timed out has stopped', () => {
            const result = run('stalled', 1000, 'sameShare');

            expect(result.outcome).toBe('rejected:SHARE_TIMEOUT');
            expect(result.readerStopped).toBe(true);
            expect(result.secondInCall).toBe(false);
            expect(result.opens).toBe(2);
        }, 20000);

        // JS can take the share again as soon as it has the result. A read
        // that failed must have let go of the share by then, or that take
        // would find nothing.
        it('lets go of the share before it settles a read that found no image', () => {
            const result = run('overCap');

            expect(result.outcome).toBe('resolved:null');
            expect(result.readingAtSettle).toBe(false);
        }, 20000);

        it('lets go of the share before it settles a read that failed', () => {
            const result = run('openFails');

            expect(result.outcome).toBe('rejected:SHARE_ERROR');
            expect(result.readingAtSettle).toBe(false);
            expect(result.consumed).toBe(false);
        }, 20000);

        it('reads an image of exactly the byte cap', () => {
            const result = run('atCap');

            expect(result.outcome).toBe('resolved:AQID');
            expect(result.served).toBe(result.maxBytes);
        }, 20000);

        it('rejects an image one byte over the byte cap', () => {
            const result = run('overCap');

            expect(result.outcome).toBe('resolved:null');
            expect(result.settleCalls).toBe(1);
        }, 20000);

        it('stops reading at the byte cap', () => {
            const result = run('endless');

            expect(result.heldMs).toBeLessThan(1000);
            expect(result.outcome).toBe('resolved:null');
            expect(result.settleCalls).toBe(1);
            expect(result.served).toBe(result.maxBytes);
            expect(result.closed).toBe(true);
            expect(result.consumed).toBe(false);
        }, 20000);
    }
);
