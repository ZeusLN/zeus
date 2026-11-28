import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';

// The patch is plain ESM run by node at postinstall, so drive it through a
// node child process instead of Jest's transform. Each run works on a copy
// of op-sqlite 18.2.5's podspec laid out where the patch expects it.

const FIXTURE = path.join(__dirname, 'fixtures', 'op-sqlite-18.2.5.podspec');
const PODSPEC_DIR = 'node_modules/@op-engineering/op-sqlite';
const MARKER = '# ZEUS PATCH: op-sqlite-commoncrypto';

const makeTree = (source?: string) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'op-sqlite-patch-'));
    if (source !== undefined) {
        fs.mkdirSync(path.join(root, PODSPEC_DIR), { recursive: true });
        fs.writeFileSync(
            path.join(root, PODSPEC_DIR, 'op-sqlite.podspec'),
            source
        );
    }
    return root;
};

const read = (root: string) =>
    fs.readFileSync(path.join(root, PODSPEC_DIR, 'op-sqlite.podspec'), 'utf8');

const run = (root: string) =>
    execFileSync(
        process.execPath,
        [
            '--input-type=module',
            '-e',
            `const m = await import(${JSON.stringify(
                pathToFileURL(
                    path.join(__dirname, 'patch-op-sqlite-commoncrypto.mjs')
                ).href
            )}); m.patchOpSqliteCommonCrypto();`
        ],
        { cwd: root, encoding: 'utf8', stdio: 'pipe' }
    );

// The podspec's SQLCipher branch, from its `if` to the next `elsif`
const sqlcipherBranch = (source: string) => {
    const start = source.indexOf('if use_sqlcipher then');
    expect(start).toBeGreaterThanOrEqual(0);
    return source.slice(start, source.indexOf('elsif use_turso', start));
};

describe('patch-op-sqlite-commoncrypto', () => {
    const roots: string[] = [];
    const tree = (source?: string) => {
        const root = makeTree(source);
        roots.push(root);
        return root;
    };
    const fixture = fs.readFileSync(FIXTURE, 'utf8');

    afterAll(() => {
        roots.forEach((root) =>
            fs.rmSync(root, { recursive: true, force: true })
        );
    });

    it('starts from a podspec that builds SQLCipher against OpenSSL-Universal', () => {
        const branch = sqlcipherBranch(fixture);

        expect(branch).toContain('s.dependency "OpenSSL-Universal"');
        expect(branch).not.toContain('SQLCIPHER_CRYPTO_CC');
    });

    it('selects CommonCrypto and drops the OpenSSL dependency', () => {
        const root = tree(fixture);

        run(root);

        const branch = sqlcipherBranch(read(root));
        expect(read(root)).not.toContain('OpenSSL-Universal');
        expect(branch).toContain(
            'xcconfig[:GCC_PREPROCESSOR_DEFINITIONS] += " SQLCIPHER_CRYPTO_CC NDEBUG=1"'
        );
        expect(branch).toContain('s.ios.frameworks = "Security"');
        expect(branch).toContain(MARKER);
    });

    it('leaves the other backends alone', () => {
        const root = tree(fixture);

        run(root);

        const patched = read(root);
        const after = (source: string) =>
            source.slice(source.indexOf('elsif use_turso'));
        expect(after(patched)).toBe(after(fixture));
    });

    it('is a no-op on an already patched podspec', () => {
        const root = tree(fixture);
        run(root);
        const once = read(root);

        expect(run(root)).toContain('Already patched');
        expect(read(root)).toBe(once);
    });

    it('fails the install when the SQLCipher block has changed', () => {
        const root = tree(
            fixture.replace(
                's.dependency "OpenSSL-Universal"',
                's.dependency "OpenSSL-Universal", "~> 3.6"'
            )
        );

        expect(() => run(root)).toThrow(/does not match the expected pattern/);
        expect(read(root)).toContain('"OpenSSL-Universal", "~> 3.6"');
    });

    it('fails the install when op-sqlite is missing', () => {
        expect(() => run(tree())).toThrow(/op-sqlite.podspec not found/);
    });
});
