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

const HARNESS = (check: string) => `#import <Foundation/Foundation.h>
#import <Security/Security.h>

static NSMutableArray *gDeleted;
static OSStatus FakeSecItemDelete(CFDictionaryRef query) {
  [gDeleted addObject:((__bridge NSDictionary *)query)[(__bridge id)kSecClass]];
  return errSecSuccess;
}
#define SecItemDelete FakeSecItemDelete

${check}

int main(int argc, const char *argv[]) {
  @autoreleasepool {
    // argv: <protected data 0|1> <defaults flag 0|1> <defaults file path>
    BOOL protectedData = atoi(argv[1]);
    NSUserDefaults *defaults = [NSUserDefaults standardUserDefaults];
    [defaults removeObjectForKey:kHasRunBeforeKey];
    if (atoi(argv[2])) [defaults setBool:YES forKey:kHasRunBeforeKey];
    gDeleted = [NSMutableArray array];

    BOOL ran = ClearKeychainIfNecessary(protectedData, @(argv[3]));

    NSDictionary *report = @{
      @"ran": @(ran),
      @"deleted": @(gDeleted.count),
      @"flag": @([defaults boolForKey:kHasRunBeforeKey])
    };
    [defaults removeObjectForKey:kHasRunBeforeKey];
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

        const check = (
            protectedData: boolean,
            defaultsFlag: boolean,
            defaultsFile: string
        ) =>
            JSON.parse(
                execFileSync(
                    binary,
                    [
                        protectedData ? '1' : '0',
                        defaultsFlag ? '1' : '0',
                        defaultsFile
                    ],
                    { encoding: 'utf8' }
                )
            );

        // The reported wipe: a launch before the first unlock reads empty
        // defaults on an install that has run before
        it('does nothing while protected data is unavailable', () => {
            expect(check(false, false, withFlag)).toEqual({
                ran: false,
                deleted: 0,
                flag: false
            });
            expect(check(false, false, missing)).toEqual({
                ran: false,
                deleted: 0,
                flag: false
            });
        });

        it('clears every keychain class on a fresh install', () => {
            for (const file of [missing, withoutFlag]) {
                expect(check(true, false, file)).toEqual({
                    ran: true,
                    deleted: 5,
                    flag: true
                });
            }
        });

        it('keeps the keychain once the app has run', () => {
            expect(check(true, true, withFlag)).toEqual({
                ran: true,
                deleted: 0,
                flag: true
            });
        });

        it('keeps the keychain when defaults read empty but the file has the flag', () => {
            expect(check(true, false, withFlag)).toEqual({
                ran: true,
                deleted: 0,
                flag: true
            });
        });
    }
);
