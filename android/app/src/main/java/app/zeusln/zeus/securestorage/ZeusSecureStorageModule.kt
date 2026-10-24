package app.zeusln.zeus.securestorage

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.util.concurrent.Executors

/**
 * Encrypted key-value storage for credentials, replacing
 * react-native-keychain (#4471). Android has no synchronizable partition,
 * so `cloudSync` is accepted for parity with iOS and ignored, as
 * react-native-keychain did.
 */
class ZeusSecureStorageModule(context: ReactApplicationContext) :
    ReactContextBaseJavaModule(context) {

    // One thread, so reads and writes of an entry never interleave
    private val executor = Executors.newSingleThreadExecutor()

    private val storage: SecureStorage by lazy {
        val keys = AndroidKeystoreKeyProvider()
        SecureStorage(
            SecureFileStore(File(context.filesDir, STORE_DIR), keys),
            LegacyKeychainStore(DataStorePrefsBackend(context), keys)
        )
    }

    override fun getName() = NAME

    private fun run(promise: Promise, block: () -> Any?) {
        executor.execute {
            try {
                promise.resolve(block())
            } catch (e: Exception) {
                promise.reject(ERROR_CODE, e.message ?: e.javaClass.simpleName, e)
            }
        }
    }

    @ReactMethod
    fun get(server: String, cloudSync: Boolean, promise: Promise) =
        run(promise) { storage.get(server) }

    @ReactMethod
    fun set(server: String, value: String, cloudSync: Boolean, promise: Promise) =
        run(promise) { storage.set(server, value); true }

    @ReactMethod
    fun remove(server: String, cloudSync: Boolean, promise: Promise) =
        run(promise) { storage.remove(server); true }

    /** iOS only. Android has no partitions to list. */
    @ReactMethod
    fun listServers(cloudSync: Boolean, promise: Promise) =
        run(promise) { Arguments.createArray() }

    @ReactMethod
    fun wipe(promise: Promise) = run(promise) { storage.wipe(); true }

    companion object {
        const val NAME = "ZeusSecureStorage"
        const val STORE_DIR = "zeus-secure"
        private const val ERROR_CODE = "E_SECURE_STORAGE"
    }
}
