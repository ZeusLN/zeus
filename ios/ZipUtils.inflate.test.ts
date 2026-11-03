import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';

// Compiles inflateData:expectedSize: out of ZipUtils.m with NSMutableData
// swapped for a subclass that records every buffer length requested, and
// runs it on raw DEFLATE streams. Needs clang and the macOS SDK, so it is
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

const ZIP_UTILS = path.join(__dirname, 'ZipUtils.m');

const extractInflate = () => {
    const source = fs.readFileSync(ZIP_UTILS, 'utf8');
    const start = source.indexOf('- (NSData *)inflateData:');
    const end = source.indexOf('#pragma mark - Encrypt');
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const defines = source.match(/^#define ZIP_\w+ .*$/gm) || [];
    return `${defines.join('\n')}\n\n${source.slice(start, end)}`;
};

// Buffers past this size are not allocated: the harness reports the request
// and exits, so code that trusts the declared size fails the test instead of
// asking for gigabytes
const HARNESS_ALLOCATION_LIMIT = 256 * 1024 * 1024;

const HARNESS = (inflate: string) => `#import <Foundation/Foundation.h>
#import <zlib.h>

static NSUInteger gMaxLength;

static void Track(NSUInteger length) {
  if (length > gMaxLength) gMaxLength = length;
  if (length > ${HARNESS_ALLOCATION_LIMIT}) {
    printf("{\\"tooLarge\\":%llu}\\n", (unsigned long long)length);
    exit(0);
  }
}

@interface TrackedMutableData : NSMutableData
@end
@implementation TrackedMutableData {
  NSMutableData *_inner;
}
+ (instancetype)dataWithLength:(NSUInteger)length {
  return [[self alloc] initWithLength:length];
}
- (instancetype)initWithLength:(NSUInteger)length {
  Track(length);
  _inner = [NSMutableData dataWithLength:length];
  return self;
}
- (NSUInteger)length { return _inner.length; }
- (const void *)bytes { return _inner.bytes; }
- (void *)mutableBytes { return _inner.mutableBytes; }
- (void)setLength:(NSUInteger)length {
  Track(length);
  _inner.length = length;
}
@end

#define NSMutableData TrackedMutableData

@interface Inflater : NSObject
- (NSData *)inflateData:(NSData *)data expectedSize:(uint32_t)expectedSize;
@end
@implementation Inflater
${inflate}
@end

int main(int argc, const char *argv[]) {
  @autoreleasepool {
    // argv: <raw deflate input> <expected size> <output path>
    NSData *input = [NSData dataWithContentsOfFile:@(argv[1])];
    uint32_t expectedSize = (uint32_t)strtoul(argv[2], NULL, 0);
    NSData *result = [[Inflater new] inflateData:input expectedSize:expectedSize];
    if (result) [result writeToFile:@(argv[3]) atomically:NO];
    printf("{\\"inflated\\":%s,\\"maxLength\\":%llu}\\n",
           result ? "true" : "false", (unsigned long long)gMaxLength);
  }
  return 0;
}
`;

(hasClang ? describe : describe.skip)(
    'ZipUtils inflateData (compiled, macOS only)',
    () => {
        let dir: string;
        let binary: string;

        beforeAll(() => {
            dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zip-inflate-'));
            const source = path.join(dir, 'harness.m');
            binary = path.join(dir, 'harness');
            fs.writeFileSync(source, HARNESS(extractInflate()));
            execFileSync(
                'xcrun',
                [
                    'clang',
                    '-fobjc-arc',
                    '-framework',
                    'Foundation',
                    '-lz',
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

        let runs = 0;
        const run = (input: Buffer, expectedSize: number) => {
            const inputPath = path.join(dir, `input-${runs}`);
            const outputPath = path.join(dir, `output-${runs}`);
            runs++;
            fs.writeFileSync(inputPath, input);
            const report = JSON.parse(
                execFileSync(
                    binary,
                    [inputPath, String(expectedSize), outputPath],
                    { encoding: 'utf8' }
                )
            );
            const output = fs.existsSync(outputPath)
                ? fs.readFileSync(outputPath)
                : null;
            return { ...report, output };
        };

        // Compressible text with some random bytes mixed in
        const sample = Buffer.concat(
            Array.from({ length: 64 }, (_, i) =>
                Buffer.concat([
                    Buffer.from(`channel ${i} `.repeat(1000)),
                    Buffer.from(
                        Array.from({ length: 512 }, (_, j) => (i * j) % 251)
                    )
                ])
            )
        );
        const empty = zlib.deflateRawSync(Buffer.alloc(0));

        it('inflates an entry to its declared size', () => {
            const result = run(zlib.deflateRawSync(sample), sample.length);
            expect(result.inflated).toBe(true);
            expect(result.output.equals(sample)).toBe(true);
        });

        it('inflates an empty entry', () => {
            const result = run(empty, 0);
            expect(result.inflated).toBe(true);
            expect(result.output.length).toBe(0);
        });

        // The Loupe LUP-31171 fixture's entry: a two-byte empty stream
        // declaring 0xfffffffe bytes
        it('rejects a forged size above the cap without allocating it', () => {
            const result = run(empty, 0xfffffffe);
            expect(result.tooLarge).toBeUndefined();
            expect(result).toEqual({
                inflated: false,
                maxLength: 0,
                output: null
            });
        });

        it('rejects a forged size under the cap without allocating it', () => {
            const result = run(empty, 0x7fffffff);
            expect(result.tooLarge).toBeUndefined();
            expect(result.inflated).toBe(false);
            expect(result.maxLength).toBeLessThanOrEqual(65536);
        });

        it('stops an entry that inflates past its declared size', () => {
            const declared = 100000;
            const result = run(zlib.deflateRawSync(sample), declared);
            expect(result.inflated).toBe(false);
            expect(result.maxLength).toBe(declared + 1);
        });

        it('rejects an entry that inflates to less than its declared size', () => {
            const result = run(zlib.deflateRawSync(sample), sample.length + 1);
            expect(result.inflated).toBe(false);
        });

        it('rejects a truncated stream', () => {
            const compressed = zlib.deflateRawSync(sample);
            const result = run(
                compressed.subarray(0, compressed.length >> 1),
                sample.length
            );
            expect(result.inflated).toBe(false);
        });

        it('rejects a non-empty declared size with no data', () => {
            expect(run(Buffer.alloc(0), 10).inflated).toBe(false);
        });
    }
);
