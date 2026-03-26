package app.zeusln.zeus;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;

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
}
