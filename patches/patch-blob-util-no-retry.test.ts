import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';

// The patches are plain ESM run by node at postinstall, so drive them through
// a node child process instead of Jest's transform. Each run works on a copy
// of the 0.25.1 excerpt laid out where the patch expects node_modules.

const FIXTURE = path.join(
    __dirname,
    'fixtures',
    'ReactNativeBlobUtilReq-0.25.1-excerpt.java'
);
const REQ_DIR =
    'node_modules/react-native-blob-util/android/src/main/java/com/ReactNativeBlobUtil';
const MARKER = '// ZEUS PATCH: blob-util-no-retry';

const patchUrl = pathToFileURL(
    path.join(__dirname, 'patch-blob-util-no-retry.mjs')
).href;

const roots: string[] = [];

const makeTree = (source = fs.readFileSync(FIXTURE, 'utf8')) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blob-util-patch-'));
    roots.push(root);
    fs.mkdirSync(path.join(root, REQ_DIR), { recursive: true });
    fs.writeFileSync(
        path.join(root, REQ_DIR, 'ReactNativeBlobUtilReq.java'),
        source
    );
    return root;
};

const readRaw = (root: string) =>
    fs.readFileSync(
        path.join(root, REQ_DIR, 'ReactNativeBlobUtilReq.java'),
        'utf8'
    );

// the upstream file has CRLF line endings; compare with LF
const read = (root: string) => readRaw(root).replace(/\r\n/g, '\n');

const run = (root: string) =>
    execFileSync(
        process.execPath,
        [
            '--input-type=module',
            '-e',
            `const m = await import(${JSON.stringify(
                patchUrl
            )}); m.patchBlobUtilNoRetry();`
        ],
        { cwd: root, encoding: 'utf8', stdio: 'pipe' }
    );

// The upload progress interceptor, from its proceed(req) call to the end of
// its intercept method
const interceptor = (source: string) => {
    const start = source.indexOf('originalResponse = chain.proceed(req);');
    expect(start).toBeGreaterThanOrEqual(0);
    return source.slice(start, source.indexOf('\n            });', start));
};

describe('patch-blob-util-no-retry', () => {
    afterAll(() => {
        roots.forEach((root) =>
            fs.rmSync(root, { recursive: true, force: true })
        );
    });

    it('resends the request after a failure before the patch', () => {
        const body = interceptor(
            fs.readFileSync(FIXTURE, 'utf8').replace(/\r\n/g, '\n')
        );
        expect(body).toContain('return chain.proceed(chain.request());');
    });

    it('rethrows a failure instead of resending the request', () => {
        const root = makeTree();
        run(root);
        const body = interceptor(read(root));

        expect(body).toContain(MARKER);
        expect(body).not.toContain('chain.proceed(chain.request())');
        expect(body.split('chain.proceed(')).toHaveLength(2);
        expect(body).toContain('} catch (IOException e) {');
        expect(body).toContain('throw e;');
    });

    it('still marks socket failures as timeouts', () => {
        const root = makeTree();
        run(root);
        const body = interceptor(read(root));

        expect(body).toContain(
            'if (e instanceof SocketException || e instanceof SocketTimeoutException) {\n                            timeout = true;'
        );
    });

    it('wraps other exceptions so OkHttp reports them through onFailure', () => {
        const root = makeTree();
        run(root);
        const body = interceptor(read(root));
        const other = body.slice(body.indexOf('} catch (Exception ex) {'));

        expect(other).toContain('originalResponse.close();');
        expect(other).toContain('throw new IOException(ex);');
    });

    it('leaves the redirect interceptor alone', () => {
        const root = makeTree();
        run(root);

        expect(read(root)).toContain(
            'redirects.add(chain.request().url().toString());\n                    return chain.proceed(chain.request());'
        );
    });

    it('keeps the CRLF line endings of the upstream file', () => {
        const root = makeTree();
        run(root);

        expect(readRaw(root)).not.toMatch(/[^\r]\n/);
    });

    it('patches a copy with LF line endings', () => {
        const root = makeTree(
            fs.readFileSync(FIXTURE, 'utf8').replace(/\r\n/g, '\n')
        );
        run(root);

        expect(readRaw(root)).not.toContain('\r');
        expect(interceptor(readRaw(root))).not.toContain(
            'chain.proceed(chain.request())'
        );
    });

    it('is idempotent', () => {
        const root = makeTree();
        run(root);
        const once = read(root);
        const output = run(root);

        expect(read(root)).toBe(once);
        expect(output).toContain('Already patched');
        expect(once.split(MARKER)).toHaveLength(2);
    });

    it('fails the install when the interceptor has changed', () => {
        const root = makeTree(
            fs
                .readFileSync(FIXTURE, 'utf8')
                .replace(
                    '} catch (SocketException e) {',
                    '} catch (java.net.SocketException e) {'
                )
        );

        expect(() => run(root)).toThrow(/does not match the expected pattern/);
    });

    it('fails the install when the file is missing', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blob-util-patch-'));
        roots.push(root);

        expect(() => run(root)).toThrow(
            /ReactNativeBlobUtilReq.java not found/
        );
    });
});
