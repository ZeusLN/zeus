package app.zeusln.zeus;

import android.util.Base64;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.security.SecureRandom;
import java.util.LinkedHashSet;
import java.util.Set;
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

    // Upper bound on the total bytes unzipFile writes. The archives it reads
    // are channel backups (lnd's graph directory: channel.db or the SQLite
    // files). A mobile node's database is usually tens to a few hundred MB,
    // so this leaves more than ten times that for an uncompacted one, while
    // a small archive that inflates without end is stopped long before it
    // can fill the phone's storage. The size each entry declares is not
    // used, since it is not checked until the entry has been inflated.
    static final long MAX_UNZIP_BYTES = 4L * 1024 * 1024 * 1024;

    // Upper bound on the entries unzipFile reads, directories included. A
    // channel backup is zipFolder's copy of the top-level files in lnd's
    // graph directory: channel.db, sphinxreplay.db and wtclient.db for bolt,
    // or channel.sqlite and lnd.sqlite with their -wal and -shm files for
    // SQLite, so six at most. 64 leaves room for files a later lnd
    // adds. Without a bound, an archive of empty entries never reaches
    // MAX_UNZIP_BYTES: each entry costs a file creation and a place in the
    // cleanup list, so millions of them fill the heap or the directory.
    static final int MAX_UNZIP_ENTRIES = 64;

    @ReactMethod
    public void unzipFile(String zipPath, String destDirPath, Promise promise) {
        // Files this call has created, deleted again if it fails. A set, so
        // an entry name repeated in the archive is held once.
        Set<File> written = new LinkedHashSet<>();
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

            long total = 0;
            int entries = 0;
            try (ZipInputStream zis = new ZipInputStream(new FileInputStream(zipFile))) {
                byte[] buffer = new byte[8192];

                ZipEntry entry;
                while ((entry = zis.getNextEntry()) != null) {
                    if (++entries > MAX_UNZIP_ENTRIES) {
                        throw new IOException("Zip file has more than " + MAX_UNZIP_ENTRIES + " entries");
                    }
                    if (entry.isDirectory()) continue;

                    String name = entry.getName();
                    // Prevent zip slip
                    File outFile = new File(destDir, name);
                    if (!outFile.getCanonicalPath().startsWith(destDir.getCanonicalPath() + File.separator)) {
                        throw new IOException("Zip entry outside target directory: " + name);
                    }

                    written.add(outFile);
                    try (FileOutputStream fos = new FileOutputStream(outFile)) {
                        int len;
                        while ((len = zis.read(buffer)) > 0) {
                            total += len;
                            if (total > MAX_UNZIP_BYTES) {
                                throw new IOException("Zip contents exceed the maximum size of " + MAX_UNZIP_BYTES + " bytes");
                            }
                            fos.write(buffer, 0, len);
                        }
                    }
                    zis.closeEntry();
                }
            }

            promise.resolve(null);
        } catch (Exception e) {
            for (File file : written) {
                file.delete();
            }
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

            byte[] plaintext = readAllBytes(inFile);
            byte[] output = encryptBytes(plaintext, passphrase);

            File outFile = new File(outputPath);
            File parentDir = outFile.getParentFile();
            if (parentDir != null && !parentDir.exists()) {
                parentDir.mkdirs();
            }

            try (FileOutputStream fos = new FileOutputStream(outFile)) {
                fos.write(output);
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
            byte[] plaintext = decryptBytes(fileData, passphrase);

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

    @ReactMethod
    public void encryptString(String plaintextBase64, String passphrase, Promise promise) {
        try {
            byte[] plaintext = Base64.decode(plaintextBase64, Base64.DEFAULT);
            byte[] output = encryptBytes(plaintext, passphrase);
            promise.resolve(Base64.encodeToString(output, Base64.NO_WRAP));
        } catch (Exception e) {
            promise.reject("ERR_ENCRYPT", e.getMessage(), e);
        }
    }

    @ReactMethod
    public void decryptString(String dataBase64, String passphrase, Promise promise) {
        try {
            byte[] fileData = Base64.decode(dataBase64, Base64.DEFAULT);
            byte[] plaintext = decryptBytes(fileData, passphrase);
            promise.resolve(Base64.encodeToString(plaintext, Base64.NO_WRAP));
        } catch (javax.crypto.AEADBadTagException e) {
            promise.reject("ERR_DECRYPT", "Decryption failed. Incorrect seed or corrupted file.");
        } catch (Exception e) {
            promise.reject("ERR_DECRYPT", e.getMessage(), e);
        }
    }

    private byte[] encryptBytes(byte[] plaintext, String passphrase) throws Exception {
        SecureRandom random = new SecureRandom();
        byte[] salt = new byte[SALT_LEN];
        random.nextBytes(salt);
        byte[] iv = new byte[IV_LEN];
        random.nextBytes(iv);

        SecretKeySpec key = deriveKey(passphrase, salt);

        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_BITS, iv));

        // ciphertext includes the GCM tag appended by Android
        byte[] ciphertext = cipher.doFinal(plaintext);

        byte[] output = new byte[1 + SALT_LEN + IV_LEN + ciphertext.length];
        output[0] = (byte) VERSION;
        System.arraycopy(salt, 0, output, 1, SALT_LEN);
        System.arraycopy(iv, 0, output, 1 + SALT_LEN, IV_LEN);
        System.arraycopy(ciphertext, 0, output, 1 + SALT_LEN + IV_LEN, ciphertext.length);
        return output;
    }

    private byte[] decryptBytes(byte[] fileData, String passphrase) throws Exception {
        int minLen = 1 + SALT_LEN + IV_LEN + GCM_TAG_BITS / 8;
        if (fileData.length < minLen) {
            throw new IllegalArgumentException("File too small to be a valid encrypted backup");
        }

        int version = fileData[0] & 0xFF;
        if (version != VERSION) {
            throw new IllegalArgumentException("Unsupported encryption version: " + version);
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

        return cipher.doFinal(ciphertext);
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
