package app.zeusln.zeus;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.nfc.NfcAdapter;
import android.os.Bundle;
import android.util.Log;

/*
 * MainActivity is exported for the launcher, deep links and NFC dispatch, so
 * any installed app can start it with an NFC action and a Tag it built itself
 * (Tag.CREATOR is public, and an NDEF tag's cached message is read from the
 * Tag's extras). This removes the NFC extras from an intent unless it came
 * from the system NFC service or from this app.
 *
 * The system NFC service (AOSP packages/apps/Nfc, also the NFC mainline
 * module) starts the matching activity from its NfcRootActivity, so the
 * sender is com.android.nfc. An in-app scan (react-native-nfc-manager's
 * foreground dispatch) arrives through a PendingIntent this app created, so
 * the sender is this app. Intent data is kept: an NDEF URI record arrives as
 * intent data, which any app can already send as a deep link.
 */
final class NfcIntentGuard {
  static final String TAG = "NfcIntentGuard";
  static final String NFC_SERVICE_PACKAGE = "com.android.nfc";

  private NfcIntentGuard() {}

  /*
   * Call from onCreate with the launch intent, or from onNewIntent after
   * setIntent(intent): Activity.getReferrer() reads the activity's current
   * intent, and reports the sender of a new intent only while onNewIntent
   * runs. Returns true if anything was removed.
   */
  static boolean dropUntrustedNfcPayload(Activity activity, Intent intent) {
    if (intent == null) {
      return false;
    }
    try {
      if (!intent.hasExtra(NfcAdapter.EXTRA_TAG)
          && !intent.hasExtra(NfcAdapter.EXTRA_NDEF_MESSAGES)
          && !intent.hasExtra(NfcAdapter.EXTRA_ID)) {
        return false;
      }

      // getReferrer() returns these extras, which the sender sets, before
      // the sender the system recorded
      intent.removeExtra(Intent.EXTRA_REFERRER);
      intent.removeExtra(Intent.EXTRA_REFERRER_NAME);

      String sender = senderPackage(activity.getReferrer());
      if (isTrustedSender(activity, sender)) {
        return false;
      }

      intent.removeExtra(NfcAdapter.EXTRA_TAG);
      intent.removeExtra(NfcAdapter.EXTRA_NDEF_MESSAGES);
      intent.removeExtra(NfcAdapter.EXTRA_ID);
      Log.w(TAG, "Dropped NFC extras sent by " + sender);
      return true;
    } catch (RuntimeException e) {
      // e.g. BadParcelableException from an extra this app cannot unparcel
      Log.w(TAG, "Dropped unreadable extras of an NFC intent", e);
      intent.replaceExtras((Bundle) null);
      return true;
    }
  }

  static String senderPackage(Uri referrer) {
    if (referrer == null || !"android-app".equals(referrer.getScheme())) {
      return null;
    }
    return referrer.getHost();
  }

  static boolean isTrustedSender(Context context, String sender) {
    if (sender == null) {
      return false;
    }
    if (sender.equals(context.getPackageName())) {
      return true;
    }
    if (!sender.equals(NFC_SERVICE_PACKAGE)) {
      return false;
    }
    // On a device without the NFC service an app could take its package name
    try {
      ApplicationInfo info =
          context.getPackageManager().getApplicationInfo(NFC_SERVICE_PACKAGE, 0);
      return (info.flags & ApplicationInfo.FLAG_SYSTEM) != 0;
    } catch (PackageManager.NameNotFoundException e) {
      return false;
    }
  }
}
