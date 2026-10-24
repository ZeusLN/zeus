package app.zeusln.zeus.securestorage

import android.util.Log

/**
 * The read and write rules for release K, independent of React Native so
 * they can be unit tested.
 *
 * The legacy store stays the source of truth in this release. Every write
 * here goes to it, and an older build installed over this one writes only
 * to it, so it is never behind the new store.
 *
 * - Reads use the legacy entry and copy it into the new store, read back,
 *   when the two differ. A missing legacy entry is missing, even if the
 *   new store still has a copy: an older build may have deleted it.
 * - An unreadable legacy entry falls back to the new copy. With no
 *   readable copy the legacy error is passed on: an unreadable entry is
 *   never reported as missing.
 * - Writes go to the legacy store first and fail if it fails. A failed
 *   new-store copy is logged and repaired by the next read.
 *
 * Once a later release marks the new store authoritative
 * ([SecureFileStore.isAuthoritative]), reads and writes go to it first and
 * the legacy copy is kept up to date where possible.
 */
class SecureStorage(
    private val store: SecureFileStore,
    private val legacy: LegacyKeychainStore
) {
    fun get(name: String): String? = synchronized(LOCK) { getLocked(name) }

    private fun getLocked(name: String): String? {
        if (store.isAuthoritative()) return getFromNewStore(name)

        val value = try {
            legacy.read(name)
        } catch (e: Exception) {
            val copy = readNewOrNull(name) ?: throw e
            Log.w(TAG, "Unreadable legacy entry, using its new copy", e)
            return copy
        }
        if (value != null && readNewOrNull(name) != value) copy(name, value)
        return value
    }

    fun set(name: String, value: String) = synchronized(LOCK) { setLocked(name, value) }

    private fun setLocked(name: String, value: String) {
        if (store.isAuthoritative()) {
            store.write(name, value)
            writeLegacyCopy(name, value)
            return
        }
        legacy.write(name, value)
        try {
            store.write(name, value)
        } catch (e: Exception) {
            Log.w(TAG, "New copy not written", e)
        }
    }

    fun remove(name: String) = synchronized(LOCK) {
        store.delete(name)
        legacy.delete(name)
    }

    fun wipe() = synchronized(LOCK) {
        store.wipe()
        legacy.wipe()
    }

    private fun getFromNewStore(name: String): String? {
        val current = try {
            store.read(name)
        } catch (e: Exception) {
            val fallback = legacy.read(name) ?: throw e
            Log.w(TAG, "Unreadable entry, using its legacy copy", e)
            copy(name, fallback)
            return fallback
        }
        return current ?: legacy.read(name)?.also { copy(name, it) }
    }

    private fun writeLegacyCopy(name: String, value: String) {
        try {
            legacy.write(name, value)
        } catch (e: Exception) {
            Log.w(TAG, "Legacy copy not written", e)
        }
    }

    private fun readNewOrNull(name: String): String? =
        try {
            store.read(name)
        } catch (e: Exception) {
            null
        }

    // A failed copy is not an error for the caller: the legacy entry stays
    // and the next read tries again.
    private fun copy(name: String, value: String) {
        try {
            store.write(name, value)
            if (store.read(name) != value) {
                Log.w(TAG, "Copied entry did not read back")
                store.delete(name)
            }
        } catch (e: Exception) {
            Log.w(TAG, "Could not copy legacy entry", e)
        }
    }

    companion object {
        private const val TAG = "ZeusSecureStorage"

        // Shared by every instance: ZeusSecureStorageModule.open gives native
        // callers their own instance over the same files, and a read can
        // write (the mirror copy), so all calls in the process take turns.
        private val LOCK = Any()
    }
}
