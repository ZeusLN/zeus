package app.zeusln.zeus.securestorage

import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.security.GeneralSecurityException
import java.security.MessageDigest

/**
 * ZEUS's own encrypted store: one file per entry under [dir], so a write
 * touches one small file instead of rewriting everything (#4471).
 *
 * File: a version byte, then AES-GCM output (IV, ciphertext, tag) under one
 * Keystore key. The entry name is authenticated data, so a file renamed or
 * copied onto another entry fails to decrypt. Writes go to a temporary file
 * that is synced and renamed into place, so a crash leaves either the old
 * value or the new one.
 */
class SecureFileStore(private val dir: File, private val keys: KeyProvider) {

    fun exists(name: String): Boolean = fileFor(name).exists()

    /**
     * The stored value, or null when there is no entry. An entry that exists
     * but cannot be decrypted throws: it is an error, not a missing value.
     */
    @Throws(IOException::class, GeneralSecurityException::class)
    fun read(name: String): String? {
        val file = fileFor(name)
        if (!file.exists()) return null
        val bytes = file.readBytes()
        if (bytes.isEmpty() || bytes[0] != VERSION) {
            throw IOException("Unknown entry format")
        }
        val key = keys.get(KEY_ALIAS)
            ?: throw GeneralSecurityException("Storage key is missing")
        val plaintext = AesGcm.decrypt(
            key,
            bytes.copyOfRange(1, bytes.size),
            name.toByteArray(Charsets.UTF_8)
        )
        return String(plaintext, Charsets.UTF_8)
    }

    @Throws(IOException::class, GeneralSecurityException::class)
    fun write(name: String, value: String) {
        if (!dir.exists() && !dir.mkdirs()) throw IOException("Cannot create $dir")
        val key = keys.getOrCreate(KEY_ALIAS)
        val blob = byteArrayOf(VERSION) +
            AesGcm.encrypt(
                key,
                value.toByteArray(Charsets.UTF_8),
                name.toByteArray(Charsets.UTF_8)
            )
        val target = fileFor(name)
        val temp = File(dir, target.name + TEMP_SUFFIX)
        FileOutputStream(temp).use { out ->
            out.write(blob)
            out.fd.sync()
        }
        if (!temp.renameTo(target)) {
            temp.delete()
            throw IOException("Cannot move entry into place")
        }
    }

    fun delete(name: String) {
        val target = fileFor(name)
        File(dir, target.name + TEMP_SUFFIX).delete()
        if (target.exists() && !target.delete()) {
            throw IOException("Cannot delete entry")
        }
    }

    /** Delete every entry and the key. */
    fun wipe() {
        dir.deleteRecursively()
        keys.delete(KEY_ALIAS)
    }

    private fun fileFor(name: String): File {
        val digest = MessageDigest.getInstance("SHA-256")
            .digest(name.toByteArray(Charsets.UTF_8))
        return File(dir, digest.joinToString("") { "%02x".format(it) })
    }

    companion object {
        const val KEY_ALIAS = "zeus_secure_storage_v1"
        private const val VERSION: Byte = 1
        private const val TEMP_SUFFIX = ".tmp"
    }
}
