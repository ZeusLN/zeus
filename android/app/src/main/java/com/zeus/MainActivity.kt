package app.zeusln.zeus

import android.app.Activity
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.View
import android.view.WindowManager
import android.widget.Toast
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import java.io.ByteArrayInputStream
import java.io.File
import java.io.FileInputStream
import java.io.IOException
import java.io.InputStream
import java.lang.ref.WeakReference

class MainActivity : ReactActivity() {
    private var useSecureFallback = false
    private var secureFallbackApplied = false

    /**
     * Returns the name of the main component registered from JavaScript. This is used to schedule
     * rendering of the component.
     */
    override fun getMainComponentName(): String = "zeus"

    /**
    * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
    * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
    */
    override fun createReactActivityDelegate(): ReactActivityDelegate =
        DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

    override fun onCreate(savedInstanceState: Bundle?) {
        // Android passes the intent that first started the activity when it is
        // restored after the process was killed (savedInstanceState is set
        // and MainActivity has not been created in this process yet) or when
        // a finished task is reopened from the recent apps. The new JS runtime
        // would handle its deep link, NFC tag or shared image again, so
        // replace it with a launcher intent. A payload JS had not read yet is
        // dropped. A re-creation within the process (a configuration change
        // not listed in configChanges) keeps the intent: JS keeps its state,
        // and the intent already holds the latest link with consumed NFC and
        // share payloads removed.
        val restoredInNewProcess = savedInstanceState != null && !createdInProcess
        if (restoredInNewProcess ||
            ((intent?.flags ?: 0) and Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY) != 0
        ) {
            setIntent(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER))
        }
        createdInProcess = true

        super.onCreate(null)
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            setRecentsScreenshotEnabled(false) // Avoid data leak via recents
        } else {
            useSecureFallback = !disablePreviewScreenshots()
        }

        // With edge-to-edge on, adjustResize no longer shrinks the window for
        // the keyboard on API 30+, so pad the content by the IME height to
        // restore it. Below API 30 the window is still resized, and padding
        // would lift the content a second time.
        // Insets are passed on unconsumed for safe-area handling below.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            ViewCompat.setOnApplyWindowInsetsListener(
                findViewById<View>(android.R.id.content)
            ) { view, insets ->
                val imeBottom = insets.getInsets(WindowInsetsCompat.Type.ime()).bottom
                view.setPadding(0, 0, 0, imeBottom)
                insets
            }
        }

        currentActivity = WeakReference(this@MainActivity)
        started = true
    }

    // API 28 to 32 have no public setRecentsScreenshotEnabled. It was added
    // in API 33 as the public name of the hidden
    // setDisablePreviewScreenshots, which sets the same window manager
    // flag and is open to apps on API 28 to 32 (light greylist on 28,
    // unsupported list without a target SDK limit on 29 to 32). Like
    // setRecentsScreenshotEnabled it leaves user screenshots alone.
    private fun disablePreviewScreenshots(): Boolean =
        try {
            Activity::class.java
                .getMethod("setDisablePreviewScreenshots", Boolean::class.javaPrimitiveType)
                .invoke(this, true)
            true
        } catch (e: Exception) {
            Log.w(TAG, "setDisablePreviewScreenshots failed", e)
            false
        }

    // Fallback if the hidden call fails: mark the window secure while
    // paused, so the snapshot taken when the Home or Recents button hides
    // the activity is blank. It misses the snapshot the launcher takes
    // during a swipe-up gesture, which comes before onPause. FLAG_SECURE
    // set elsewhere is left as is.
    override fun onPause() {
        if (useSecureFallback &&
            (window.attributes.flags and WindowManager.LayoutParams.FLAG_SECURE) == 0
        ) {
            window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
            secureFallbackApplied = true
        }
        super.onPause()
    }

    override fun onResume() {
        super.onResume()
        if (secureFallbackApplied) {
            window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
            secureFallbackApplied = false
        }
    }

    override fun onDestroy() {
        // When activity is destroyed, mark as not started
        // The service's onTaskRemoved will handle stopping services if persistent mode is off
        started = false
        super.onDestroy()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == INTENT_EXPORTCHANBACKUP && resultCode == RESULT_OK) {
            val destUri = data!!.data
            try {
                val `in` = ByteArrayInputStream(tmpChanBackup)
                val out = contentResolver.openOutputStream(destUri!!)
                val buf = ByteArray(1024)
                var len: Int
                while (`in`.read(buf).also { len = it } > 0) {
                    out!!.write(buf, 0, len)
                }
                `in`.close()
                out!!.close()
                tmpChanBackup = ByteArray(0)
            } catch (e: IOException) {
                e.printStackTrace()
            }
        } else if (requestCode == INTENT_EXPORTCHANBACKUPFILE && resultCode == RESULT_OK) {
            val destUri = data!!.data
            val sourceLocation = File("$filesDir/data/chain/bitcoin/mainnet/channel.backup")
            try {
                val `in`: InputStream = FileInputStream(sourceLocation)
                val out = contentResolver.openOutputStream(destUri!!)
                val buf = ByteArray(1024)
                var len: Int
                while (`in`.read(buf).also { len = it } > 0) {
                    out!!.write(buf, 0, len)
                }
                `in`.close()
                out!!.close()
            } catch (e: IOException) {
                Toast.makeText(this, "Error " + e.message, Toast.LENGTH_LONG).show()
            }
        } else if (requestCode == INTENT_EXPORTCHANBACKUPFILETESTNET && resultCode == RESULT_OK) {
            val destUri = data!!.data
            val sourceLocation = File("$filesDir/data/chain/bitcoin/testnet/channel.backup")
            try {
                val `in`: InputStream = FileInputStream(sourceLocation)
                val out = contentResolver.openOutputStream(destUri!!)
                val buf = ByteArray(1024)
                var len: Int
                while (`in`.read(buf).also { len = it } > 0) {
                    out!!.write(buf, 0, len)
                }
                `in`.close()
                out!!.close()
            } catch (e: IOException) {
                Toast.makeText(this, "Error " + e.message, Toast.LENGTH_LONG).show()
            }
        }
    }

    companion object {
        var TAG = "MainActivity"
        var started = false
        private var createdInProcess = false
        var INTENT_EXPORTCHANBACKUP = 101
        var INTENT_EXPORTCHANBACKUPFILE = 102
        var INTENT_EXPORTCHANBACKUPFILETESTNET = 202
        var tmpChanBackup: ByteArray = ByteArray(0)
        var currentActivity: WeakReference<MainActivity>? = null
        val activity: MainActivity?
            get() = currentActivity!!.get()
    }
}