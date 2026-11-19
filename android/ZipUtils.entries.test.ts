import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Compiles the real ZipUtils.java against stubs of the React Native bridge
// classes it uses and runs unzipFile in a JVM with a small heap. Skipped
// when no JDK is installed.
const findJdk = (): string | null => {
    const candidates = [
        ...(process.env.JAVA_HOME
            ? [path.join(process.env.JAVA_HOME, 'bin')]
            : []),
        '/opt/homebrew/opt/openjdk@21/bin',
        // javac on the PATH
        ''
    ];
    for (const dir of candidates) {
        const javac = dir ? path.join(dir, 'javac') : 'javac';
        try {
            execFileSync(javac, ['-version'], { stdio: 'pipe' });
            return dir;
        } catch {}
    }
    return null;
};
const jdk = findJdk();
const tool = (name: string) => (jdk ? path.join(jdk, name) : name);

const ZIP_UTILS = path.join(
    __dirname,
    'app/src/main/java/app/zeusln/zeus/ZipUtils.java'
);

const BRIDGE_STUBS: { [name: string]: string } = {
    ReactApplicationContext: 'public class ReactApplicationContext {}',
    ReactContextBaseJavaModule: `public abstract class ReactContextBaseJavaModule {
    public ReactContextBaseJavaModule(ReactApplicationContext context) {}
    public abstract String getName();
}`,
    ReactMethod: 'public @interface ReactMethod {}',
    Promise: `public interface Promise {
    void resolve(Object value);
    void reject(String code, String message);
    void reject(String code, String message, Throwable cause);
}`
};

const ANDROID_BASE64_STUB = `package android.util;

public class Base64 {
    public static final int DEFAULT = 0;
    public static final int NO_WRAP = 2;

    public static byte[] decode(String str, int flags) {
        return java.util.Base64.getMimeDecoder().decode(str);
    }

    public static String encodeToString(byte[] input, int flags) {
        return java.util.Base64.getEncoder().encodeToString(input);
    }
}
`;

// argv: <mode> <dir>. Prints how the promise settled, then the files left
// in the destination directory.
const PROBE = `import app.zeusln.zeus.ZipUtils;
import com.facebook.react.bridge.Promise;
import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.Arrays;

public class Probe {
    static class Result implements Promise {
        String settled = "unsettled";
        public void resolve(Object value) { settled = "resolved"; }
        public void reject(String code, String message) { settled = "rejected: " + message; }
        public void reject(String code, String message, Throwable cause) { reject(code, message); }
    }

    // Local headers of empty STORED entries, then an empty end of central
    // directory record. ZipInputStream reads only the local headers, and
    // java.util.zip.ZipOutputStream refuses to write a repeated name, so
    // the archive is written by hand. name(i) gives the i-th entry's name.
    interface Names { String name(int i); }

    static void emptyEntries(File file, int count, Names names) throws Exception {
        try (OutputStream out = new BufferedOutputStream(new FileOutputStream(file))) {
            for (int i = 0; i < count; i++) {
                byte[] name = names.name(i).getBytes(StandardCharsets.US_ASCII);
                ByteBuffer local = ByteBuffer.allocate(30 + name.length)
                        .order(ByteOrder.LITTLE_ENDIAN);
                local.putInt(0, 0x04034b50);
                local.putShort(4, (short) 20);
                local.putShort(26, (short) name.length);
                local.position(30);
                local.put(name);
                out.write(local.array());
            }
            ByteBuffer end = ByteBuffer.allocate(22).order(ByteOrder.LITTLE_ENDIAN);
            end.putInt(0, 0x06054b50);
            out.write(end.array());
        }
    }

    static String unzip(File zip, File dest) {
        Result result = new Result();
        new ZipUtils(null).unzipFile(zip.getPath(), dest.getPath(), result);
        String[] left = dest.list();
        if (left == null) left = new String[0];
        Arrays.sort(left);
        return result.settled + " | " + left.length + " files"
                + (left.length > 0 && left.length <= 8 ? " " + String.join(",", left) : "");
    }

    // A backup as the app writes it: zipFolder over a graph directory
    static String backup(File dir, String[] files) throws Exception {
        File graph = new File(dir, "graph");
        graph.mkdirs();
        for (int i = 0; i < files.length; i++) {
            byte[] data = new byte[50000 + i];
            for (int j = 0; j < data.length; j++) data[j] = (byte) (j * (i + 7));
            Files.write(new File(graph, files[i]).toPath(), data);
        }
        File zip = new File(dir, "backup.zip");
        Result zipped = new Result();
        new ZipUtils(null).zipFolder(graph.getPath(), zip.getPath(), zipped);
        if (!zipped.settled.equals("resolved")) throw new AssertionError(zipped.settled);
        File dest = new File(dir, "restored");
        String settled = unzip(zip, dest);
        for (String name : files) {
            byte[] a = Files.readAllBytes(new File(graph, name).toPath());
            byte[] b = Files.readAllBytes(new File(dest, name).toPath());
            if (!Arrays.equals(a, b)) return settled + " differing " + name;
        }
        return settled + " matching";
    }

    public static void main(String[] args) throws Exception {
        String mode = args[0];
        File dir = new File(args[1]);
        File zip = new File(dir, "input.zip");
        // A long destination path makes each File the cleanup list keeps
        // larger, so the unbounded list fills the 16 MiB heap sooner
        StringBuilder deep = new StringBuilder(dir.getPath());
        for (int i = 0; i < 8; i++) deep.append("/").append("d".repeat(24));
        File dest = new File(deep.toString());

        if (mode.equals("duplicates")) {
            emptyEntries(zip, 100000, i -> "channel.db");
            System.out.println(unzip(zip, dest));
        } else if (mode.equals("distinct")) {
            emptyEntries(zip, 1000, i -> "file" + i);
            System.out.println(unzip(zip, dest));
        } else if (mode.equals("at-limit")) {
            emptyEntries(zip, 64, i -> "file" + i);
            System.out.println(unzip(zip, dest));
        } else if (mode.equals("over-limit")) {
            emptyEntries(zip, 65, i -> "file" + i);
            System.out.println(unzip(zip, dest));
        } else if (mode.equals("bolt")) {
            System.out.println(backup(dir, new String[] {
                "channel.db", "sphinxreplay.db", "wtclient.db"
            }));
        } else if (mode.equals("sqlite")) {
            System.out.println(backup(dir, new String[] {
                "channel.sqlite", "channel.sqlite-shm", "channel.sqlite-wal",
                "lnd.sqlite", "lnd.sqlite-shm", "lnd.sqlite-wal"
            }));
        } else {
            throw new IllegalArgumentException(mode);
        }
    }
}
`;

(jdk !== null ? describe : describe.skip)(
    'ZipUtils.unzipFile entry limit (compiled, needs a JDK)',
    () => {
        let dir: string;

        beforeAll(() => {
            dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zip-entries-'));
            const bridge = path.join(dir, 'src/com/facebook/react/bridge');
            fs.mkdirSync(bridge, { recursive: true });
            const sources = Object.entries(BRIDGE_STUBS).map(([name, body]) => {
                const file = path.join(bridge, `${name}.java`);
                fs.writeFileSync(
                    file,
                    `package com.facebook.react.bridge;\n\n${body}\n`
                );
                return file;
            });
            // ZipUtils uses android.util.Base64 for encryptString and
            // decryptString
            const util = path.join(dir, 'src/android/util');
            fs.mkdirSync(util, { recursive: true });
            const base64 = path.join(util, 'Base64.java');
            fs.writeFileSync(base64, ANDROID_BASE64_STUB);
            sources.push(base64);
            const probe = path.join(dir, 'src/Probe.java');
            fs.writeFileSync(probe, PROBE);
            execFileSync(
                tool('javac'),
                ['-d', path.join(dir, 'classes'), ...sources, ZIP_UTILS, probe],
                { stdio: 'pipe' }
            );
        }, 60000);

        afterAll(() => {
            if (dir) fs.rmSync(dir, { recursive: true, force: true });
        });

        // An uncaught OutOfMemoryError ends the JVM with a non-zero status,
        // which execFileSync throws on
        const run = (mode: string) => {
            const work = path.join(dir, mode);
            fs.mkdirSync(work);
            try {
                return execFileSync(
                    tool('java'),
                    [
                        '-Xmx16m',
                        '-cp',
                        path.join(dir, 'classes'),
                        'Probe',
                        mode,
                        work
                    ],
                    { encoding: 'utf8', stdio: 'pipe' }
                ).trim();
            } finally {
                fs.rmSync(work, { recursive: true, force: true });
            }
        };

        const overLimit = 'rejected: Zip file has more than 64 entries';

        it('rejects repeated empty entries and leaves no output', () => {
            expect(run('duplicates')).toBe(`${overLimit} | 0 files`);
        }, 60000);

        it('rejects many distinct empty entries and leaves no files', () => {
            expect(run('distinct')).toBe(`${overLimit} | 0 files`);
        });

        it('rejects the 65th entry before creating its file', () => {
            expect(run('over-limit')).toBe(`${overLimit} | 0 files`);
        });

        it('extracts 64 entries', () => {
            expect(run('at-limit')).toBe('resolved | 64 files');
        });

        it('restores a bolt backup written by zipFolder', () => {
            expect(run('bolt')).toBe(
                'resolved | 3 files channel.db,sphinxreplay.db,wtclient.db matching'
            );
        });

        it('restores a SQLite backup written by zipFolder', () => {
            expect(run('sqlite')).toBe(
                'resolved | 6 files channel.sqlite,channel.sqlite-shm,channel.sqlite-wal,lnd.sqlite,lnd.sqlite-shm,lnd.sqlite-wal matching'
            );
        });
    }
);
