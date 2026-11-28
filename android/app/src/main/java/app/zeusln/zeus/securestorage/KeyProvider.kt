package app.zeusln.zeus.securestorage

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Log
import java.security.GeneralSecurityException
import java.security.KeyStore
import java.security.ProviderException
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
 * no user authentication. With [strongBox], a new key is made in StrongBox
 * and falls back to a regular key when that fails; otherwise it is a regular
 * key (TEE-backed where the device has one). This is the same key shape
 * react-native-keychain creates for its KeystoreAESGCM_NoAuth entries, so
 * keys made here for the legacy format are accepted by the library too.
 */
class AndroidKeystoreKeyProvider(private val strongBox: Boolean) : KeyProvider {
    private val keyStore: KeyStore by lazy {
        KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
    }

    override fun get(alias: String): SecretKey? =
        (keyStore.getEntry(alias, null) as? KeyStore.SecretKeyEntry)?.secretKey

    override fun getOrCreate(alias: String): SecretKey = get(alias) ?: generate(alias)

    override fun delete(alias: String) {
        if (keyStore.containsAlias(alias)) keyStore.deleteEntry(alias)
    }

    private fun generate(alias: String): SecretKey =
        if (strongBox) {
            withStrongBoxFallback(
                { generate(alias, strongBox = true) },
                { generate(alias, strongBox = false) }
            )
        } else {
            generate(alias, strongBox = false)
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
        if (strongBox) spec.setIsStrongBoxBacked(true)
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE)
        generator.init(spec.build())
        return generator.generateKey()
    }

    companion object {
        private const val ANDROID_KEYSTORE = "AndroidKeyStore"
    }
}

/**
 * Whether new per-entry keys for the legacy format go in StrongBox. Matches
 * react-native-keychain 11, which uses StrongBox only from Android 12 (API
 * 31) and only when the device reports the feature (oblador/
 * react-native-keychain#754, for speed on older phones), so this build makes
 * the same keys master does.
 */
internal fun useStrongBoxForEntryKeys(sdk: Int, hasStrongBox: Boolean): Boolean =
    sdk >= STRONGBOX_MIN_SDK && hasStrongBox

// Build.VERSION_CODES.S
private const val STRONGBOX_MIN_SDK = 31

/**
 * Tries [strongBox], then [regular]. Devices without StrongBox throw
 * StrongBoxUnavailableException (a ProviderException), and some that report
 * it fail with other ProviderException or GeneralSecurityException errors.
 * react-native-keychain fell back on the same two types.
 */
internal fun <T> withStrongBoxFallback(strongBox: () -> T, regular: () -> T): T =
    try {
        strongBox()
    } catch (e: ProviderException) {
        Log.w("ZeusSecureStorage", "StrongBox key not created, using a regular key", e)
        regular()
    } catch (e: GeneralSecurityException) {
        Log.w("ZeusSecureStorage", "StrongBox key not created, using a regular key", e)
        regular()
    }
