package app.zeusln.zeus.securestorage

import javax.crypto.KeyGenerator
import javax.crypto.SecretKey

/** Software AES-256 keys standing in for the Android Keystore. */
class SoftwareKeyProvider : KeyProvider {
    val keys = mutableMapOf<String, SecretKey>()

    override fun get(alias: String): SecretKey? = keys[alias]

    override fun getOrCreate(alias: String): SecretKey =
        keys.getOrPut(alias) {
            KeyGenerator.getInstance("AES").apply { init(256) }.generateKey()
        }

    override fun delete(alias: String) {
        keys.remove(alias)
    }
}

/** In-memory RN_KEYCHAIN. */
class MemoryPrefs : PrefsBackend {
    val values = mutableMapOf<String, String>()
    var failWrites = false

    override fun get(name: String): String? = values[name]
    override fun names(): Set<String> = values.keys.toSet()
    override fun putAll(values: Map<String, String>) {
        if (failWrites) throw IllegalStateException("disk full")
        this.values.putAll(values)
    }
    override fun removeAll(names: Collection<String>) {
        names.forEach { values.remove(it) }
    }
}
