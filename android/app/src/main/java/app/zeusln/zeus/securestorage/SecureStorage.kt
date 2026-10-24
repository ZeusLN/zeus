package app.zeusln.zeus.securestorage

import android.util.Log

/**
 * The read and write rules for release K, independent of React Native so
 * they can be unit tested.
 *
 * - The new store is read first. A missing entry falls back to the legacy
 *   store; a legacy value found there is copied into the new store and read
 *   back before it is trusted.
 * - An unreadable new entry also falls back to the legacy copy, which this
 *   release keeps current. With no legacy copy, the error is passed on: an
 *   unreadable entry is never reported as missing.
 * - Writes go to the new store, then to the legacy format so an older build
 *   still sees them. A failed legacy write is logged, not returned.
 */
class SecureStorage(
    private val store: SecureFileStore,
    private val legacy: LegacyKeychainStore
) {
    fun get(name: String): String? {
        val current = try {
            store.read(name)
        } catch (e: Exception) {
            val fallback = legacy.read(name) ?: throw e
            Log.w(TAG, "Unreadable entry, using its legacy copy", e)
            copy(name, fallback)
            return fallback
        }
        if (current != null) return current

        val old = legacy.read(name) ?: return null
        copy(name, old)
        return old
    }

    fun set(name: String, value: String) {
        store.write(name, value)
        try {
            legacy.write(name, value)
        } catch (e: Exception) {
            Log.w(TAG, "Legacy copy not written", e)
        }
    }

    fun remove(name: String) {
        store.delete(name)
        legacy.delete(name)
    }

    fun wipe() {
        store.wipe()
        legacy.wipe()
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
    }
}
