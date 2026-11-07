package app.zeusln.zeus;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import java.util.Arrays;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

// PBKDF2-HMAC-SHA256 for the app-lock verifiers (utils/LockVerifierUtils).
// The derivation runs here rather than in JS because a pure-JS KDF under
// Hermes takes seconds per attempt.
//
// The secret arrives as hex of its UTF-8 bytes and PBKDF2 is computed over
// those bytes with an HMAC loop (RFC 8018 section 5.2).
// SecretKeyFactory("PBKDF2WithHmacSHA256") takes a char[] and leaves the
// byte encoding to the provider. The loop over the platform's native
// HmacSHA256 (Conscrypt) was also faster: on an API 36 emulator it took
// 60-130 ms for 100,000 iterations, the BouncyCastle factory 450-500 ms.
public class LockKdf extends ReactContextBaseJavaModule {

    private static final int HASH_LEN = 32;
    private static final int MAX_KEY_LEN = 64;

    // Two threads so the primary and duress checks of one unlock attempt
    // run at the same time. React methods are called serially on the
    // native modules thread, so the work must not run there.
    private static final ExecutorService EXECUTOR = Executors.newFixedThreadPool(2);

    public LockKdf(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return "LockKdf";
    }

    @ReactMethod
    public void pbkdf2Sha256(
            String secretHex,
            String saltHex,
            double iterations,
            double keyLen,
            Promise promise) {
        final int iters = (int) iterations;
        final int len = (int) keyLen;
        if (iters < 1 || iters != iterations || len < 1 || len > MAX_KEY_LEN || len != keyLen) {
            promise.reject("ERR_LOCK_KDF", "Invalid PBKDF2 parameters");
            return;
        }
        EXECUTOR.execute(() -> {
            byte[] secret = null;
            try {
                secret = fromHex(secretHex);
                byte[] salt = fromHex(saltHex);
                if (secret.length == 0 || salt.length == 0) {
                    promise.reject("ERR_LOCK_KDF", "Empty secret or salt");
                    return;
                }
                promise.resolve(toHex(derive(secret, salt, iters, len)));
            } catch (Exception e) {
                promise.reject("ERR_LOCK_KDF", e.getMessage(), e);
            } finally {
                if (secret != null) Arrays.fill(secret, (byte) 0);
            }
        });
    }

    static byte[] derive(byte[] secret, byte[] salt, int iterations, int keyLen)
            throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret, "HmacSHA256"));
        int blocks = (keyLen + HASH_LEN - 1) / HASH_LEN;
        byte[] out = new byte[keyLen];
        byte[] u = new byte[HASH_LEN];
        byte[] t = new byte[HASH_LEN];
        for (int block = 1; block <= blocks; block++) {
            // U1 = HMAC(secret, salt || INT_32_BE(block))
            mac.update(salt);
            mac.update(new byte[] {
                (byte) (block >>> 24),
                (byte) (block >>> 16),
                (byte) (block >>> 8),
                (byte) block
            });
            mac.doFinal(u, 0);
            System.arraycopy(u, 0, t, 0, HASH_LEN);
            // Uj = HMAC(secret, Uj-1); T = U1 ^ U2 ^ ... ^ Uc
            for (int j = 1; j < iterations; j++) {
                mac.update(u);
                mac.doFinal(u, 0);
                for (int k = 0; k < HASH_LEN; k++) t[k] ^= u[k];
            }
            int offset = (block - 1) * HASH_LEN;
            System.arraycopy(t, 0, out, offset, Math.min(HASH_LEN, keyLen - offset));
        }
        Arrays.fill(u, (byte) 0);
        Arrays.fill(t, (byte) 0);
        return out;
    }

    private static byte[] fromHex(String hex) {
        if (hex == null || hex.length() % 2 != 0) {
            throw new IllegalArgumentException("Invalid hex");
        }
        byte[] out = new byte[hex.length() / 2];
        for (int i = 0; i < out.length; i++) {
            int hi = Character.digit(hex.charAt(2 * i), 16);
            int lo = Character.digit(hex.charAt(2 * i + 1), 16);
            if (hi < 0 || lo < 0) throw new IllegalArgumentException("Invalid hex");
            out[i] = (byte) ((hi << 4) | lo);
        }
        return out;
    }

    private static String toHex(byte[] bytes) {
        char[] digits = "0123456789abcdef".toCharArray();
        char[] out = new char[bytes.length * 2];
        for (int i = 0; i < bytes.length; i++) {
            out[2 * i] = digits[(bytes[i] >> 4) & 0xf];
            out[2 * i + 1] = digits[bytes[i] & 0xf];
        }
        return new String(out);
    }
}
