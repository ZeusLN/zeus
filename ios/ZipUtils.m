#import "ZipUtils.h"
#import <zlib.h>
#import "zeus-Swift.h"

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

        // Find the end of central directory record. An archive comment may
        // follow it and may contain the record's signature, so only accept a
        // candidate whose comment length ends exactly at the end of the file
        // and whose central directory ends exactly where the record starts.
        // Zip64 archives, which put more records in between, are not read
        // here anyway.
        NSUInteger eocdOffset = length - 22;
        while (YES) {
            if (*(uint32_t *)(bytes + eocdOffset) == ZIP_END_CENTRAL_DIR_SIGNATURE) {
                uint16_t archiveCommentLen = *(uint16_t *)(bytes + eocdOffset + 20);
                uint32_t candidateCdSize = *(uint32_t *)(bytes + eocdOffset + 12);
                uint32_t candidateCdOffset = *(uint32_t *)(bytes + eocdOffset + 16);
                if (eocdOffset + 22 + archiveCommentLen == length &&
                    (uint64_t)candidateCdOffset + (uint64_t)candidateCdSize == (uint64_t)eocdOffset) {
                    break;
                }
            }
            if (eocdOffset == 0 || length - eocdOffset >= 22 + UINT16_MAX) {
                reject(@"ERR_UNZIP", @"Invalid zip file: end of central directory not found", nil);
                return;
            }
            eocdOffset--;
        }

        uint16_t numEntries = *(uint16_t *)(bytes + eocdOffset + 10);
        NSUInteger offset = *(uint32_t *)(bytes + eocdOffset + 16);

        // Read each entry's method, CRC and sizes from the central directory.
        // Streaming writers such as java.util.zip.ZipOutputStream (used by the
        // Android ZipUtils.zipFolder) set general purpose flag bit 3 and leave
        // them zero in the local file header, with the real values in a data
        // descriptor after the data and in the central directory.
        for (uint16_t i = 0; i < numEntries; i++) {
            if (offset + 46 > eocdOffset || *(uint32_t *)(bytes + offset) != ZIP_CENTRAL_DIR_SIGNATURE) {
                reject(@"ERR_UNZIP", @"Invalid zip file: bad central directory entry", nil);
                return;
            }

            uint16_t method = *(uint16_t *)(bytes + offset + 10);
            uint32_t crc = *(uint32_t *)(bytes + offset + 16);
            uint32_t compSize = *(uint32_t *)(bytes + offset + 20);
            uint32_t uncompSize = *(uint32_t *)(bytes + offset + 24);
            uint16_t nameLen = *(uint16_t *)(bytes + offset + 28);
            uint16_t extraLen = *(uint16_t *)(bytes + offset + 30);
            uint16_t commentLen = *(uint16_t *)(bytes + offset + 32);
            NSUInteger localOffset = *(uint32_t *)(bytes + offset + 42);

            if (offset + 46 + nameLen + extraLen + commentLen > eocdOffset) {
                reject(@"ERR_UNZIP", @"Invalid zip file: bad central directory entry", nil);
                return;
            }

            NSString *entryName = [[NSString alloc] initWithBytes:(bytes + offset + 46) length:nameLen encoding:NSUTF8StringEncoding];

            offset += 46 + nameLen + extraLen + commentLen;

            if (localOffset + 30 > length || *(uint32_t *)(bytes + localOffset) != ZIP_LOCAL_HEADER_SIGNATURE) {
                reject(@"ERR_UNZIP", @"Invalid zip file: bad local file header", nil);
                return;
            }

            // The local header's name and extra field lengths can differ from
            // the central directory's
            uint16_t localNameLen = *(uint16_t *)(bytes + localOffset + 26);
            uint16_t localExtraLen = *(uint16_t *)(bytes + localOffset + 28);
            NSUInteger dataOffset = localOffset + 30 + localNameLen + localExtraLen;

            if (dataOffset + compSize > length) {
                reject(@"ERR_UNZIP", @"Truncated zip file", nil);
                return;
            }

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

            // Verify size and CRC
            uint32_t actualCrc = (uint32_t)crc32(0L, fileData.bytes, (uInt)fileData.length);
            if (fileData.length != uncompSize || actualCrc != crc) {
                reject(@"ERR_UNZIP", [NSString stringWithFormat:@"Size or CRC mismatch for: %@", entryName], nil);
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

#pragma mark - Encrypt

RCT_EXPORT_METHOD(encryptFile:(NSString *)inputPath
                  outputPath:(NSString *)outputPath
                  passphrase:(NSString *)passphrase
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
        NSData *plaintext = [NSData dataWithContentsOfFile:inputPath];
        if (!plaintext) {
            reject(@"ERR_ENCRYPT", [NSString stringWithFormat:@"Input file does not exist: %@", inputPath], nil);
            return;
        }

        NSError *error = nil;
        NSData *output = [CryptoHelper encryptData:plaintext passphrase:passphrase error:&error];
        if (!output) {
            reject(@"ERR_ENCRYPT", error.localizedDescription ?: @"Encryption failed", error);
            return;
        }

        if ([output writeToFile:outputPath atomically:YES]) {
            resolve(nil);
        } else {
            reject(@"ERR_ENCRYPT", @"Failed to write encrypted file", nil);
        }
    });
}

#pragma mark - Decrypt

RCT_EXPORT_METHOD(decryptFile:(NSString *)inputPath
                  outputPath:(NSString *)outputPath
                  passphrase:(NSString *)passphrase
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
        NSData *fileData = [NSData dataWithContentsOfFile:inputPath];
        if (!fileData) {
            reject(@"ERR_DECRYPT", [NSString stringWithFormat:@"Input file does not exist: %@", inputPath], nil);
            return;
        }

        NSError *error = nil;
        NSData *plaintext = [CryptoHelper decryptData:fileData passphrase:passphrase error:&error];
        if (!plaintext) {
            reject(@"ERR_DECRYPT", error.localizedDescription ?: @"Decryption failed. Incorrect seed or corrupted file.", error);
            return;
        }

        if ([plaintext writeToFile:outputPath atomically:YES]) {
            resolve(nil);
        } else {
            reject(@"ERR_DECRYPT", @"Failed to write decrypted file", nil);
        }
    });
}

@end
