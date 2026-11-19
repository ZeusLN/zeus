import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Compiles the shared-image take out of ShareBridge.m against stand-ins for
// the React Native macros and runs it on a file in a temporary directory in
// place of the app group container. Needs clang and the macOS SDK, so it is
// skipped on the Linux CI runners.
const hasClang = (() => {
    if (process.platform !== 'darwin') return false;
    try {
        execFileSync('xcrun', ['--find', 'clang'], { stdio: 'pipe' });
        return true;
    } catch {
        return false;
    }
})();

const SHARE_BRIDGE = path.join(__dirname, 'ShareBridge.m');

const extractTake = () => {
    const source = fs.readFileSync(SHARE_BRIDGE, 'utf8');
    const start = source.indexOf('RCT_EXPORT_METHOD(takeSharedImageBase64:');
    const end = source.indexOf('- (NSDictionary *)constantsToExport');
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    return source.slice(start, end);
};

// argv: <directory standing in for the app group container> <the deadline JS
// passes, in ms from the call>. Writes a share, takes it, and prints how the
// promise settled and whether the share file is still there.
const HARNESS = (take: string) => `#import <Foundation/Foundation.h>

typedef void (^RCTPromiseResolveBlock)(id result);
typedef void (^RCTPromiseRejectBlock)(NSString *code, NSString *message, NSError *error);
#define RCT_EXPORT_METHOD(method) - (void)method
#define RCTLogWarn(...) do {} while (0)

@interface ShareBridge : NSObject
@property (nonatomic, strong) NSURL *sharedFileURL;
@end

@implementation ShareBridge
- (NSURL *)getSharedFileURL { return self.sharedFileURL; }

${take}
@end

int main(int argc, const char *argv[]) {
  @autoreleasepool {
    NSURL *container = [NSURL fileURLWithPath:@(argv[1]) isDirectory:YES];
    NSURL *file = [container URLByAppendingPathComponent:@"sharedQR.txt"];
    [@"QRIMAGE" writeToURL:file atomically:YES encoding:NSUTF8StringEncoding error:nil];

    ShareBridge *bridge = [ShareBridge new];
    bridge.sharedFileURL = file;
    __block NSString *outcome = @"unsettled";
    double settleByMs = [[NSDate date] timeIntervalSince1970] * 1000 + atof(argv[2]);
    [bridge takeSharedImageBase64:settleByMs
        resolver:^(id result) {
          outcome = [NSString stringWithFormat:@"resolved:%@", result ?: @"null"];
        }
        rejecter:^(NSString *code, NSString *message, NSError *error) {
          outcome = [@"rejected:" stringByAppendingString:code];
        }];

    NSDictionary *report = @{
      @"outcome": outcome,
      @"left": @([[NSFileManager defaultManager] fileExistsAtPath:file.path])
    };
    NSData *json = [NSJSONSerialization dataWithJSONObject:report options:0 error:nil];
    printf("%s\\n", [[NSString alloc] initWithData:json encoding:NSUTF8StringEncoding].UTF8String);
  }
  return 0;
}
`;

(hasClang ? describe : describe.skip)(
    'ShareBridge.takeSharedImageBase64 (compiled, macOS only)',
    () => {
        let dir: string;
        let binary: string;

        beforeAll(() => {
            dir = fs.mkdtempSync(path.join(os.tmpdir(), 'share-bridge-'));
            const source = path.join(dir, 'harness.m');
            binary = path.join(dir, 'harness');
            fs.writeFileSync(source, HARNESS(extractTake()));
            execFileSync(
                'xcrun',
                [
                    'clang',
                    '-fobjc-arc',
                    '-framework',
                    'Foundation',
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

        const run = (settleByMs: number) => {
            const container = fs.mkdtempSync(path.join(dir, 'container-'));
            return JSON.parse(
                execFileSync(binary, [container, String(settleByMs)], {
                    encoding: 'utf8'
                })
            );
        };

        it('takes the share when it starts before the deadline JS passed', () => {
            expect(run(7000)).toEqual({
                outcome: 'resolved:QRIMAGE',
                left: false
            });
        });

        // The take can wait behind other modules on a shared method queue.
        // Run after JS gave up, it would remove the share with nobody to
        // receive the image.
        it('leaves the share when it starts after the deadline JS passed', () => {
            expect(run(-1000)).toEqual({
                outcome: 'rejected:SHARE_TIMEOUT',
                left: true
            });
        });
    }
);
