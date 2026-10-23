import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';

// The patches are plain ESM run by node at postinstall, so drive them through
// a node child process instead of Jest's transform. Each run works on a copy
// of the 10.0.0 excerpt laid out where the patches expect node_modules.

const FIXTURE = path.join(
    __dirname,
    'fixtures',
    'RNKeychainManager-10.0.0-excerpt.m'
);
const MANAGER = 'node_modules/react-native-keychain/ios/RNKeychainManager';
const MARKER = '// ZEUS PATCH: keychain-atomic-update';

const patchUrl = (name: string) =>
    pathToFileURL(path.join(__dirname, name)).href;

const makeTree = (source = fs.readFileSync(FIXTURE, 'utf8')) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'keychain-patch-'));
    fs.mkdirSync(path.join(root, MANAGER), { recursive: true });
    fs.writeFileSync(path.join(root, MANAGER, 'RNKeychainManager.m'), source);
    return root;
};

const read = (root: string) =>
    fs.readFileSync(path.join(root, MANAGER, 'RNKeychainManager.m'), 'utf8');

// Runs the named patch functions in order with cwd set to root
const run = (root: string, calls: Array<[string, string]>) => {
    const script = calls
        .map(
            ([file, fn], i) =>
                `const m${i} = await import(${JSON.stringify(
                    patchUrl(file)
                )}); m${i}.${fn}();`
        )
        .join('\n');
    return execFileSync(
        process.execPath,
        ['--input-type=module', '-e', script],
        { cwd: root, encoding: 'utf8', stdio: 'pipe' }
    );
};

const ATOMIC: [string, string] = [
    'patch-keychain-atomic-update.mjs',
    'patchKeychainAtomicUpdate'
];
const CLOUDSYNC: [string, string] = [
    'patch-keychain-cloudsync.mjs',
    'patchKeychainCloudSync'
];

// Body of an Objective-C method, from its signature line to the closing brace
const methodBody = (source: string, signature: string) => {
    const start = source.indexOf(signature);
    expect(start).toBeGreaterThanOrEqual(0);
    return source.slice(start, source.indexOf('\n}\n', start));
};

describe('patch-keychain-atomic-update', () => {
    const roots: string[] = [];
    const tree = (source?: string) => {
        const root = makeTree(source);
        roots.push(root);
        return root;
    };

    afterAll(() => {
        roots.forEach((root) =>
            fs.rmSync(root, { recursive: true, force: true })
        );
    });

    it('updates the existing item before falling back to add', () => {
        const root = tree();
        run(root, [ATOMIC]);
        const helper = methodBody(read(root), '- (void)upsertKeychainEntry:');

        const update = helper.indexOf('SecItemUpdate(');
        const notFound = helper.indexOf('osStatus == errSecItemNotFound');
        expect(update).toBeGreaterThan(0);
        expect(notFound).toBeGreaterThan(update);
        // The add only runs once the update reported no matching item
        expect(helper.indexOf('insertKeychainEntry', update)).toBeGreaterThan(
            notFound
        );
        // Any other update failure rejects instead of deleting
        expect(helper).toContain('return rejectWithError(reject, error);');
    });

    it('no longer deletes before adding in either setter', () => {
        const root = tree();
        run(root, [ATOMIC]);
        const patched = read(root);

        for (const [signature, deleteCall] of [
            [
                'RCT_EXPORT_METHOD(setInternetCredentialsForServer:',
                '[self deleteCredentialsForServer:server'
            ],
            [
                'RCT_EXPORT_METHOD(setGenericPasswordForOptions:',
                '[self deletePasswordsForOptions:options]'
            ]
        ]) {
            const body = methodBody(patched, signature);
            expect(body).toContain(MARKER);
            expect(body).toContain('[self upsertKeychainEntry:attributes');
            expect(body).not.toContain('[self insertKeychainEntry:');
            // The delete survives only inside the fallback block
            expect(body).toContain(`^OSStatus{ return ${deleteCall}`);
            expect(body.split(deleteCall)).toHaveLength(2);
        }
    });

    it('matches the same items the original delete removed', () => {
        const root = tree();
        run(root, [ATOMIC]);
        const internet = methodBody(
            read(root),
            'RCT_EXPORT_METHOD(setInternetCredentialsForServer:'
        );
        const query = internet.slice(internet.indexOf('NSDictionary *query'));

        expect(query).toContain('kSecClassInternetPassword');
        expect(query).toContain('kSecAttrServer: server');
        expect(query).toContain(
            'kSecAttrSynchronizable: (__bridge id)(cloudSync)'
        );
        expect(query.slice(0, query.indexOf('};'))).not.toContain(
            'kSecAttrAccount'
        );
    });

    it('is idempotent', () => {
        const root = tree();
        run(root, [ATOMIC]);
        const once = read(root);
        const output = run(root, [ATOMIC]);

        expect(read(root)).toBe(once);
        expect(output).toContain('Already patched');
        expect(once.split('- (void)upsertKeychainEntry:')).toHaveLength(2);
    });

    it.each([
        ['cloudSync first', [CLOUDSYNC, ATOMIC]],
        ['atomic first', [ATOMIC, CLOUDSYNC]]
    ])('composes with the cloudSync patch (%s)', (_, order) => {
        const root = tree();
        run(root, order as Array<[string, string]>);
        const patched = read(root);

        expect(patched).toContain(MARKER);
        expect(patched).toContain('[options[@"cloudSync"] boolValue]');
    });

    it('fails postinstall when the source no longer matches', () => {
        const root = tree(
            fs
                .readFileSync(FIXTURE, 'utf8')
                .replace(
                    '[self deleteCredentialsForServer:server withOptions: options];',
                    '[self removeCredentialsForServer:server];'
                )
        );

        expect(() => run(root, [ATOMIC])).toThrow(
            /setInternetCredentialsForServer body does not match/
        );
    });
});
