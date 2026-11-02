import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Compiles the first-run keychain check out of AppDelegate.mm against a fake
// SecItemDelete and runs it in each launch state. Needs clang and the macOS
// SDK, so it is skipped on the Linux CI runners.
const hasClang = (() => {
    if (process.platform !== 'darwin') return false;
    try {
        execFileSync('xcrun', ['--find', 'clang'], { stdio: 'pipe' });
        return true;
    } catch {
        return false;
    }
})();

const APP_DELEGATE = path.join(__dirname, 'AppDelegate.mm');

const extractCheck = () => {
    const source = fs.readFileSync(APP_DELEGATE, 'utf8');
    const start = source.indexOf('static NSString *const kHasRunBeforeKey');
    const end = source.indexOf('@interface AppDelegate ()');
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    return source.slice(start, end);
};

// Replays a sequence of launch events the way AppDelegate wires them:
//   launch:<0|1>  didFinishLaunching with protected data unavailable/available
//   unlock        applicationProtectedDataDidBecomeAvailable:
//   active:<0|1>  UIApplicationDidBecomeActiveNotification, with protected data
//                 unavailable/available at that moment
const HARNESS = (check: string) => `#import <Foundation/Foundation.h>
#import <Security/Security.h>

static NSMutableArray *gDeleted;
static OSStatus FakeSecItemDelete(CFDictionaryRef query) {
  [gDeleted addObject:((__bridge NSDictionary *)query)[(__bridge id)kSecClass]];
  return errSecSuccess;
}
#define SecItemDelete FakeSecItemDelete

// LOCAL_ITEMS=1 stands in for device-local items an earlier install left
static OSStatus FakeSecItemCopyMatching(CFDictionaryRef query, CFTypeRef *result) {
  const char *local = getenv("LOCAL_ITEMS");
  return local && atoi(local) ? errSecSuccess : errSecItemNotFound;
}
#define SecItemCopyMatching FakeSecItemCopyMatching

// In-memory stand-in for standardUserDefaults, so runs share no state and
// write nothing to the developer's ~/Library/Preferences
@interface FakeDefaults : NSObject
+ (instancetype)standardUserDefaults;
- (BOOL)boolForKey:(NSString *)key;
- (void)setBool:(BOOL)value forKey:(NSString *)key;
@end
@implementation FakeDefaults {
  NSMutableDictionary *_values;
}
+ (instancetype)standardUserDefaults {
  static FakeDefaults *shared;
  if (!shared) {
    shared = [FakeDefaults new];
    shared->_values = [NSMutableDictionary dictionary];
  }
  return shared;
}
- (BOOL)boolForKey:(NSString *)key { return [_values[key] boolValue]; }
- (void)setBool:(BOOL)value forKey:(NSString *)key { _values[key] = @(value); }
@end
#define NSUserDefaults FakeDefaults

${check}

int main(int argc, const char *argv[]) {
  @autoreleasepool {
    // argv: <defaults flag 0|1> <defaults file path> <event>...
    NSUserDefaults *defaults = [NSUserDefaults standardUserDefaults];
    if (atoi(argv[1])) [defaults setBool:YES forKey:kHasRunBeforeKey];
    NSString *path = @(argv[2]);
    gDeleted = [NSMutableArray array];

    BOOL pending = NO;
    int checks = 0;
    for (int i = 3; i < argc; i++) {
      NSString *event = @(argv[i]);
      if ([event hasPrefix:@"launch:"]) {
        pending = !ClearKeychainIfNecessary([event hasSuffix:@"1"], path);
        if (!pending) checks++;
      } else if ([event isEqualToString:@"unlock"]) {
        if (RunPendingKeychainCheck(&pending, YES, path)) checks++;
      } else if ([event hasPrefix:@"active:"]) {
        if (RunPendingKeychainCheck(&pending, [event hasSuffix:@"1"], path)) checks++;
      } else {
        fprintf(stderr, "unknown event %s\\n", argv[i]);
        return 1;
      }
    }

    NSDictionary *report = @{
      @"checks": @(checks),
      @"pending": @(pending),
      @"deleted": @(gDeleted.count),
      @"flag": @([defaults boolForKey:kHasRunBeforeKey]),
      @"reinstalled": @([defaults boolForKey:kKeychainSurvivedReinstallKey])
    };
    NSData *json = [NSJSONSerialization dataWithJSONObject:report options:0 error:nil];
    printf("%s\\n", [[NSString alloc] initWithData:json encoding:NSUTF8StringEncoding].UTF8String);
  }
  return 0;
}
`;

(hasClang ? describe : describe.skip)(
    'AppDelegate first-run keychain clear (compiled, macOS only)',
    () => {
        let dir: string;
        let binary: string;
        let withFlag: string;
        let withoutFlag: string;
        let missing: string;

        beforeAll(() => {
            dir = fs.mkdtempSync(path.join(os.tmpdir(), 'keychain-first-run-'));
            const source = path.join(dir, 'harness.m');
            binary = path.join(dir, 'harness');
            fs.writeFileSync(source, HARNESS(extractCheck()));
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

            // Stand-ins for the defaults file on disk
            const plist = (entries: string) =>
                `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>${entries}</dict></plist>`;
            withFlag = path.join(dir, 'with-flag.plist');
            withoutFlag = path.join(dir, 'without-flag.plist');
            missing = path.join(dir, 'missing.plist');
            fs.writeFileSync(
                withFlag,
                plist('<key>HAS_RUN_BEFORE</key><true/>')
            );
            fs.writeFileSync(withoutFlag, plist('<key>other</key><true/>'));
        }, 60000);

        afterAll(() => {
            if (dir) fs.rmSync(dir, { recursive: true, force: true });
        });

        const runWith = (
            localItems: boolean,
            defaultsFlag: boolean,
            defaultsFile: string,
            ...events: string[]
        ) =>
            JSON.parse(
                execFileSync(
                    binary,
                    [defaultsFlag ? '1' : '0', defaultsFile, ...events],
                    {
                        encoding: 'utf8',
                        env: {
                            ...process.env,
                            LOCAL_ITEMS: localItems ? '1' : '0'
                        }
                    }
                )
            );
        const run = (
            defaultsFlag: boolean,
            defaultsFile: string,
            ...events: string[]
        ) => runWith(false, defaultsFlag, defaultsFile, ...events);

        // Before the first unlock after a reboot, a background launch on an
        // install that has run before reads empty defaults
        it('does nothing at launch while protected data is unavailable', () => {
            for (const file of [withFlag, missing]) {
                expect(run(false, file, 'launch:0')).toEqual({
                    checks: 0,
                    pending: true,
                    deleted: 0,
                    flag: false,
                    reinstalled: false
                });
            }
        });

        it('clears every keychain class on a fresh install', () => {
            for (const file of [missing, withoutFlag]) {
                expect(run(false, file, 'launch:1')).toEqual({
                    checks: 1,
                    pending: false,
                    deleted: 5,
                    flag: true,
                    reinstalled: false
                });
            }
        });

        it('keeps the keychain once the app has run', () => {
            expect(run(true, withFlag, 'launch:1')).toEqual({
                checks: 1,
                pending: false,
                deleted: 0,
                flag: true,
                reinstalled: false
            });
        });

        it('keeps the keychain and leaves defaults alone when defaults read empty but the file has the flag', () => {
            expect(run(false, withFlag, 'launch:1')).toEqual({
                checks: 1,
                pending: false,
                deleted: 0,
                flag: false,
                reinstalled: false
            });
        });

        describe('reinstall on the same device', () => {
            it('marks a fresh install that finds device-local items as a reinstall', () => {
                expect(runWith(true, false, missing, 'launch:1')).toEqual({
                    checks: 1,
                    pending: false,
                    deleted: 5,
                    flag: true,
                    reinstalled: true
                });
            });

            it('does not mark a first install on a new device', () => {
                expect(
                    runWith(false, false, missing, 'launch:1')
                ).toMatchObject({ deleted: 5, reinstalled: false });
            });

            it('does not mark an install that has run before', () => {
                expect(runWith(true, true, withFlag, 'launch:1')).toMatchObject(
                    { deleted: 0, reinstalled: false }
                );
                expect(
                    runWith(true, false, withFlag, 'launch:1')
                ).toMatchObject({ deleted: 0, reinstalled: false });
            });

            it('marks the reinstall when the check was deferred to unlock', () => {
                expect(
                    runWith(true, false, missing, 'launch:0', 'unlock')
                ).toMatchObject({ checks: 1, deleted: 5, reinstalled: true });
            });
        });

        describe('deferred check', () => {
            it('runs once when protected data becomes available after a locked launch', () => {
                expect(run(false, missing, 'launch:0', 'unlock')).toEqual({
                    checks: 1,
                    pending: false,
                    deleted: 5,
                    flag: true,
                    reinstalled: false
                });
                expect(run(false, withFlag, 'launch:0', 'unlock')).toEqual({
                    checks: 1,
                    pending: false,
                    deleted: 0,
                    flag: false,
                    reinstalled: false
                });
            });

            it('runs on becoming active when the unlock callback was missed', () => {
                expect(run(false, missing, 'launch:0', 'active:1')).toEqual({
                    checks: 1,
                    pending: false,
                    deleted: 5,
                    flag: true,
                    reinstalled: false
                });
            });

            it('stays pending while becoming active without protected data', () => {
                expect(run(false, missing, 'launch:0', 'active:0')).toEqual({
                    checks: 0,
                    pending: true,
                    deleted: 0,
                    flag: false,
                    reinstalled: false
                });
                expect(
                    run(false, missing, 'launch:0', 'active:0', 'active:1')
                ).toEqual({
                    checks: 1,
                    pending: false,
                    deleted: 5,
                    flag: true,
                    reinstalled: false
                });
            });

            it('does not run again on repeated callbacks', () => {
                expect(
                    run(
                        false,
                        missing,
                        'launch:0',
                        'unlock',
                        'active:1',
                        'unlock',
                        'active:1'
                    )
                ).toEqual({
                    checks: 1,
                    pending: false,
                    deleted: 5,
                    flag: true,
                    reinstalled: false
                });
                expect(
                    run(
                        false,
                        missing,
                        'launch:0',
                        'active:1',
                        'unlock',
                        'active:1'
                    )
                ).toEqual({
                    checks: 1,
                    pending: false,
                    deleted: 5,
                    flag: true,
                    reinstalled: false
                });
            });

            it('never runs after a launch with protected data', () => {
                expect(
                    run(false, missing, 'launch:1', 'unlock', 'active:1')
                ).toEqual({
                    checks: 1,
                    pending: false,
                    deleted: 5,
                    flag: true,
                    reinstalled: false
                });
            });
        });
    }
);

// The harness runs the deferred logic but not its UIKit wiring, so pin
// that in the source. These need no compiler and run everywhere.
describe('AppDelegate deferred keychain check wiring', () => {
    const source = fs.readFileSync(APP_DELEGATE, 'utf8');
    const method = (signature: string) => {
        const start = source.indexOf(signature);
        expect(start).toBeGreaterThanOrEqual(0);
        return source.slice(start, source.indexOf('\n}\n', start));
    };

    it('passes the launch protected-data state and defers when it is missing', () => {
        const launch = method(
            '- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:'
        );

        expect(launch).toContain(
            '_keychainCheckPending = !ClearKeychainIfNecessary(application.isProtectedDataAvailable, StandardDefaultsPath());'
        );
        // Retried on becoming active, not only on the protected-data callback
        const pending = launch.slice(
            launch.indexOf('if (_keychainCheckPending)')
        );
        expect(pending).toContain('UIApplicationDidBecomeActiveNotification');
        expect(pending).toContain('@selector(runPendingKeychainCheck)');
    });

    it('hands the pending state and current protected-data state to the helper', () => {
        const run = method('- (void)runPendingKeychainCheck');

        expect(run).toContain(
            'RunPendingKeychainCheck(&_keychainCheckPending,'
        );
        expect(run).toContain(
            '[UIApplication sharedApplication].isProtectedDataAvailable'
        );
        expect(run).toContain('removeObserver:self');
    });

    it('also runs the pending check when protected data becomes available', () => {
        expect(
            method('- (void)applicationProtectedDataDidBecomeAvailable:')
        ).toContain('[self runPendingKeychainCheck];');
    });
});
