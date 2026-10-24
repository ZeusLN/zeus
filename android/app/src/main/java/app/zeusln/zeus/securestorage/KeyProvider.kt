package app.zeusln.zeus.securestorage

import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.security.keystore.StrongBoxUnavailableException
import java.security.KeyStore
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey

/** Source of the AES keys the stores encrypt with, so tests can use software keys. */
interface KeyProvider {
    /** The key under [alias], or null if there is none. */
    fun get(alias: String): SecretKey?

    /** The key under [alias], creating an AES-256-GCM key if there is none. */
    fun getOrCreate(alias: String): SecretKey

    fun delete(alias: String)
}

/**
 * Keys in the Android Keystore: AES-256, GCM, no padding, randomized IVs and
 * no user authentication. StrongBox is used when the device has it. This is
 * the same key shape react-native-keychain 10 creates for its
 * KeystoreAESGCM_NoAuth entries, so keys made here for the legacy format are
 * accepted by the library too.
 */
class AndroidKeystoreKeyProvider : KeyProvider {
    private val keyStore: KeyStore by lazy {
        KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
    }

    override fun get(alias: String): SecretKey? =
        (keyStore.getEntry(alias, null) as? KeyStore.SecretKeyEntry)?.secretKey

    override fun getOrCreate(alias: String): SecretKey = get(alias) ?: generate(alias)

    override fun delete(alias: String) {
        if (keyStore.containsAlias(alias)) keyStore.deleteEntry(alias)
    }

    private fun generate(alias: String): SecretKey {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            try {
                return generate(alias, strongBox = true)
            } catch (e: StrongBoxUnavailableException) {
                // fall through to a regular hardware-backed key
            }
        }
        return generate(alias, strongBox = false)
    }

    private fun generate(alias: String, strongBox: Boolean): SecretKey {
        val spec = KeyGenParameterSpec.Builder(
            alias,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setRandomizedEncryptionRequired(true)
            .setKeySize(256)
        if (strongBox && Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            spec.setIsStrongBoxBacked(true)
        }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE)
        generator.init(spec.build())
        return generator.generateKey()
    }

    companion object {
        private const val ANDROID_KEYSTORE = "AndroidKeyStore"
    }
}
