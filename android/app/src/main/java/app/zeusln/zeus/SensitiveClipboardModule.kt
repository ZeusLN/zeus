package app.zeusln.zeus

import android.content.ClipData
import android.content.ClipDescription
import android.content.ClipboardManager
import android.content.Context
import android.os.Build
import android.os.PersistableBundle
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

// Copies secrets (seed phrases, channel backups) for utils/ClipboardUtils.
// The clip is marked sensitive, so Android 13+ hides its text in the
// clipboard preview that appears after a copy. The timed clear stays in JS:
// Android 10+ only lets the app with window focus read the clipboard, and
// ClipboardUtils waits for focus before checking that the clip is still ours.
class SensitiveClipboardModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "SensitiveClipboard"

    // expiresInMs is used by the iOS module; Android clears from JS
    @ReactMethod
    fun setString(value: String, expiresInMs: Double, promise: Promise) {
        try {
            val clipboard = reactApplicationContext
                .getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            val clip = ClipData.newPlainText("", value)
            clip.description.extras = PersistableBundle().apply {
                putBoolean(IS_SENSITIVE_KEY, true)
            }
            clipboard.setPrimaryClip(clip)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("ERR_SENSITIVE_CLIPBOARD", e.message, e)
        }
    }

    companion object {
        // ClipDescription.EXTRA_IS_SENSITIVE is API 33+. Below that the same
        // key is set as a string, as the Android clipboard docs suggest.
        private val IS_SENSITIVE_KEY =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU)
                ClipDescription.EXTRA_IS_SENSITIVE
            else
                "android.content.extra.IS_SENSITIVE"
    }
}
