package app.zeusln.zeus.securestorage

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import java.security.GeneralSecurityException

class SecureStorageTest {
    @get:Rule
    val tmp = TemporaryFolder()

    private val keys = SoftwareKeyProvider()
    private val prefs = MemoryPrefs()
    private val legacy = LegacyKeychainStore(prefs, keys)
    private val store by lazy { SecureFileStore(File(tmp.root, "zeus-secure"), keys) }
    private val storage by lazy { SecureStorage(store, legacy) }

    @Test
    fun copiesALegacyEntryOnFirstRead() {
        legacy.write("zeus:a", "old")

        assertEquals("old", storage.get("zeus:a"))
        assertEquals("old", store.read("zeus:a"))
        // the legacy entry stays for release K
        assertEquals("old", legacy.read("zeus:a"))
    }

    @Test
    fun prefersTheNewStore() {
        legacy.write("zeus:a", "stale")
        store.write("zeus:a", "current")

        assertEquals("current", storage.get("zeus:a"))
    }

    @Test
    fun writesBothFormats() {
        storage.set("zeus:a", "value")

        assertEquals("value", store.read("zeus:a"))
        assertEquals("value", legacy.read("zeus:a"))
    }

    @Test
    fun keepsTheNewWriteWhenTheLegacyWriteFails() {
        prefs.failWrites = true

        storage.set("zeus:a", "value")

        assertEquals("value", storage.get("zeus:a"))
    }

    @Test
    fun usesTheLegacyCopyWhenTheNewEntryIsUnreadable() {
        storage.set("zeus:a", "value")
        File(tmp.root, "zeus-secure").listFiles()!!.single().writeBytes(byteArrayOf(1, 2, 3))

        assertEquals("value", storage.get("zeus:a"))
        // and repairs the new entry
        assertEquals("value", store.read("zeus:a"))
    }

    @Test(expected = Exception::class)
    fun passesOnAnUnreadableEntryWithNoLegacyCopy() {
        store.write("zeus:a", "value")
        keys.delete(SecureFileStore.KEY_ALIAS)

        storage.get("zeus:a")
    }

    @Test(expected = GeneralSecurityException::class)
    fun passesOnAnUnreadableLegacyEntry() {
        legacy.write("zeus:a", "value")
        keys.delete("zeus:a")

        storage.get("zeus:a")
    }

    @Test
    fun reportsAnEntryInNeitherStoreAsNull() {
        assertNull(storage.get("zeus:absent"))
    }

    @Test
    fun removeAndWipeClearBothStores() {
        storage.set("zeus:a", "1")
        storage.set("zeus:b", "2")

        storage.remove("zeus:a")
        assertNull(storage.get("zeus:a"))

        storage.wipe()
        assertNull(storage.get("zeus:b"))
        assertEquals(emptySet<String>(), prefs.names())
    }
}
