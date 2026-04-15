package app.zeusln.zeus;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.security.SecureRandom;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;

import javax.crypto.Cipher;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;

public class ZipUtils extends ReactContextBaseJavaModule {

    public ZipUtils(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return "ZipUtils";
    }

    @ReactMethod
    public void zipFolder(String sourceDirPath, String destZipPath, Promise promise) {
        try {
            File sourceDir = new File(sourceDirPath);
            if (!sourceDir.exists() || !sourceDir.isDirectory()) {
                promise.reject("ERR_ZIP", "Source directory does not exist: " + sourceDirPath);
                return;
            }

            File destFile = new File(destZipPath);
            File parentDir = destFile.getParentFile();
            if (parentDir != null && !parentDir.exists()) {
                parentDir.mkdirs();
            }

            FileOutputStream fos = new FileOutputStream(destFile);
            ZipOutputStream zos = new ZipOutputStream(fos);
            byte[] buffer = new byte[8192];

            File[] files = sourceDir.listFiles();
            if (files != null) {
                for (File file : files) {
                    if (!file.isFile()) continue;
                    ZipEntry entry = new ZipEntry(file.getName());
                    zos.putNextEntry(entry);
                    FileInputStream fis = new FileInputStream(file);
                    int len;
                    while ((len = fis.read(buffer)) > 0) {
                        zos.write(buffer, 0, len);
                    }
                    fis.close();
                    zos.closeEntry();
                }
            }

            zos.close();
            fos.close();
            promise.resolve(null);
        } catch (Exception e) {
            promise.reject("ERR_ZIP", e.getMessage(), e);
        }
    }

    @ReactMethod
    public void unzipFile(String zipPath, String destDirPath, Promise promise) {
        try {
            File zipFile = new File(zipPath);
            if (!zipFile.exists()) {
                promise.reject("ERR_UNZIP", "Zip file does not exist: " + zipPath);
                return;
            }

            File destDir = new File(destDirPath);
            if (!destDir.exists()) {
                destDir.mkdirs();
            }

            FileInputStream fis = new FileInputStream(zipFile);
            ZipInputStream zis = new ZipInputStream(fis);
            byte[] buffer = new byte[8192];

            ZipEntry entry;
            while ((entry = zis.getNextEntry()) != null) {
                if (entry.isDirectory()) continue;

                String name = entry.getName();
                // Prevent zip slip
                File outFile = new File(destDir, name);
                if (!outFile.getCanonicalPath().startsWith(destDir.getCanonicalPath() + File.separator)) {
                    zis.close();
                    fis.close();
                    promise.reject("ERR_UNZIP", "Zip entry outside target directory: " + name);
                    return;
                }

                FileOutputStream fos = new FileOutputStream(outFile);
                int len;
                while ((len = zis.read(buffer)) > 0) {
                    fos.write(buffer, 0, len);
                }
                fos.close();
                zis.closeEntry();
            }

            zis.close();
            fis.close();
            promise.resolve(null);
        } catch (Exception e) {
            promise.reject("ERR_UNZIP", e.getMessage(), e);
        }
    }

    private static final int VERSION = 0x01;
    private static final int SALT_LEN = 16;
    private static final int IV_LEN = 12;
    private static final int GCM_TAG_BITS = 128;
    private static final int PBKDF2_ITERATIONS = 100000;
    private static final int KEY_LEN_BITS = 256;

    @ReactMethod
    public void encryptFile(String inputPath, String outputPath, String passphrase, Promise promise) {
        try {
            File inFile = new File(inputPath);
            if (!inFile.exists()) {
                promise.reject("ERR_ENCRYPT", "Input file does not exist: " + inputPath);
                return;
            }

            SecureRandom random = new SecureRandom();
            byte[] salt = new byte[SALT_LEN];
            random.nextBytes(salt);
            byte[] iv = new byte[IV_LEN];
            random.nextBytes(iv);

            SecretKeySpec key = deriveKey(passphrase, salt);

            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_BITS, iv));

            byte[] plaintext = readAllBytes(inFile);
            byte[] ciphertext = cipher.doFinal(plaintext);

            File outFile = new File(outputPath);
            File parentDir = outFile.getParentFile();
            if (parentDir != null && !parentDir.exists()) {
                parentDir.mkdirs();
            }

            try (FileOutputStream fos = new FileOutputStream(outFile)) {
                fos.write(VERSION);
                fos.write(salt);
                fos.write(iv);
                fos.write(ciphertext); // includes GCM tag appended by Android
            }

            promise.resolve(null);
        } catch (Exception e) {
            promise.reject("ERR_ENCRYPT", e.getMessage(), e);
        }
    }

    @ReactMethod
    public void decryptFile(String inputPath, String outputPath, String passphrase, Promise promise) {
        try {
            File inFile = new File(inputPath);
            if (!inFile.exists()) {
                promise.reject("ERR_DECRYPT", "Input file does not exist: " + inputPath);
                return;
            }

            byte[] fileData = readAllBytes(inFile);
            int minLen = 1 + SALT_LEN + IV_LEN + GCM_TAG_BITS / 8;
            if (fileData.length < minLen) {
                promise.reject("ERR_DECRYPT", "File too small to be a valid encrypted backup");
                return;
            }

            int version = fileData[0] & 0xFF;
            if (version != VERSION) {
                promise.reject("ERR_DECRYPT", "Unsupported encryption version: " + version);
                return;
            }

            byte[] salt = new byte[SALT_LEN];
            System.arraycopy(fileData, 1, salt, 0, SALT_LEN);
            byte[] iv = new byte[IV_LEN];
            System.arraycopy(fileData, 1 + SALT_LEN, iv, 0, IV_LEN);

            int headerLen = 1 + SALT_LEN + IV_LEN;
            int ciphertextLen = fileData.length - headerLen;
            byte[] ciphertext = new byte[ciphertextLen];
            System.arraycopy(fileData, headerLen, ciphertext, 0, ciphertextLen);

            SecretKeySpec key = deriveKey(passphrase, salt);

            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_BITS, iv));

            byte[] plaintext = cipher.doFinal(ciphertext);

            File outFile = new File(outputPath);
            File parentDir = outFile.getParentFile();
            if (parentDir != null && !parentDir.exists()) {
                parentDir.mkdirs();
            }

            try (FileOutputStream fos = new FileOutputStream(outFile)) {
                fos.write(plaintext);
            }

            promise.resolve(null);
        } catch (javax.crypto.AEADBadTagException e) {
            promise.reject("ERR_DECRYPT", "Decryption failed. Incorrect seed or corrupted file.");
        } catch (Exception e) {
            promise.reject("ERR_DECRYPT", e.getMessage(), e);
        }
    }

    private SecretKeySpec deriveKey(String passphrase, byte[] salt) throws Exception {
        PBEKeySpec spec = new PBEKeySpec(passphrase.toCharArray(), salt, PBKDF2_ITERATIONS, KEY_LEN_BITS);
        SecretKeyFactory factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256");
        byte[] keyBytes = factory.generateSecret(spec).getEncoded();
        spec.clearPassword();
        return new SecretKeySpec(keyBytes, "AES");
    }

    private byte[] readAllBytes(File file) throws Exception {
        try (FileInputStream fis = new FileInputStream(file)) {
            byte[] data = new byte[(int) file.length()];
            int offset = 0;
            while (offset < data.length) {
                int read = fis.read(data, offset, data.length - offset);
                if (read < 0) break;
                offset += read;
            }
            return data;
        }
    }
}
