package app.zeusln.zeus

import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import dev.doubledot.doki.ui.DokiActivity
import java.io.ByteArrayInputStream
import java.io.File
import java.io.FileInputStream
import java.io.IOException
import java.io.InputStream
import java.lang.ref.WeakReference

class MainActivity : ReactActivity() {
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
        super.onCreate(null)
        currentActivity = WeakReference(this@MainActivity)
        started = true
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == INTENT_COPYLNDLOG && resultCode == RESULT_OK) {
            val destUri = data!!.data
            val sourceLocation = File("$filesDir/logs/bitcoin/mainnet/lnd.log")
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
        } else if (requestCode == INTENT_EXPORTCHANBACKUP && resultCode == RESULT_OK) {
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

    fun showMsg() {
        startActivity(Intent(this@MainActivity, DokiActivity::class.java))
    }

    companion object {
        var TAG = "MainActivity"
        var started = false
        var INTENT_COPYLNDLOG = 100
        var INTENT_EXPORTCHANBACKUP = 101
        var INTENT_EXPORTCHANBACKUPFILE = 102
        var INTENT_COPYLNDLOGTESTNET = 200
        var INTENT_EXPORTCHANBACKUPFILETESTNET = 202
        var tmpChanBackup: ByteArray = ByteArray(0)
        var currentActivity: WeakReference<MainActivity>? = null
        val activity: MainActivity?
            get() = currentActivity!!.get()
    }
}