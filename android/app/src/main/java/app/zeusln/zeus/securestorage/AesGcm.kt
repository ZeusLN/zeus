package app.zeusln.zeus.securestorage

import javax.crypto.Cipher
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * AES-GCM with the IV written in front of the ciphertext:
 * 12-byte IV, then ciphertext with a 128-bit tag. This is also the layout
 * react-native-keychain 10 uses for KeystoreAESGCM_NoAuth.
 */
object AesGcm {
    const val IV_LENGTH = 12
    private const val TAG_BITS = 128
    private const val TRANSFORMATION = "AES/GCM/NoPadding"

    fun encrypt(key: SecretKey, plaintext: ByteArray, aad: ByteArray? = null): ByteArray {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        // The provider picks a random IV
        cipher.init(Cipher.ENCRYPT_MODE, key)
        aad?.let { cipher.updateAAD(it) }
        val iv = cipher.iv
        require(iv.size == IV_LENGTH) { "Unexpected IV length ${iv.size}" }
        return iv + cipher.doFinal(plaintext)
    }

    fun decrypt(key: SecretKey, blob: ByteArray, aad: ByteArray? = null): ByteArray {
        require(blob.size > IV_LENGTH) { "Ciphertext too short" }
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(
            Cipher.DECRYPT_MODE,
            key,
            GCMParameterSpec(TAG_BITS, blob, 0, IV_LENGTH)
        )
        aad?.let { cipher.updateAAD(it) }
        return cipher.doFinal(blob, IV_LENGTH, blob.size - IV_LENGTH)
    }
}
