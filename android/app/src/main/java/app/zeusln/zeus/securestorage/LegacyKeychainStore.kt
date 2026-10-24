package app.zeusln.zeus.securestorage

import java.security.GeneralSecurityException
import java.util.Base64

/** Key-value access to react-native-keychain's RN_KEYCHAIN DataStore file. */
interface PrefsBackend {
    fun get(name: String): String?
    fun names(): Set<String>
    fun putAll(values: Map<String, String>)
    fun removeAll(names: Collection<String>)
}

/**
 * Reads and writes entries in react-native-keychain 10's Android format, so
 * existing data stays readable after the library is removed and an older
 * build still sees what this one writes (#4471, release K).
 *
 * Per entry (the library calls the server its service):
 * - `<server>:u` username, `<server>:p` password, `<server>:c` cipher name
 * - values are android.util.Base64.DEFAULT of AES-GCM output (12-byte IV,
 *   ciphertext, 128-bit tag), no authenticated data
 * - one Keystore key per entry, under the server name
 *
 * Every ZEUS entry was written by react-native-keychain 9.2.2 or 10.0.0
 * with KeystoreAESGCM_NoAuth. Any other cipher name is reported as an error
 * rather than guessed at.
 */
class LegacyKeychainStore(private val prefs: PrefsBackend, private val keys: KeyProvider) {

    @Throws(GeneralSecurityException::class)
    fun read(server: String): String? {
        val password = prefs.get(passwordName(server)) ?: return null
        val cipher = prefs.get(cipherName(server))
        if (cipher != CIPHER_NAME) {
            throw GeneralSecurityException("Unsupported legacy cipher: $cipher")
        }
        val key = keys.get(server)
            ?: throw GeneralSecurityException("Legacy entry key is missing")
        return String(AesGcm.decrypt(key, decode(password)), Charsets.UTF_8)
    }

    @Throws(GeneralSecurityException::class)
    fun write(server: String, value: String) {
        val key = keys.getOrCreate(server)
        prefs.putAll(
            mapOf(
                usernameName(server) to encode(AesGcm.encrypt(key, server.toByteArray(Charsets.UTF_8))),
                passwordName(server) to encode(AesGcm.encrypt(key, value.toByteArray(Charsets.UTF_8))),
                cipherName(server) to CIPHER_NAME
            )
        )
    }

    fun delete(server: String) {
        prefs.removeAll(listOf(usernameName(server), passwordName(server), cipherName(server)))
        keys.delete(server)
    }

    /** Delete every entry and its key. */
    fun wipe() {
        val all = prefs.names()
        all.filter { it.endsWith(":c") }
            .forEach { keys.delete(it.removeSuffix(":c")) }
        prefs.removeAll(all)
    }

    companion object {
        const val CIPHER_NAME = "KeystoreAESGCM_NoAuth"
        const val DATASTORE_NAME = "RN_KEYCHAIN"

        fun usernameName(server: String) = "$server:u"
        fun passwordName(server: String) = "$server:p"
        fun cipherName(server: String) = "$server:c"

        // android.util.Base64.DEFAULT: 76-character lines ending in "\n".
        // The MIME decoder ignores the line breaks.
        fun encode(bytes: ByteArray): String =
            Base64.getMimeEncoder(76, "\n".toByteArray()).encodeToString(bytes) + "\n"

        fun decode(value: String): ByteArray = Base64.getMimeDecoder().decode(value)
    }
}
