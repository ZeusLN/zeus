package app.zeusln.zeus.securestorage

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.security.GeneralSecurityException

class LegacyKeychainStoreTest {
    private val keys = SoftwareKeyProvider()
    private val prefs = MemoryPrefs()
    private val legacy = LegacyKeychainStore(prefs, keys)

    // An entry laid out as react-native-keychain 10 writes it
    private fun writeAsLibrary(server: String, value: String) {
        val key = keys.getOrCreate(server)
        prefs.values["$server:u"] =
            LegacyKeychainStore.encode(AesGcm.encrypt(key, server.toByteArray()))
        prefs.values["$server:p"] =
            LegacyKeychainStore.encode(AesGcm.encrypt(key, value.toByteArray()))
        prefs.values["$server:c"] = "KeystoreAESGCM_NoAuth"
    }

    @Test
    fun readsAnEntryInTheLibraryFormat() {
        writeAsLibrary("zeus:zeus-settings-v2", "{\"nodes\":[1]}")

        assertEquals("{\"nodes\":[1]}", legacy.read("zeus:zeus-settings-v2"))
    }

    @Test
    fun reportsAMissingEntryAsNull() {
        assertNull(legacy.read("zeus:absent"))
    }

    @Test(expected = GeneralSecurityException::class)
    fun refusesOtherCiphers() {
        writeAsLibrary("zeus:a", "value")
        prefs.values["zeus:a:c"] = "KeystoreAESCBC"

        legacy.read("zeus:a")
    }

    @Test(expected = GeneralSecurityException::class)
    fun treatsAMissingKeyAsAnError() {
        writeAsLibrary("zeus:a", "value")
        keys.delete("zeus:a")

        legacy.read("zeus:a")
    }

    @Test
    fun writesWhatTheLibraryCanRead() {
        legacy.write("zeus:a", "value")

        assertEquals("KeystoreAESGCM_NoAuth", prefs.values["zeus:a:c"])
        assertEquals("zeus:a", String(AesGcm.decrypt(keys.get("zeus:a")!!, LegacyKeychainStore.decode(prefs.values["zeus:a:u"]!!))))
        assertEquals("value", String(AesGcm.decrypt(keys.get("zeus:a")!!, LegacyKeychainStore.decode(prefs.values["zeus:a:p"]!!))))
    }

    @Test
    fun encodesLikeAndroidBase64Default() {
        // 60 bytes -> 80 base64 characters: a 76-character line, then 4,
        // each ending in a newline, as android.util.Base64.DEFAULT writes
        val encoded = LegacyKeychainStore.encode(ByteArray(60) { it.toByte() })
        val lines = encoded.split("\n")

        assertEquals(listOf(76, 4, 0), lines.map { it.length })
        assertTrue(encoded.endsWith("\n"))
    }

    @Test
    fun deleteAndWipeRemoveEntriesAndKeys() {
        writeAsLibrary("zeus:a", "1")
        writeAsLibrary("zeus:b", "2")

        legacy.delete("zeus:a")
        assertNull(prefs.values["zeus:a:p"])
        assertNull(keys.get("zeus:a"))

        legacy.wipe()
        assertTrue(prefs.values.isEmpty())
        assertTrue(keys.keys.isEmpty())
    }
}
