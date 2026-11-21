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
// passes, in ms from the call> [<ms each file read sleeps before it
// returns> [<flags>]]. Flags: "newerShare" has the share extension write a
// newer share while the take reads, "failRead" makes the read fail. Writes a
// share, takes it, and prints how the promise settled, what the share file
// holds afterwards (null when it is gone), and whether the renamed copy was
// left behind.
const HARNESS = (take: string) => `#import <Foundation/Foundation.h>
#import <objc/runtime.h>
#import <unistd.h>

typedef void (^RCTPromiseResolveBlock)(id result);
typedef void (^RCTPromiseRejectBlock)(NSString *code, NSString *message, NSError *error);
#define RCT_EXPORT_METHOD(method) - (void)method
#define RCTLogWarn(...) do {} while (0)

static useconds_t readDelayUs = 0;
static NSURL *newerShareURL = nil;
static BOOL failRead = NO;

@implementation NSString (SlowRead)
+ (instancetype)slow_stringWithContentsOfURL:(NSURL *)url
                                    encoding:(NSStringEncoding)enc
                                       error:(NSError **)error {
  if (newerShareURL) {
    [@"NEWERQR" writeToURL:newerShareURL atomically:YES encoding:NSUTF8StringEncoding error:nil];
  }
  usleep(readDelayUs);
  if (failRead) return nil;
  return [self slow_stringWithContentsOfURL:url encoding:enc error:error];
}
@end

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
    NSURL *taken = [container URLByAppendingPathComponent:@"sharedQR.taken.txt"];
    if (argc > 3) {
      readDelayUs = (useconds_t)(atof(argv[3]) * 1000);
      method_exchangeImplementations(
          class_getClassMethod([NSString class], @selector(stringWithContentsOfURL:encoding:error:)),
          class_getClassMethod([NSString class], @selector(slow_stringWithContentsOfURL:encoding:error:)));
    }
    [@"QRIMAGE" writeToURL:file atomically:YES encoding:NSUTF8StringEncoding error:nil];
    if (argc > 4) {
      NSString *flags = @(argv[4]);
      if ([flags containsString:@"newerShare"]) newerShareURL = file;
      failRead = [flags containsString:@"failRead"];
    }

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

    newerShareURL = nil;
    failRead = NO;
    readDelayUs = 0;
    NSString *left = [NSString stringWithContentsOfURL:file encoding:NSUTF8StringEncoding error:nil];
    NSDictionary *report = @{
      @"outcome": outcome,
      @"left": left ?: [NSNull null],
      @"taken": @([[NSFileManager defaultManager] fileExistsAtPath:taken.path])
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

        const run = (
            settleByMs: number,
            readDelayMs?: number,
            flags?: string
        ) => {
            const container = fs.mkdtempSync(path.join(dir, 'container-'));
            const args = [container, String(settleByMs)];
            if (readDelayMs !== undefined) args.push(String(readDelayMs));
            if (flags !== undefined) args.push(flags);
            return JSON.parse(
                execFileSync(binary, args, {
                    encoding: 'utf8'
                })
            );
        };

        it('takes the share when it starts before the deadline JS passed', () => {
            expect(run(7000)).toEqual({
                outcome: 'resolved:QRIMAGE',
                left: null,
                taken: false
            });
        });

        it('takes the share when a slow read still ends before the deadline', () => {
            expect(run(2000, 200)).toEqual({
                outcome: 'resolved:QRIMAGE',
                left: null,
                taken: false
            });
        });

        // The take can wait behind other modules on a shared method queue.
        // Run after JS gave up, it would remove the share with nobody to
        // receive the image.
        it('leaves the share when it starts after the deadline JS passed', () => {
            expect(run(-1000)).toEqual({
                outcome: 'rejected:SHARE_TIMEOUT',
                left: 'QRIMAGE',
                taken: false
            });
        });

        // A take that starts in time can still read past the deadline, and
        // removing the share then would leave nobody to receive the image
        it('puts the share back when its read ends after the deadline JS passed', () => {
            expect(run(200, 600)).toEqual({
                outcome: 'rejected:SHARE_TIMEOUT',
                left: 'QRIMAGE',
                taken: false
            });
        });

        // sharedQR.txt holds one share, and the share extension overwrites
        // an unread one. A share that cannot be put back because a newer one
        // has taken its place is dropped the same way, and the newer one is
        // left for the next take.
        it('drops the share for a newer one when its read ends after the deadline', () => {
            expect(run(200, 600, 'newerShare')).toEqual({
                outcome: 'rejected:SHARE_TIMEOUT',
                left: 'NEWERQR',
                taken: false
            });
        });

        it('drops the share for a newer one when its read fails', () => {
            expect(run(7000, 0, 'newerShare,failRead')).toEqual({
                outcome: 'resolved:null',
                left: 'NEWERQR',
                taken: false
            });
        });

        it('takes the share and leaves a newer one that arrived during the read', () => {
            expect(run(7000, 0, 'newerShare')).toEqual({
                outcome: 'resolved:QRIMAGE',
                left: 'NEWERQR',
                taken: false
            });
        });
    }
);
