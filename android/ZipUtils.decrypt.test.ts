import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Compiles the real ZipUtils.java against stubs of the React Native bridge
// classes it uses and runs decryptFile in a JVM with a small heap. Skipped
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

// argv: <mode> <dir>. Prints how the promise settled, then whether the
// output file exists.
const PROBE = `import app.zeusln.zeus.ZipUtils;
import com.facebook.react.bridge.Promise;
import java.io.File;
import java.io.RandomAccessFile;
import java.nio.file.Files;
import java.util.Arrays;

public class Probe {
    static class Result implements Promise {
        String settled = "unsettled";
        public void resolve(Object value) { settled = "resolved"; }
        public void reject(String code, String message) { settled = "rejected: " + message; }
        public void reject(String code, String message, Throwable cause) { reject(code, message); }
    }

    static String decrypt(File input, File output, String passphrase) {
        Result result = new Result();
        new ZipUtils(null).decryptFile(input.getPath(), output.getPath(), passphrase, result);
        return result.settled + (output.exists() ? " (output written)" : "");
    }

    // A sparse file of the given length starting with the given version byte
    static File sparse(File dir, long length, int version) throws Exception {
        File file = new File(dir, "sparse.enc");
        try (RandomAccessFile raf = new RandomAccessFile(file, "rw")) {
            raf.setLength(length);
            raf.write(version);
        }
        return file;
    }

    public static void main(String[] args) throws Exception {
        String mode = args[0];
        File dir = new File(args[1]);
        File output = new File(dir, "plain-" + mode);
        long max = 64L * 1024 * 1024;

        if (mode.equals("oversized")) {
            System.out.println(decrypt(sparse(dir, max + 1, 1), output, "pass"));
        } else if (mode.equals("wrong-version")) {
            System.out.println(decrypt(sparse(dir, max, 2), output, "pass"));
        } else if (mode.equals("too-small")) {
            System.out.println(decrypt(sparse(dir, 44, 1), output, "pass"));
        } else if (mode.equals("roundtrip") || mode.equals("wrong-password")) {
            File plain = new File(dir, "plain.txt");
            File enc = new File(dir, "plain.enc");
            byte[] data = new byte[100000];
            for (int i = 0; i < data.length; i++) data[i] = (byte) (i * 31);
            Files.write(plain.toPath(), data);
            Result encrypted = new Result();
            new ZipUtils(null).encryptFile(plain.getPath(), enc.getPath(), "pass", encrypted);
            if (!encrypted.settled.equals("resolved")) throw new AssertionError(encrypted.settled);
            String passphrase = mode.equals("roundtrip") ? "pass" : "other";
            String settled = decrypt(enc, output, passphrase);
            if (output.exists()) {
                settled += Arrays.equals(Files.readAllBytes(output.toPath()), data)
                        ? " matching" : " differing";
            }
            System.out.println(settled);
        } else {
            throw new IllegalArgumentException(mode);
        }
    }
}
`;

(jdk !== null ? describe : describe.skip)(
    'ZipUtils.decryptFile (compiled, needs a JDK)',
    () => {
        let dir: string;

        beforeAll(() => {
            dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zip-decrypt-'));
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

        // A 32 MiB heap cannot hold a 64 MiB file, so these fail with an
        // uncaught OutOfMemoryError if the file is read before it is checked
        const run = (mode: string) => {
            const work = path.join(dir, mode);
            fs.mkdirSync(work);
            try {
                return execFileSync(
                    tool('java'),
                    [
                        '-Xmx32m',
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

        it('rejects a file over the size limit before reading it', () => {
            expect(run('oversized')).toBe(
                'rejected: File too large to be a valid encrypted backup'
            );
        });

        it('checks the version before reading the rest of the file', () => {
            expect(run('wrong-version')).toBe(
                'rejected: Unsupported encryption version: 2'
            );
        });

        it('rejects a file too small to hold the header and tag', () => {
            expect(run('too-small')).toBe(
                'rejected: File too small to be a valid encrypted backup'
            );
        });

        // PBKDF2 runs twice in these, once to encrypt and once to decrypt
        it('decrypts a file encryptFile wrote', () => {
            expect(run('roundtrip')).toBe('resolved (output written) matching');
        }, 30000);

        it('rejects the wrong passphrase without writing output', () => {
            expect(run('wrong-password')).toBe(
                'rejected: Decryption failed. Incorrect seed or corrupted file.'
            );
        }, 30000);
    }
);
