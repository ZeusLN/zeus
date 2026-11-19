package app.zeusln.zeus.securestorage

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test
import java.security.KeyStoreException
import java.security.ProviderException

class StrongBoxFallbackTest {
    @Test
    fun usesStrongBoxWhenItWorks() {
        assertEquals("strongbox", withStrongBoxFallback({ "strongbox" }, { "regular" }))
    }

    @Test
    fun fallsBackOnAProviderException() {
        // StrongBoxUnavailableException and the failures some devices report
        assertEquals(
            "regular",
            withStrongBoxFallback({ throw ProviderException("keymint error") }, { "regular" })
        )
    }

    @Test
    fun fallsBackOnAGeneralSecurityException() {
        assertEquals(
            "regular",
            withStrongBoxFallback({ throw KeyStoreException("no strongbox") }, { "regular" })
        )
    }

    @Test
    fun passesOnOtherErrors() {
        assertThrows(IllegalStateException::class.java) {
            withStrongBoxFallback({ throw IllegalStateException("bug") }, { "regular" })
        }
    }

    @Test
    fun passesOnARegularKeyFailure() {
        assertThrows(KeyStoreException::class.java) {
            withStrongBoxFallback<String>(
                { throw ProviderException("no strongbox") },
                { throw KeyStoreException("keystore down") }
            )
        }
    }
}
