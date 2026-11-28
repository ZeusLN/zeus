package app.zeusln.zeus.securestorage

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import java.security.GeneralSecurityException
import javax.crypto.AEADBadTagException

class SecureFileStoreTest {
    @get:Rule
    val tmp = TemporaryFolder()

    private val keys = SoftwareKeyProvider()
    private fun store() = SecureFileStore(File(tmp.root, "zeus-secure"), keys)

    @Test
    fun readsBackWhatItWrote() {
        val store = store()
        store.write("zeus:zeus-settings-v2", "{\"nodes\":[]}")

        assertEquals("{\"nodes\":[]}", store.read("zeus:zeus-settings-v2"))
    }

    @Test
    fun reportsAMissingEntryAsNull() {
        assertNull(store().read("zeus:absent"))
    }

    @Test
    fun overwritesInPlaceAndLeavesNoTemporaryFile() {
        val store = store()
        store.write("zeus:a", "one")
        store.write("zeus:a", "two")

        assertEquals("two", store.read("zeus:a"))
        val files = File(tmp.root, "zeus-secure").listFiles()!!.map { it.name }
        assertEquals(1, files.size)
        assertFalse(files.single().endsWith(".tmp"))
    }

    @Test
    fun storesNoPlaintextAndHidesEntryNames() {
        val store = store()
        store.write("zeus:seed", "abandon abandon about")

        val file = File(tmp.root, "zeus-secure").listFiles()!!.single()
        assertFalse(file.name.contains("seed"))
        assertFalse(String(file.readBytes(), Charsets.ISO_8859_1).contains("abandon"))
    }

    @Test(expected = AEADBadTagException::class)
    fun rejectsAFileMovedOntoAnotherEntry() {
        val store = store()
        store.write("zeus:a", "for a")
        store.write("zeus:b", "for b")
        val dir = File(tmp.root, "zeus-secure")
        val (first, second) = dir.listFiles()!!.sortedBy { it.name }
        first.copyTo(second, overwrite = true)

        // whichever entry now holds the other's file fails to decrypt
        listOf("zeus:a", "zeus:b").forEach { store.read(it) }
    }

    @Test(expected = GeneralSecurityException::class)
    fun treatsAMissingKeyAsAnErrorNotAMissingEntry() {
        val store = store()
        store.write("zeus:a", "value")
        keys.delete(SecureFileStore.KEY_ALIAS)

        store.read("zeus:a")
    }

    @Test
    fun deletesAnEntry() {
        val store = store()
        store.write("zeus:a", "value")
        store.delete("zeus:a")

        assertNull(store.read("zeus:a"))
        assertFalse(store.exists("zeus:a"))
    }

    @Test
    fun wipeRemovesEveryEntryAndTheKey() {
        val store = store()
        store.write("zeus:a", "value")

        store.wipe()

        assertFalse(File(tmp.root, "zeus-secure").exists())
        assertTrue(keys.keys.isEmpty())
    }
}
