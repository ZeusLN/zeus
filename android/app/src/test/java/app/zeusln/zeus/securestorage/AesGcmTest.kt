package app.zeusln.zeus.securestorage

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test
import javax.crypto.AEADBadTagException

class AesGcmTest {
    private val key = SoftwareKeyProvider().getOrCreate("k")

    @Test
    fun roundTripsWithAFreshIvEachTime() {
        val a = AesGcm.encrypt(key, "secret".toByteArray())
        val b = AesGcm.encrypt(key, "secret".toByteArray())

        assertNotEquals(a.copyOfRange(0, 12).toList(), b.copyOfRange(0, 12).toList())
        // 12-byte IV + 6 bytes + 16-byte tag
        assertEquals(12 + 6 + 16, a.size)
        assertArrayEquals("secret".toByteArray(), AesGcm.decrypt(key, a))
    }

    @Test(expected = AEADBadTagException::class)
    fun rejectsTamperedCiphertext() {
        val blob = AesGcm.encrypt(key, "secret".toByteArray())
        blob[14] = (blob[14].toInt() xor 1).toByte()
        AesGcm.decrypt(key, blob)
    }

    @Test(expected = AEADBadTagException::class)
    fun rejectsTheWrongAuthenticatedData() {
        val blob = AesGcm.encrypt(key, "secret".toByteArray(), "zeus:a".toByteArray())
        AesGcm.decrypt(key, blob, "zeus:b".toByteArray())
    }
}
