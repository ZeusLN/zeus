package app.zeusln.zeus.cashudevkit

import android.util.Log
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * React Native Package for CashuDevKit Module
 */
class CashuDevKitPackage : ReactPackage {

    companion object {
        private const val TAG = "CashuDevKitPackage"

        /**
         * Check if the CDK native library is available
         */
        fun isAvailable(): Boolean {
            return try {
                Class.forName("org.cashudevkit.MultiMintWallet")
                true
            } catch (e: ClassNotFoundException) {
                Log.w(TAG, "CashuDevKit library not available: ${e.message}")
                false
            } catch (e: NoClassDefFoundError) {
                Log.w(TAG, "CashuDevKit library not found: ${e.message}")
                false
            }
        }
    }

    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return if (isAvailable()) {
            try {
                listOf(CashuDevKitModule(reactContext))
            } catch (e: Exception) {
                Log.e(TAG, "Failed to create CashuDevKitModule: ${e.message}")
                emptyList()
            } catch (e: NoClassDefFoundError) {
                Log.e(TAG, "CashuDevKit classes not found: ${e.message}")
                emptyList()
            }
        } else {
            Log.i(TAG, "CashuDevKit not available, skipping module registration")
            emptyList()
        }
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
