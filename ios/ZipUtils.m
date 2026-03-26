#import "ZipUtils.h"
#import <zlib.h>

// Minizip-compatible local file header constants
#define ZIP_LOCAL_HEADER_SIGNATURE 0x04034b50
#define ZIP_CENTRAL_DIR_SIGNATURE 0x02014b50
#define ZIP_END_CENTRAL_DIR_SIGNATURE 0x06054b50
#define ZIP_VERSION_NEEDED 20
#define ZIP_COMPRESSION_DEFLATE 8
#define ZIP_COMPRESSION_STORE 0

@implementation ZipUtils

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup {
    return NO;
}

#pragma mark - Zip

RCT_EXPORT_METHOD(zipFolder:(NSString *)sourceDirPath
                  destPath:(NSString *)destZipPath
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
        NSFileManager *fm = [NSFileManager defaultManager];
        BOOL isDir;
        if (![fm fileExistsAtPath:sourceDirPath isDirectory:&isDir] || !isDir) {
            reject(@"ERR_ZIP", [NSString stringWithFormat:@"Source directory does not exist: %@", sourceDirPath], nil);
            return;
        }

        NSError *error;
        NSArray<NSString *> *files = [fm contentsOfDirectoryAtPath:sourceDirPath error:&error];
        if (error) {
            reject(@"ERR_ZIP", error.localizedDescription, error);
            return;
        }

        NSMutableData *zipData = [NSMutableData data];
        NSMutableArray *centralDirEntries = [NSMutableArray array];
        uint32_t centralDirOffset = 0;

        for (NSString *fileName in files) {
            NSString *filePath = [sourceDirPath stringByAppendingPathComponent:fileName];
            BOOL fileIsDir;
            if (![fm fileExistsAtPath:filePath isDirectory:&fileIsDir] || fileIsDir) continue;

            NSData *fileData = [NSData dataWithContentsOfFile:filePath];
            if (!fileData) continue;

            NSData *compressedData = [self deflateData:fileData];
            BOOL useStore = (compressedData == nil || compressedData.length >= fileData.length);
            NSData *dataToWrite = useStore ? fileData : compressedData;
            uint16_t method = useStore ? ZIP_COMPRESSION_STORE : ZIP_COMPRESSION_DEFLATE;

            uint32_t crc = (uint32_t)crc32(0L, fileData.bytes, (uInt)fileData.length);
            NSData *fileNameData = [fileName dataUsingEncoding:NSUTF8StringEncoding];

            uint32_t localHeaderOffset = (uint32_t)zipData.length;

            // Local file header
            uint32_t sig = ZIP_LOCAL_HEADER_SIGNATURE;
            uint16_t versionNeeded = ZIP_VERSION_NEEDED;
            uint16_t flags = 0;
            uint16_t nameLen = (uint16_t)fileNameData.length;
            uint16_t extraLen = 0;
            uint32_t compSize = (uint32_t)dataToWrite.length;
            uint32_t uncompSize = (uint32_t)fileData.length;

            [zipData appendBytes:&sig length:4];
            [zipData appendBytes:&versionNeeded length:2];
            [zipData appendBytes:&flags length:2];
            [zipData appendBytes:&method length:2];
            uint16_t modTime = 0, modDate = 0;
            [zipData appendBytes:&modTime length:2];
            [zipData appendBytes:&modDate length:2];
            [zipData appendBytes:&crc length:4];
            [zipData appendBytes:&compSize length:4];
            [zipData appendBytes:&uncompSize length:4];
            [zipData appendBytes:&nameLen length:2];
            [zipData appendBytes:&extraLen length:2];
            [zipData appendData:fileNameData];
            [zipData appendData:dataToWrite];

            // Build central directory entry
            NSMutableData *cdEntry = [NSMutableData data];
            uint32_t cdSig = ZIP_CENTRAL_DIR_SIGNATURE;
            uint16_t versionMade = ZIP_VERSION_NEEDED;
            uint16_t diskNum = 0;
            uint16_t intAttr = 0;
            uint32_t extAttr = 0;

            [cdEntry appendBytes:&cdSig length:4];
            [cdEntry appendBytes:&versionMade length:2];
            [cdEntry appendBytes:&versionNeeded length:2];
            [cdEntry appendBytes:&flags length:2];
            [cdEntry appendBytes:&method length:2];
            [cdEntry appendBytes:&modTime length:2];
            [cdEntry appendBytes:&modDate length:2];
            [cdEntry appendBytes:&crc length:4];
            [cdEntry appendBytes:&compSize length:4];
            [cdEntry appendBytes:&uncompSize length:4];
            [cdEntry appendBytes:&nameLen length:2];
            [cdEntry appendBytes:&extraLen length:2];
            uint16_t commentLen = 0;
            [cdEntry appendBytes:&commentLen length:2];
            [cdEntry appendBytes:&diskNum length:2];
            [cdEntry appendBytes:&intAttr length:2];
            [cdEntry appendBytes:&extAttr length:4];
            [cdEntry appendBytes:&localHeaderOffset length:4];
            [cdEntry appendData:fileNameData];

            [centralDirEntries addObject:cdEntry];
        }

        centralDirOffset = (uint32_t)zipData.length;
        uint32_t centralDirSize = 0;
        for (NSData *entry in centralDirEntries) {
            [zipData appendData:entry];
            centralDirSize += (uint32_t)entry.length;
        }

        // End of central directory
        uint32_t eocdSig = ZIP_END_CENTRAL_DIR_SIGNATURE;
        uint16_t diskNum = 0;
        uint16_t numEntries = (uint16_t)centralDirEntries.count;
        uint16_t commentLen = 0;

        [zipData appendBytes:&eocdSig length:4];
        [zipData appendBytes:&diskNum length:2];
        [zipData appendBytes:&diskNum length:2];
        [zipData appendBytes:&numEntries length:2];
        [zipData appendBytes:&numEntries length:2];
        [zipData appendBytes:&centralDirSize length:4];
        [zipData appendBytes:&centralDirOffset length:4];
        [zipData appendBytes:&commentLen length:2];

        BOOL success = [zipData writeToFile:destZipPath atomically:YES];
        if (success) {
            resolve(nil);
        } else {
            reject(@"ERR_ZIP", @"Failed to write zip file", nil);
        }
    });
}

- (NSData *)deflateData:(NSData *)data {
    if (data.length == 0) return nil;

    z_stream stream;
    memset(&stream, 0, sizeof(stream));
    // -MAX_WBITS for raw deflate (no zlib/gzip header)
    if (deflateInit2(&stream, Z_DEFAULT_COMPRESSION, Z_DEFLATED, -MAX_WBITS, 8, Z_DEFAULT_STRATEGY) != Z_OK) {
        return nil;
    }

    stream.next_in = (Bytef *)data.bytes;
    stream.avail_in = (uInt)data.length;

    NSMutableData *compressed = [NSMutableData dataWithLength:deflateBound(&stream, (uLong)data.length)];
    stream.next_out = (Bytef *)compressed.mutableBytes;
    stream.avail_out = (uInt)compressed.length;

    int status = deflate(&stream, Z_FINISH);
    deflateEnd(&stream);

    if (status != Z_STREAM_END) return nil;

    compressed.length = stream.total_out;
    return compressed;
}

#pragma mark - Unzip

RCT_EXPORT_METHOD(unzipFile:(NSString *)zipPath
                  destPath:(NSString *)destDirPath
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
        NSFileManager *fm = [NSFileManager defaultManager];
        if (![fm fileExistsAtPath:zipPath]) {
            reject(@"ERR_UNZIP", [NSString stringWithFormat:@"Zip file does not exist: %@", zipPath], nil);
            return;
        }

        NSData *zipData = [NSData dataWithContentsOfFile:zipPath];
        if (!zipData || zipData.length < 22) {
            reject(@"ERR_UNZIP", @"Invalid or empty zip file", nil);
            return;
        }

        if (![fm fileExistsAtPath:destDirPath]) {
            NSError *error;
            [fm createDirectoryAtPath:destDirPath withIntermediateDirectories:YES attributes:nil error:&error];
            if (error) {
                reject(@"ERR_UNZIP", error.localizedDescription, error);
                return;
            }
        }

        const uint8_t *bytes = zipData.bytes;
        NSUInteger length = zipData.length;
        NSUInteger offset = 0;

        while (offset + 30 <= length) {
            uint32_t sig = *(uint32_t *)(bytes + offset);
            if (sig != ZIP_LOCAL_HEADER_SIGNATURE) break;

            uint16_t method = *(uint16_t *)(bytes + offset + 8);
            uint32_t crc = *(uint32_t *)(bytes + offset + 14);
            uint32_t compSize = *(uint32_t *)(bytes + offset + 18);
            uint32_t uncompSize = *(uint32_t *)(bytes + offset + 22);
            uint16_t nameLen = *(uint16_t *)(bytes + offset + 26);
            uint16_t extraLen = *(uint16_t *)(bytes + offset + 28);

            if (offset + 30 + nameLen + extraLen + compSize > length) {
                reject(@"ERR_UNZIP", @"Truncated zip file", nil);
                return;
            }

            NSString *entryName = [[NSString alloc] initWithBytes:(bytes + offset + 30) length:nameLen encoding:NSUTF8StringEncoding];
            NSUInteger dataOffset = offset + 30 + nameLen + extraLen;

            offset = dataOffset + compSize;

            if (!entryName || [entryName hasSuffix:@"/"] || [entryName containsString:@".."]) continue;

            // Strip path components — only use the filename
            NSString *safeName = [entryName lastPathComponent];
            NSString *destFilePath = [destDirPath stringByAppendingPathComponent:safeName];

            NSData *fileData;
            if (method == ZIP_COMPRESSION_STORE) {
                fileData = [NSData dataWithBytes:(bytes + dataOffset) length:compSize];
            } else if (method == ZIP_COMPRESSION_DEFLATE) {
                fileData = [self inflateData:[NSData dataWithBytesNoCopy:(void *)(bytes + dataOffset) length:compSize freeWhenDone:NO]
                            expectedSize:uncompSize];
                if (!fileData) {
                    reject(@"ERR_UNZIP", [NSString stringWithFormat:@"Failed to decompress: %@", entryName], nil);
                    return;
                }
            } else {
                reject(@"ERR_UNZIP", [NSString stringWithFormat:@"Unsupported compression method %d for: %@", method, entryName], nil);
                return;
            }

            // Verify CRC
            uint32_t actualCrc = (uint32_t)crc32(0L, fileData.bytes, (uInt)fileData.length);
            if (actualCrc != crc && crc != 0) {
                reject(@"ERR_UNZIP", [NSString stringWithFormat:@"CRC mismatch for: %@", entryName], nil);
                return;
            }

            [fileData writeToFile:destFilePath atomically:YES];
        }

        resolve(nil);
    });
}

- (NSData *)inflateData:(NSData *)data expectedSize:(uint32_t)expectedSize {
    if (data.length == 0) return [NSData data];

    z_stream stream;
    memset(&stream, 0, sizeof(stream));
    // -MAX_WBITS for raw inflate (no zlib/gzip header)
    if (inflateInit2(&stream, -MAX_WBITS) != Z_OK) {
        return nil;
    }

    stream.next_in = (Bytef *)data.bytes;
    stream.avail_in = (uInt)data.length;

    NSMutableData *decompressed = [NSMutableData dataWithLength:expectedSize > 0 ? expectedSize : data.length * 4];
    stream.next_out = (Bytef *)decompressed.mutableBytes;
    stream.avail_out = (uInt)decompressed.length;

    int status = inflate(&stream, Z_FINISH);

    if (status != Z_STREAM_END && status != Z_OK) {
        // Try with more buffer
        if (status == Z_BUF_ERROR) {
            decompressed.length = decompressed.length * 2;
            stream.next_out = (Bytef *)decompressed.mutableBytes + stream.total_out;
            stream.avail_out = (uInt)(decompressed.length - stream.total_out);
            status = inflate(&stream, Z_FINISH);
        }
        if (status != Z_STREAM_END && status != Z_OK) {
            inflateEnd(&stream);
            return nil;
        }
    }

    decompressed.length = stream.total_out;
    inflateEnd(&stream);
    return decompressed;
}

@end
