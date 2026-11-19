package app.zeusln.zeus.securestorage

import android.content.Context
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File

/**
 * Encrypted key-value storage for credentials, replacing
 * react-native-keychain (#4471). Android has no synchronizable partition,
 * so `cloudSync` is accepted for parity with iOS and ignored, as
 * react-native-keychain did.
 */
class ZeusSecureStorageModule(context: ReactApplicationContext) :
    ReactContextBaseJavaModule(context) {

    // One thread, so reads and writes of an entry never interleave
    private val runner = SerialRunner()

    private val storage: SecureStorage by lazy { open(context) }

    override fun getName() = NAME

    // The React instance is going away (a reload or a rebuilt React host).
    // Queued calls still finish, then the thread ends instead of leaking.
    override fun invalidate() {
        runner.shutdown()
        super.invalidate()
    }

    private fun run(promise: Promise, block: () -> Any?) =
        runner.run(
            block,
            { promise.resolve(it) },
            { promise.reject(ERROR_CODE, it.message ?: it.javaClass.simpleName, it) }
        )

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

        /** The app's store, for native code outside this module. Blocks on I/O. */
        @JvmStatic
        fun open(context: Context): SecureStorage {
            val keys = AndroidKeystoreKeyProvider()
            return SecureStorage(
                SecureFileStore(File(context.filesDir, STORE_DIR), keys),
                LegacyKeychainStore(DataStorePrefsBackend(context), keys)
            )
        }
    }
}
