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

    it.each([
        [
            'setInternetCredentialsForServer',
            'kSecClassInternetPassword',
            'kSecAttrServer: server'
        ],
        [
            'setGenericPasswordForOptions',
            'kSecClassGenericPassword',
            'kSecAttrService: service'
        ]
    ])(
        '%s matches the same items the original delete removed',
        (setter, secClass, scope) => {
            const root = tree();
            run(root, [ATOMIC]);
            const body = methodBody(read(root), `RCT_EXPORT_METHOD(${setter}:`);
            const query = body.slice(body.indexOf('NSDictionary *query'));
            const literal = query.slice(0, query.indexOf('};'));

            expect(literal).toContain(secClass);
            expect(literal).toContain(scope);
            expect(literal).toContain(
                'kSecAttrSynchronizable: (__bridge id)(cloudSync)'
            );
            expect(literal).not.toContain('kSecAttrAccount');
        }
    );

    it('deletes before adding, and never updates, for protected writes', () => {
        const root = tree();
        run(root, [ATOMIC]);
        const helper = methodBody(read(root), '- (void)upsertKeychainEntry:');
        const branch = helper.slice(
            helper.indexOf('if (accessControlValue(options)'),
            helper.indexOf('NSMutableDictionary *mQuery')
        );

        expect(branch.indexOf('deleteExisting();')).toBeGreaterThan(0);
        expect(branch.indexOf('insertKeychainEntry')).toBeGreaterThan(
            branch.indexOf('deleteExisting();')
        );
        expect(branch).toContain('return [self insertKeychainEntry');
        expect(helper.indexOf('SecItemUpdate(')).toBeGreaterThan(
            helper.indexOf('NSMutableDictionary *mQuery')
        );
    });

    it('deletes before adding on errSecDuplicateItem', () => {
        const root = tree();
        run(root, [ATOMIC]);
        const helper = methodBody(read(root), '- (void)upsertKeychainEntry:');
        const branch = helper.slice(
            helper.indexOf('osStatus == errSecDuplicateItem'),
            helper.indexOf('if (osStatus != noErr)')
        );

        expect(branch.indexOf('deleteExisting();')).toBeGreaterThan(0);
        expect(branch.indexOf('insertKeychainEntry')).toBeGreaterThan(
            branch.indexOf('deleteExisting();')
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

    it.each([
        [
            'setInternetCredentialsForServer body',
            '[self deleteCredentialsForServer:server withOptions: options];',
            '[self removeCredentialsForServer:server];'
        ],
        [
            'setGenericPasswordForOptions body',
            '[self deletePasswordsForOptions:options];',
            '[self removePasswordsForOptions:options];'
        ],
        [
            'hasCredentialsWithSecClass anchor',
            '- (void)hasCredentialsWithSecClass:(CFTypeRef)secClass',
            '- (void)hasCredentialsOfClass:(CFTypeRef)secClass'
        ]
    ])(
        'fails postinstall when the %s no longer matches',
        (name, original, changed) => {
            const root = tree(
                fs.readFileSync(FIXTURE, 'utf8').replace(original, changed)
            );

            expect(() => run(root, [ATOMIC])).toThrow(
                new RegExp(`${name} does not match`)
            );
        }
    );
});

// Compiles the generated upsertKeychainEntry against fake Security calls and
// runs each status through it, so the write-failure guarantee is executed,
// not only matched as text. Needs clang and the macOS SDK, so it is skipped
// on the Linux CI runners.
const hasClang = (() => {
    if (process.platform !== 'darwin') return false;
    try {
        execFileSync('xcrun', ['--find', 'clang'], { stdio: 'pipe' });
        return true;
    } catch {
        return false;
    }
})();

const HARNESS = (helper: string) => `#import <Foundation/Foundation.h>
#import <Security/Security.h>

typedef void (^RCTPromiseResolveBlock)(id result);
typedef void (^RCTPromiseRejectBlock)(NSString *code, NSString *message, NSError *error);

// One-item fake keychain plus a log of every call that touches it
static NSString *gStored;
static OSStatus gUpdateStatus;
static NSMutableArray<NSString *> *gCalls;
static NSDictionary *gUpdateQuery;
static NSDictionary *gUpdateChanges;

static NSString *valueOf(NSDictionary *d) {
  NSData *data = d[(__bridge NSString *)kSecValueData];
  return data ? [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding] : nil;
}

static OSStatus FakeSecItemUpdate(CFDictionaryRef query, CFDictionaryRef changes) {
  [gCalls addObject:@"update"];
  gUpdateQuery = (__bridge NSDictionary *)query;
  gUpdateChanges = (__bridge NSDictionary *)changes;
  if (gUpdateStatus == errSecSuccess) gStored = valueOf(gUpdateChanges);
  return gUpdateStatus;
}
#define SecItemUpdate FakeSecItemUpdate

SecAccessControlCreateFlags accessControlValue(NSDictionary *options) {
  return options[@"accessControl"] ? kSecAccessControlUserPresence : 0;
}
NSString *accessGroupValue(NSDictionary *options) { return options[@"accessGroup"]; }
CFStringRef accessibleValue(NSDictionary *options) { return kSecAttrAccessibleAfterFirstUnlock; }
NSString *serviceValue(NSDictionary *options) { return @"svc"; }
void rejectWithError(RCTPromiseRejectBlock reject, NSError *error) {
  reject([NSString stringWithFormat:@"%ld", (long)error.code], @"", error);
}

@interface Harness : NSObject
@end

@implementation Harness

- (void)insertKeychainEntry:(NSDictionary *)attributes
                withOptions:(NSDictionary * __nullable)options
                   resolver:(RCTPromiseResolveBlock)resolve
                   rejecter:(RCTPromiseRejectBlock)reject
{
  [gCalls addObject:@"add"];
  gStored = valueOf(attributes);
  resolve(nil);
}

${helper}

@end

int main(int argc, const char *argv[]) {
  @autoreleasepool {
    // argv: <stored value or -> <update status> <options json>
    gStored = strcmp(argv[1], "-") == 0 ? nil : @(argv[1]);
    gUpdateStatus = (OSStatus)atoi(argv[2]);
    NSDictionary *options = [NSJSONSerialization
      JSONObjectWithData:[@(argv[3]) dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
    gCalls = [NSMutableArray array];
    __block NSString *outcome = @"none";

    NSDictionary *attributes = @{
      (__bridge NSString *)kSecClass: (__bridge id)kSecClassInternetPassword,
      (__bridge NSString *)kSecAttrServer: @"zeus:test",
      (__bridge NSString *)kSecAttrAccount: @"zeus:test",
      (__bridge NSString *)kSecValueData: [@"new" dataUsingEncoding:NSUTF8StringEncoding]
    };
    NSDictionary *query = @{
      (__bridge NSString *)kSecClass: (__bridge id)kSecClassInternetPassword,
      (__bridge NSString *)kSecAttrServer: @"zeus:test"
    };

    [[Harness new] upsertKeychainEntry:attributes
                                 query:query
                           withOptions:options
                        deleteExisting:^OSStatus{ [gCalls addObject:@"delete"]; gStored = nil; return errSecSuccess; }
                              resolver:^(id result) { outcome = @"resolved"; }
                              rejecter:^(NSString *code, NSString *message, NSError *error) {
                                outcome = [@"rejected " stringByAppendingString:code];
                              }];

    NSDictionary *report = @{
      @"calls": gCalls,
      @"outcome": outcome,
      @"stored": gStored ?: [NSNull null],
      @"dataProtection": gUpdateQuery[(__bridge NSString *)kSecUseDataProtectionKeychain] ?: [NSNull null],
      @"queryServer": gUpdateQuery[(__bridge NSString *)kSecAttrServer] ?: [NSNull null],
      @"changedKeys": gUpdateChanges ? [gUpdateChanges.allKeys sortedArrayUsingSelector:@selector(compare:)] : @[]
    };
    NSData *json = [NSJSONSerialization dataWithJSONObject:report options:0 error:nil];
    printf("%s\\n", [[NSString alloc] initWithData:json encoding:NSUTF8StringEncoding].UTF8String);
  }
  return 0;
}
`;

(hasClang ? describe : describe.skip)(
    'generated upsertKeychainEntry (compiled, macOS only)',
    () => {
        let dir: string;
        let binary: string;

        beforeAll(() => {
            const root = makeTree();
            run(root, [ATOMIC]);
            const patched = read(root);
            fs.rmSync(root, { recursive: true, force: true });

            const start = patched.indexOf(MARKER);
            const end = patched.indexOf(
                '- (void)hasCredentialsWithSecClass:',
                start
            );
            expect(start).toBeGreaterThanOrEqual(0);
            expect(end).toBeGreaterThan(start);

            dir = fs.mkdtempSync(path.join(os.tmpdir(), 'keychain-upsert-'));
            const source = path.join(dir, 'harness.m');
            binary = path.join(dir, 'harness');
            fs.writeFileSync(source, HARNESS(patched.slice(start, end)));
            execFileSync(
                'xcrun',
                [
                    'clang',
                    '-fobjc-arc',
                    '-framework',
                    'Foundation',
                    '-framework',
                    'Security',
                    source,
                    '-o',
                    binary
                ],
                { stdio: 'pipe' }
            );
        }, 60000);

        afterAll(() => {
            if (dir) fs.rmSync(dir, { recursive: true, force: true });
        });

        const upsert = (
            stored: string | null,
            updateStatus: number,
            options: Record<string, unknown> = {}
        ) =>
            JSON.parse(
                execFileSync(
                    binary,
                    [
                        stored ?? '-',
                        String(updateStatus),
                        JSON.stringify(options)
                    ],
                    { encoding: 'utf8' }
                )
            );

        const errSecSuccess = 0;
        const errSecItemNotFound = -25300;
        const errSecDuplicateItem = -25299;
        const errSecInteractionNotAllowed = -25308;
        const errSecParam = -50;

        it('replaces an existing item with one update and no delete or add', () => {
            const r = upsert('old', errSecSuccess);

            expect(r.calls).toEqual(['update']);
            expect(r.outcome).toBe('resolved');
            expect(r.stored).toBe('new');
            expect(r.queryServer).toBe('zeus:test');
            expect(r.dataProtection).toBe(true);
            expect(r.changedKeys).toEqual(['acct', 'pdmn', 'v_Data']);
        });

        it('adds without deleting when no item exists', () => {
            const r = upsert(null, errSecItemNotFound);

            expect(r.calls).toEqual(['update', 'add']);
            expect(r.outcome).toBe('resolved');
            expect(r.stored).toBe('new');
        });

        it.each([
            ['errSecInteractionNotAllowed', errSecInteractionNotAllowed],
            ['errSecParam', errSecParam]
        ])('rejects on %s and keeps the old value', (_name, status) => {
            const r = upsert('old', status);

            expect(r.calls).toEqual(['update']);
            expect(r.outcome).toBe(`rejected ${status}`);
            expect(r.stored).toBe('old');
        });

        it('falls back to delete then add on errSecDuplicateItem', () => {
            const r = upsert('old', errSecDuplicateItem);

            expect(r.calls).toEqual(['update', 'delete', 'add']);
            expect(r.outcome).toBe('resolved');
            expect(r.stored).toBe('new');
        });

        it.each([
            ['an access control', { accessControl: 'BiometryAny' }],
            ['an access group', { accessGroup: 'group.app.zeusln.zeus' }]
        ])(
            'keeps the old delete then add for writes with %s',
            (_name, options) => {
                const r = upsert('old', errSecSuccess, options);

                expect(r.calls).toEqual(['delete', 'add']);
                expect(r.outcome).toBe('resolved');
                expect(r.stored).toBe('new');
            }
        );
    }
);
