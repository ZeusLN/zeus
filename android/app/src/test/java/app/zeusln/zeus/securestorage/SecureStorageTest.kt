package app.zeusln.zeus.securestorage

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
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
    private val dir by lazy { File(tmp.root, "zeus-secure") }
    private val store by lazy { SecureFileStore(dir, keys) }
    private val storage by lazy { SecureStorage(store, legacy) }

    private fun corruptNewEntry() =
        dir.listFiles()!!.single { it.name.length == 64 }.writeBytes(byteArrayOf(1, 2, 3))

    @Test
    fun copiesALegacyEntryOnFirstRead() {
        legacy.write("zeus:a", "old")

        assertEquals("old", storage.get("zeus:a"))
        assertEquals("old", store.read("zeus:a"))
        // the legacy entry stays for release K
        assertEquals("old", legacy.read("zeus:a"))
    }

    @Test
    fun writesBothFormats() {
        storage.set("zeus:a", "value")

        assertEquals("value", store.read("zeus:a"))
        assertEquals("value", legacy.read("zeus:a"))
    }

    @Test
    fun seesAChangeAnOlderBuildMade() {
        storage.set("zeus:a", "v1")
        // an older build writes only the legacy format
        legacy.write("zeus:a", "v2")

        assertEquals("v2", storage.get("zeus:a"))
        assertEquals("v2", store.read("zeus:a"))
    }

    @Test
    fun seesADeleteAnOlderBuildMade() {
        storage.set("zeus:a", "v1")
        legacy.delete("zeus:a")

        assertNull(storage.get("zeus:a"))
    }

    @Test
    fun failsTheWriteWhenTheLegacyWriteFails() {
        storage.set("zeus:a", "old")
        prefs.failWrites = true

        assertThrows(IllegalStateException::class.java) { storage.set("zeus:a", "new") }
        assertEquals("old", storage.get("zeus:a"))
    }

    @Test
    fun keepsTheWriteWhenOnlyTheNewCopyFails() {
        storage.set("zeus:a", "old")
        dir.deleteRecursively()
        dir.writeText("not a directory")

        storage.set("zeus:a", "new")

        assertEquals("new", legacy.read("zeus:a"))
    }

    @Test
    fun repairsAnUnreadableNewCopyFromTheLegacyEntry() {
        storage.set("zeus:a", "value")
        corruptNewEntry()

        assertEquals("value", storage.get("zeus:a"))
        assertEquals("value", store.read("zeus:a"))
    }

    @Test
    fun usesTheNewCopyWhenTheLegacyEntryIsUnreadable() {
        storage.set("zeus:a", "value")
        keys.delete("zeus:a")

        assertEquals("value", storage.get("zeus:a"))
    }

    @Test
    fun passesOnAnUnreadableLegacyEntryWithNoNewCopy() {
        legacy.write("zeus:a", "value")
        keys.delete("zeus:a")

        assertThrows(GeneralSecurityException::class.java) { storage.get("zeus:a") }
    }

    @Test
    fun passesOnTheLegacyErrorWhenBothCopiesAreUnreadable() {
        storage.set("zeus:a", "value")
        keys.delete("zeus:a")
        corruptNewEntry()

        assertThrows(GeneralSecurityException::class.java) { storage.get("zeus:a") }
    }

    @Test
    fun reportsAnEntryInNeitherStoreAsNull() {
        assertNull(storage.get("zeus:absent"))
    }

    @Test
    fun prefersTheNewStoreOnceALaterReleaseMarksIt() {
        storage.set("zeus:a", "stale")
        store.write("zeus:a", "current")
        File(dir, SecureFileStore.AUTHORITATIVE_MARKER).createNewFile()

        assertEquals("current", storage.get("zeus:a"))
        // and its own writes keep the legacy copy for older builds
        storage.set("zeus:a", "next")
        assertEquals("next", legacy.read("zeus:a"))
    }

    @Test
    fun removeAndWipeClearBothStores() {
        storage.set("zeus:a", "1")
        storage.set("zeus:b", "2")

        storage.remove("zeus:a")
        assertNull(storage.get("zeus:a"))
        assertNull(store.read("zeus:a"))

        storage.wipe()
        assertNull(storage.get("zeus:b"))
        assertEquals(emptySet<String>(), prefs.names())
        assertEquals(false, dir.exists())
    }
}
