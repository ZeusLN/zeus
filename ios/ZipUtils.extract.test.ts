import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';

// Compiles extractZipAtPath:toDirectory: out of ZipUtils.m with malloc
// swapped for a wrapper that records every buffer size requested, and runs
// it on zip archives built here. Needs clang and the macOS SDK, so it is
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

const extractSource = () => {
    const source = fs.readFileSync(ZIP_UTILS, 'utf8');
    const readersStart = source.indexOf('static uint16_t ZipRead16');
    const readersEnd = source.indexOf('RCT_EXPORT_METHOD(unzipFile:');
    const start = source.indexOf('+ (NSString *)extractZipAtPath:');
    const end = source.indexOf('#pragma mark - Encrypt');
    expect(readersStart).toBeGreaterThanOrEqual(0);
    expect(readersEnd).toBeGreaterThan(readersStart);
    expect(start).toBeGreaterThan(readersEnd);
    expect(end).toBeGreaterThan(start);
    const defines = source.match(/^#define ZIP_\w+ .*$/gm) || [];
    return {
        readers: `${defines.join('\n')}\n\n${source.slice(
            readersStart,
            readersEnd
        )}`,
        extract: source.slice(start, end)
    };
};

// Buffers past this size are not allocated: the harness reports the request
// and exits, so code that trusts the declared size fails the test instead of
// asking for gigabytes
const HARNESS_ALLOCATION_LIMIT = 256 * 1024 * 1024;

const HARNESS = ({
    readers,
    extract
}: {
    readers: string;
    extract: string;
}) => `#import <Foundation/Foundation.h>
#import <zlib.h>

static size_t gMaxMalloc;

static void *TrackedMalloc(size_t size) {
  if (size > gMaxMalloc) gMaxMalloc = size;
  if (size > ${HARNESS_ALLOCATION_LIMIT}) {
    printf("{\\"tooLarge\\":%zu}\\n", size);
    exit(0);
  }
  return malloc(size);
}

#define malloc(size) TrackedMalloc(size)

${readers}

@interface Extractor : NSObject
+ (NSString *)extractZipAtPath:(NSString *)zipPath toDirectory:(NSString *)destDirPath;
@end
@implementation Extractor
${extract}
@end

int main(int argc, const char *argv[]) {
  @autoreleasepool {
    // argv: <zip path> <destination directory>
    NSString *error = [Extractor extractZipAtPath:@(argv[1]) toDirectory:@(argv[2])];
    NSDictionary *report = @{
      @"error": error ?: [NSNull null],
      @"maxMalloc": @(gMaxMalloc)
    };
    NSData *json = [NSJSONSerialization dataWithJSONObject:report options:0 error:nil];
    printf("%s\\n", [[NSString alloc] initWithData:json encoding:NSUTF8StringEncoding].UTF8String);
  }
  return 0;
}
`;

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
});

const crc32 = (data: Buffer) => {
    let crc = 0xffffffff;
    for (const byte of data) {
        crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
};

interface Entry {
    name: string;
    // Bytes stored in the archive, already deflated
    data: Buffer;
    crc: number;
    uncompressedSize: number;
}

// One deflated entry per file, no data descriptors, sizes in both headers
const buildZip = (entries: Entry[]) => {
    const locals: Buffer[] = [];
    const centrals: Buffer[] = [];
    let offset = 0;
    for (const entry of entries) {
        const name = Buffer.from(entry.name);
        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt16LE(8, 8);
        local.writeUInt32LE(entry.crc, 14);
        local.writeUInt32LE(entry.data.length, 18);
        local.writeUInt32LE(entry.uncompressedSize, 22);
        local.writeUInt16LE(name.length, 26);
        locals.push(local, name, entry.data);

        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE(20, 4);
        central.writeUInt16LE(20, 6);
        central.writeUInt16LE(8, 10);
        central.writeUInt32LE(entry.crc, 16);
        central.writeUInt32LE(entry.data.length, 20);
        central.writeUInt32LE(entry.uncompressedSize, 24);
        central.writeUInt16LE(name.length, 28);
        central.writeUInt32LE(offset, 42);
        centrals.push(central, name);

        offset += local.length + name.length + entry.data.length;
    }
    const centralDirectory = Buffer.concat(centrals);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(entries.length, 8);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(centralDirectory.length, 12);
    end.writeUInt32LE(offset, 16);
    return Buffer.concat([...locals, centralDirectory, end]);
};

(hasClang ? describe : describe.skip)(
    'ZipUtils extractZipAtPath (compiled, macOS only)',
    () => {
        let dir: string;
        let binary: string;

        beforeAll(() => {
            dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zip-extract-'));
            const source = path.join(dir, 'harness.m');
            binary = path.join(dir, 'harness');
            fs.writeFileSync(source, HARNESS(extractSource()));
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
        const run = (entry: Entry) => {
            const zipPath = path.join(dir, `input-${runs}.zip`);
            const destDir = path.join(dir, `output-${runs}`);
            runs++;
            fs.writeFileSync(zipPath, buildZip([entry]));
            const report = JSON.parse(
                execFileSync(binary, [zipPath, destDir], { encoding: 'utf8' })
            );
            const files = fs.existsSync(destDir) ? fs.readdirSync(destDir) : [];
            const output = files.includes(entry.name)
                ? fs.readFileSync(path.join(destDir, entry.name))
                : null;
            return { ...report, files, output };
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
        const deflated = zlib.deflateRawSync(sample);
        const empty = zlib.deflateRawSync(Buffer.alloc(0));
        const sampleEntry = (overrides: Partial<Entry>): Entry => ({
            name: 'channel.db',
            data: deflated,
            crc: crc32(sample),
            uncompressedSize: sample.length,
            ...overrides
        });

        it('extracts an entry to its declared size', () => {
            const result = run(sampleEntry({}));
            expect(result.error).toBeNull();
            expect(result.output.equals(sample)).toBe(true);
            expect(result.maxMalloc).toBeLessThanOrEqual(65536);
        });

        it('extracts an empty entry', () => {
            const result = run(
                sampleEntry({ data: empty, crc: 0, uncompressedSize: 0 })
            );
            expect(result.error).toBeNull();
            expect(result.output.length).toBe(0);
        });

        // The Loupe LUP-31171 fixture's entry: a two-byte empty stream
        // declaring 0xfffffffe bytes
        it('rejects a forged size without allocating it', () => {
            const result = run(
                sampleEntry({ data: empty, uncompressedSize: 0xfffffffe })
            );
            expect(result.tooLarge).toBeUndefined();
            expect(result.error).toMatch(/Size mismatch/);
            expect(result.maxMalloc).toBeLessThanOrEqual(65536);
            expect(result.files).toEqual([]);
        });

        it('rejects a smaller forged size without allocating it', () => {
            const result = run(
                sampleEntry({ data: empty, uncompressedSize: 0x7fffffff })
            );
            expect(result.tooLarge).toBeUndefined();
            expect(result.error).toMatch(/Size mismatch/);
            expect(result.maxMalloc).toBeLessThanOrEqual(65536);
            expect(result.files).toEqual([]);
        });

        it('stops an entry that inflates past its declared size', () => {
            const result = run(sampleEntry({ uncompressedSize: 100000 }));
            expect(result.error).toMatch(/Size mismatch/);
            expect(result.maxMalloc).toBeLessThanOrEqual(65536);
            expect(result.files).toEqual([]);
        });

        it('rejects an entry that inflates to less than its declared size', () => {
            const result = run(
                sampleEntry({ uncompressedSize: sample.length + 1 })
            );
            expect(result.error).toMatch(/Size mismatch/);
            expect(result.files).toEqual([]);
        });

        it('rejects a truncated stream', () => {
            const result = run(
                sampleEntry({
                    data: deflated.subarray(0, deflated.length >> 1)
                })
            );
            expect(result.error).toMatch(/Failed to decompress/);
            expect(result.files).toEqual([]);
        });

        it('rejects a non-empty declared size with no data', () => {
            const result = run(
                sampleEntry({ data: Buffer.alloc(0), uncompressedSize: 10 })
            );
            expect(result.error).not.toBeNull();
            expect(result.files).toEqual([]);
        });
    }
);
