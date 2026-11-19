import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Compiles NfcIntentGuard.java against small stand-ins for the Android
// classes it uses and runs it on a JVM. Skipped when no JDK is installed.
const hasJdk = (() => {
    try {
        execFileSync('javac', ['-version'], { stdio: 'pipe' });
        execFileSync('java', ['-version'], { stdio: 'pipe' });
        return true;
    } catch {
        return false;
    }
})();

const GUARD = path.join(__dirname, 'NfcIntentGuard.java');

// The stand-in Activity.getReferrer() follows the framework: an
// EXTRA_REFERRER or EXTRA_REFERRER_NAME on the activity's intent wins over
// the sender the system recorded
const STUBS: { [file: string]: string } = {
    'android/util/Log.java': `package android.util;
public class Log {
  public static int w(String tag, String msg) { return 0; }
  public static int w(String tag, String msg, Throwable tr) { return 0; }
}`,
    'android/os/Bundle.java': `package android.os;
public class Bundle {}`,
    'android/nfc/NfcAdapter.java': `package android.nfc;
public class NfcAdapter {
  public static final String EXTRA_TAG = "android.nfc.extra.TAG";
  public static final String EXTRA_NDEF_MESSAGES = "android.nfc.extra.NDEF_MESSAGES";
  public static final String EXTRA_ID = "android.nfc.extra.ID";
}`,
    'android/net/Uri.java': `package android.net;
public class Uri {
  private final String scheme;
  private final String host;
  private Uri(String scheme, String host) { this.scheme = scheme; this.host = host; }
  public static Uri parse(String s) {
    int colon = s.indexOf(':');
    if (colon < 0) return new Uri(null, null);
    String rest = s.substring(colon + 1);
    String host = rest.startsWith("//") ? rest.substring(2).split("/")[0] : null;
    return new Uri(s.substring(0, colon), host);
  }
  public String getScheme() { return scheme; }
  public String getHost() { return host; }
}`,
    'android/content/pm/ApplicationInfo.java': `package android.content.pm;
public class ApplicationInfo {
  public static final int FLAG_SYSTEM = 1;
  public int flags;
}`,
    'android/content/pm/PackageManager.java': `package android.content.pm;
import java.util.HashMap;
import java.util.Map;
public class PackageManager {
  public static class NameNotFoundException extends Exception {}
  public final Map<String, ApplicationInfo> installed = new HashMap<>();
  public ApplicationInfo getApplicationInfo(String name, int flags) throws NameNotFoundException {
    ApplicationInfo info = installed.get(name);
    if (info == null) throw new NameNotFoundException();
    return info;
  }
}`,
    'android/content/Context.java': `package android.content;
import android.content.pm.PackageManager;
public class Context {
  public final PackageManager packageManager = new PackageManager();
  public String getPackageName() { return "app.zeusln.zeus"; }
  public PackageManager getPackageManager() { return packageManager; }
}`,
    'android/content/Intent.java': `package android.content;
import android.net.Uri;
import android.os.Bundle;
import java.util.Map;
import java.util.TreeMap;
public class Intent {
  public static final String EXTRA_REFERRER = "android.intent.extra.REFERRER";
  public static final String EXTRA_REFERRER_NAME = "android.intent.extra.REFERRER_NAME";
  public final Map<String, Object> extras = new TreeMap<>();
  public boolean unreadable;
  private void read() {
    if (unreadable) throw new RuntimeException("BadParcelableException");
  }
  public boolean hasExtra(String name) { read(); return extras.containsKey(name); }
  public void removeExtra(String name) { read(); extras.remove(name); }
  public Uri getReferrerExtra() { read(); return (Uri) extras.get(EXTRA_REFERRER); }
  public String getStringExtra(String name) { read(); return (String) extras.get(name); }
  public Intent replaceExtras(Bundle bundle) { extras.clear(); unreadable = false; return this; }
}`,
    'android/app/Activity.java': `package android.app;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
public class Activity extends Context {
  public Intent intent;
  public String systemReferrer;
  public Intent getIntent() { return intent; }
  public Uri getReferrer() {
    Uri referrer = intent.getReferrerExtra();
    if (referrer != null) return referrer;
    String name = intent.getStringExtra(Intent.EXTRA_REFERRER_NAME);
    if (name != null) return Uri.parse(name);
    if (systemReferrer != null) return Uri.parse("android-app://" + systemReferrer);
    return null;
  }
}`,
    'GuardHarness.java': `import android.app.Activity;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.net.Uri;
import android.nfc.NfcAdapter;

// args: <system referrer or -> <com.android.nfc: system|app|none> <extras...>
//   or: sender <referrer uri>, or: nointent
// extras: tag msgs id other referrer=<uri> referrerName=<name> unreadable
public class GuardHarness {
  public static void main(String[] args) throws Exception {
    Class<?> guard = Class.forName("app.zeusln.zeus.NfcIntentGuard");
    java.lang.reflect.Method drop = guard.getDeclaredMethod("dropUntrustedNfcPayload", Activity.class, Intent.class);
    drop.setAccessible(true);
    if (args[0].equals("sender")) {
      java.lang.reflect.Method sender = guard.getDeclaredMethod("senderPackage", Uri.class);
      sender.setAccessible(true);
      Object pkg = sender.invoke(null, Uri.parse(args[1]));
      System.out.println(pkg == null ? "null" : "\\"" + pkg + "\\"");
      return;
    }
    if (args[0].equals("nointent")) {
      System.out.println(drop.invoke(null, new Activity(), null));
      return;
    }
    Activity activity = new Activity();
    activity.systemReferrer = args[0].equals("-") ? null : args[0];
    if (!args[1].equals("none")) {
      ApplicationInfo info = new ApplicationInfo();
      info.flags = args[1].equals("system") ? ApplicationInfo.FLAG_SYSTEM : 0;
      activity.packageManager.installed.put("com.android.nfc", info);
    }
    Intent intent = new Intent();
    activity.intent = intent;
    for (int i = 2; i < args.length; i++) {
      String a = args[i];
      if (a.equals("tag")) intent.extras.put(NfcAdapter.EXTRA_TAG, new Object());
      else if (a.equals("msgs")) intent.extras.put(NfcAdapter.EXTRA_NDEF_MESSAGES, new Object());
      else if (a.equals("id")) intent.extras.put(NfcAdapter.EXTRA_ID, new Object());
      else if (a.equals("other")) intent.extras.put("other", "x");
      else if (a.startsWith("referrer=")) intent.extras.put(Intent.EXTRA_REFERRER, Uri.parse(a.substring(9)));
      else if (a.startsWith("referrerName=")) intent.extras.put(Intent.EXTRA_REFERRER_NAME, a.substring(13));
      else if (a.equals("unreadable")) intent.unreadable = true;
      else throw new IllegalArgumentException(a);
    }
    boolean dropped = (Boolean) drop.invoke(null, activity, intent);
    StringBuilder left = new StringBuilder();
    for (String key : intent.extras.keySet()) {
      if (left.length() > 0) left.append(",");
      left.append("\\"").append(key).append("\\"");
    }
    System.out.println("{\\"dropped\\":" + dropped + ",\\"extras\\":[" + left + "]}");
  }
}`
};

const TAG = 'android.nfc.extra.TAG';
const MSGS = 'android.nfc.extra.NDEF_MESSAGES';
const ID = 'android.nfc.extra.ID';
const REFERRER = 'android.intent.extra.REFERRER';
const REFERRER_NAME = 'android.intent.extra.REFERRER_NAME';

(hasJdk ? describe : describe.skip)(
    'NfcIntentGuard.dropUntrustedNfcPayload (compiled, needs a JDK)',
    () => {
        let dir: string;

        beforeAll(() => {
            dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zeus-nfc-guard-'));
            const sources = Object.entries(STUBS).map(([file, source]) => {
                const target = path.join(dir, 'src', file);
                fs.mkdirSync(path.dirname(target), { recursive: true });
                fs.writeFileSync(target, source);
                return target;
            });
            execFileSync(
                'javac',
                ['-nowarn', '-d', path.join(dir, 'out'), GUARD, ...sources],
                { stdio: 'pipe' }
            );
        }, 60000);

        afterAll(() => {
            if (dir) fs.rmSync(dir, { recursive: true, force: true });
        });

        const run = (
            systemReferrer: string | null,
            nfcPackage: 'system' | 'app' | 'none',
            ...extras: string[]
        ): { dropped: boolean; extras: string[] } =>
            JSON.parse(
                execFileSync(
                    'java',
                    [
                        '-cp',
                        path.join(dir, 'out'),
                        'GuardHarness',
                        systemReferrer ?? '-',
                        nfcPackage,
                        ...extras
                    ],
                    { encoding: 'utf8', timeout: 10000 }
                )
            );

        it('keeps a tag dispatched by the system NFC service', () => {
            expect(
                run('com.android.nfc', 'system', 'tag', 'msgs', 'id')
            ).toEqual({ dropped: false, extras: [ID, MSGS, TAG] });
        });

        it('keeps a tag from this app (foreground dispatch)', () => {
            expect(run('app.zeusln.zeus', 'system', 'tag', 'msgs')).toEqual({
                dropped: false,
                extras: [MSGS, TAG]
            });
        });

        it('drops a tag another app sent, and keeps its other extras', () => {
            expect(
                run('com.example.app', 'system', 'tag', 'msgs', 'id', 'other')
            ).toEqual({ dropped: true, extras: ['other'] });
        });

        it('drops a tag when the sender is not known', () => {
            expect(run(null, 'system', 'tag', 'msgs', 'other')).toEqual({
                dropped: true,
                extras: ['other']
            });
        });

        it('takes the sender only from an android-app referrer', () => {
            const java = (...args: string[]) =>
                JSON.parse(
                    execFileSync(
                        'java',
                        ['-cp', path.join(dir, 'out'), 'GuardHarness', ...args],
                        { encoding: 'utf8', timeout: 10000 }
                    )
                );
            expect(java('sender', 'android-app://com.android.nfc')).toBe(
                'com.android.nfc'
            );
            expect(java('sender', 'https://com.android.nfc/')).toBeNull();
            expect(java('nointent')).toBe(false);
        });

        it('drops each NFC extra on its own', () => {
            expect(run('com.example.app', 'system', 'msgs')).toEqual({
                dropped: true,
                extras: []
            });
            expect(run('com.example.app', 'system', 'id')).toEqual({
                dropped: true,
                extras: []
            });
        });

        it('ignores a referrer extra naming the NFC service', () => {
            expect(
                run(
                    'com.example.app',
                    'system',
                    'tag',
                    'referrer=android-app://com.android.nfc'
                )
            ).toEqual({ dropped: true, extras: [] });
            expect(
                run(
                    'com.example.app',
                    'system',
                    'tag',
                    'referrerName=android-app://com.android.nfc'
                )
            ).toEqual({ dropped: true, extras: [] });
        });

        it('ignores a referrer extra naming this app', () => {
            expect(
                run(
                    'com.example.app',
                    'system',
                    'tag',
                    'referrer=android-app://app.zeusln.zeus'
                )
            ).toEqual({ dropped: true, extras: [] });
        });

        it('drops a tag from a com.android.nfc that is not a system app', () => {
            expect(run('com.android.nfc', 'app', 'tag')).toEqual({
                dropped: true,
                extras: []
            });
        });

        it('drops a tag from com.android.nfc when it cannot be found', () => {
            expect(run('com.android.nfc', 'none', 'tag')).toEqual({
                dropped: true,
                extras: []
            });
        });

        it('leaves an intent without NFC extras alone', () => {
            expect(
                run(
                    'com.example.app',
                    'system',
                    'other',
                    'referrer=android-app://com.example.app'
                )
            ).toEqual({ dropped: false, extras: [REFERRER, 'other'] });
            expect(run('com.example.app', 'system', 'referrerName=x')).toEqual({
                dropped: false,
                extras: [REFERRER_NAME]
            });
        });

        it('drops all extras when they cannot be read', () => {
            expect(
                run('com.android.nfc', 'system', 'tag', 'other', 'unreadable')
            ).toEqual({ dropped: true, extras: [] });
        });
    }
);
