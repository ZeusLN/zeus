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
// Upper bound on the total bytes unzipFile writes, as in the Android
// ZipUtils: a channel backup is lnd's graph directory, usually tens to a few
// hundred MB on a mobile node
#define ZIP_MAX_UNZIP_BYTES (4ULL * 1024 * 1024 * 1024)

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

static uint16_t ZipRead16(const uint8_t *p) {
    return (uint16_t)(p[0] | (p[1] << 8));
}

static uint32_t ZipRead32(const uint8_t *p) {
    return (uint32_t)p[0] | ((uint32_t)p[1] << 8) | ((uint32_t)p[2] << 16) | ((uint32_t)p[3] << 24);
}

RCT_EXPORT_METHOD(unzipFile:(NSString *)zipPath
                  destPath:(NSString *)destDirPath
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
        NSString *message = [ZipUtils extractZipAtPath:zipPath toDirectory:destDirPath];
        if (message) {
            reject(@"ERR_UNZIP", message, nil);
        } else {
            resolve(nil);
        }
    });
}

// Extracts every file entry of the archive into destDirPath, flattened to
// its file name. Returns nil when it worked and the error message when it
// did not, in which case the files it wrote have been removed again.
//
// Entries are read from the central directory. Its sizes and CRC are always
// filled in, while a writer that streams (java.util.zip.ZipOutputStream, so
// Android's zipFolder) leaves them 0 in the local headers and sets the data
// descriptor flag. Each entry is inflated in pieces straight to a file, and
// its size and CRC are checked against the central directory.
+ (NSString *)extractZipAtPath:(NSString *)zipPath toDirectory:(NSString *)destDirPath {
    NSFileManager *fm = [NSFileManager defaultManager];
    if (![fm fileExistsAtPath:zipPath]) {
        return [NSString stringWithFormat:@"Zip file does not exist: %@", zipPath];
    }

    NSData *zipData = [NSData dataWithContentsOfFile:zipPath options:NSDataReadingMappedIfSafe error:nil];
    if (!zipData || zipData.length < 22) {
        return @"Invalid or empty zip file";
    }

    const uint8_t *bytes = zipData.bytes;
    uint64_t length = zipData.length;

    // The end of central directory record is the last thing in the file,
    // followed only by its comment (at most 65535 bytes). A candidate
    // counts only if its comment ends exactly at the end of the file and
    // its central directory lies before it, so the same signature inside a
    // comment is not taken for the record.
    uint64_t eocd = UINT64_MAX;
    uint64_t lowest = length > 22 + 65535 ? length - 22 - 65535 : 0;
    for (uint64_t i = length - 22;; i--) {
        if (ZipRead32(bytes + i) == ZIP_END_CENTRAL_DIR_SIGNATURE && i + 22 + ZipRead16(bytes + i + 20) == length) {
            uint32_t size = ZipRead32(bytes + i + 12);
            uint32_t start = ZipRead32(bytes + i + 16);
            // Zip64 markers are let through here and rejected below
            if (size == 0xFFFFFFFF || start == 0xFFFFFFFF || (uint64_t)start + size <= i) {
                eocd = i;
                break;
            }
        }
        if (i == lowest) break;
    }
    if (eocd == UINT64_MAX) {
        return @"Invalid zip file: no end of central directory record";
    }

    uint16_t entryCount = ZipRead16(bytes + eocd + 10);
    uint32_t cdSize = ZipRead32(bytes + eocd + 12);
    uint32_t cdOffset = ZipRead32(bytes + eocd + 16);
    if (ZipRead16(bytes + eocd + 4) != 0 || ZipRead16(bytes + eocd + 6) != 0 ||
        ZipRead16(bytes + eocd + 8) != entryCount) {
        return @"Multi-disk zip files are not supported";
    }
    if (entryCount == 0xFFFF || cdSize == 0xFFFFFFFF || cdOffset == 0xFFFFFFFF) {
        return @"Zip64 files are not supported";
    }
    if (entryCount == 0) {
        return @"Zip file has no entries";
    }

    if (![fm fileExistsAtPath:destDirPath]) {
        NSError *error;
        [fm createDirectoryAtPath:destDirPath withIntermediateDirectories:YES attributes:nil error:&error];
        if (error) {
            return error.localizedDescription;
        }
    }

    // Files this call has written, removed again if it fails
    NSMutableArray<NSString *> *written = [NSMutableArray array];
    NSString *failure = nil;
    unsigned long long total = 0;
    uint64_t cdEnd = (uint64_t)cdOffset + cdSize;
    uint64_t pos = cdOffset;
    size_t bufferSize = 64 * 1024;
    uint8_t *buffer = malloc(bufferSize);

    for (uint16_t index = 0; index < entryCount && !failure; index++) {
        if (pos + 46 > cdEnd || ZipRead32(bytes + pos) != ZIP_CENTRAL_DIR_SIGNATURE) {
            failure = @"Invalid zip file: bad central directory";
            break;
        }
        const uint8_t *cd = bytes + pos;
        uint16_t flags = ZipRead16(cd + 8);
        uint16_t method = ZipRead16(cd + 10);
        uint32_t crc = ZipRead32(cd + 16);
        uint32_t compSize = ZipRead32(cd + 20);
        uint32_t uncompSize = ZipRead32(cd + 24);
        uint16_t nameLen = ZipRead16(cd + 28);
        uint32_t localOffset = ZipRead32(cd + 42);
        uint64_t next = pos + 46 + nameLen + ZipRead16(cd + 30) + ZipRead16(cd + 32);
        if (next > cdEnd) {
            failure = @"Invalid zip file: bad central directory";
            break;
        }
        NSString *entryName = [[NSString alloc] initWithBytes:(cd + 46) length:nameLen encoding:NSUTF8StringEncoding];
        pos = next;

        if (!entryName || [entryName hasSuffix:@"/"] || [entryName containsString:@".."]) continue;

        if (flags & 0x1) {
            failure = [NSString stringWithFormat:@"Encrypted zip entry is not supported: %@", entryName];
            break;
        }
        if (compSize == 0xFFFFFFFF || uncompSize == 0xFFFFFFFF || localOffset == 0xFFFFFFFF) {
            failure = @"Zip64 files are not supported";
            break;
        }
        if (method != ZIP_COMPRESSION_STORE && method != ZIP_COMPRESSION_DEFLATE) {
            failure = [NSString stringWithFormat:@"Unsupported compression method %d for: %@", method, entryName];
            break;
        }

        // The local header is only used to find where the data starts
        if ((uint64_t)localOffset + 30 > cdOffset || ZipRead32(bytes + localOffset) != ZIP_LOCAL_HEADER_SIGNATURE) {
            failure = @"Invalid zip file: bad local file header";
            break;
        }
        // Without the data descriptor flag the local header repeats the
        // central directory's values, and an archive where they differ is
        // not read
        const uint8_t *local = bytes + localOffset;
        BOOL hasDescriptor = (ZipRead16(local + 6) & 0x8) != 0;
        if (ZipRead16(local + 8) != method ||
            (!hasDescriptor && (ZipRead32(local + 14) != crc || ZipRead32(local + 18) != compSize ||
                                ZipRead32(local + 22) != uncompSize))) {
            failure = [NSString stringWithFormat:@"Invalid zip file: headers differ for: %@", entryName];
            break;
        }
        uint64_t dataOffset = (uint64_t)localOffset + 30 + ZipRead16(local + 26) + ZipRead16(local + 28);
        if (dataOffset + compSize > cdOffset) {
            failure = @"Truncated zip file";
            break;
        }
        if (method == ZIP_COMPRESSION_STORE && compSize != uncompSize) {
            failure = [NSString stringWithFormat:@"Size mismatch for: %@", entryName];
            break;
        }

        // No more than uncompSize bytes are written for an entry, so the
        // declared sizes bound what this call writes
        if (total + uncompSize > ZIP_MAX_UNZIP_BYTES) {
            failure = [NSString stringWithFormat:@"Zip contents exceed the maximum size of %llu bytes", ZIP_MAX_UNZIP_BYTES];
            break;
        }

        // Only the file name is used, never the entry's directories
        NSString *safeName = [entryName lastPathComponent];
        NSString *destFilePath = [destDirPath stringByAppendingPathComponent:safeName];
        NSString *tempFilePath = [destDirPath stringByAppendingPathComponent:
                                  [NSString stringWithFormat:@".%@.unzip", [NSUUID UUID].UUIDString]];

        FILE *out = fopen(tempFilePath.fileSystemRepresentation, "wb");
        if (!out) {
            failure = [NSString stringWithFormat:@"Failed to write: %@ (%s)", safeName, strerror(errno)];
            break;
        }
        [written addObject:tempFilePath];

        uint32_t actualCrc = (uint32_t)crc32(0L, Z_NULL, 0);
        uint64_t actualSize = 0;

        if (method == ZIP_COMPRESSION_STORE) {
            uint64_t done = 0;
            while (done < compSize && !failure) {
                size_t piece = (size_t)MIN((uint64_t)bufferSize, compSize - done);
                actualCrc = (uint32_t)crc32(actualCrc, bytes + dataOffset + done, (uInt)piece);
                if (fwrite(bytes + dataOffset + done, 1, piece, out) != piece) {
                    failure = [NSString stringWithFormat:@"Failed to write: %@ (%s)", safeName, strerror(errno)];
                }
                done += piece;
            }
            actualSize = done;
        } else {
            z_stream stream;
            memset(&stream, 0, sizeof(stream));
            // -MAX_WBITS for raw inflate (no zlib/gzip header)
            if (inflateInit2(&stream, -MAX_WBITS) != Z_OK) {
                failure = [NSString stringWithFormat:@"Failed to decompress: %@", entryName];
            } else {
                stream.next_in = (Bytef *)(bytes + dataOffset);
                stream.avail_in = (uInt)compSize;
                int status = Z_OK;
                while (status != Z_STREAM_END && !failure) {
                    stream.next_out = buffer;
                    stream.avail_out = (uInt)bufferSize;
                    status = inflate(&stream, Z_NO_FLUSH);
                    size_t produced = bufferSize - stream.avail_out;
                    // Z_BUF_ERROR here means the input ended before the
                    // stream did
                    if (status != Z_OK && status != Z_STREAM_END) {
                        failure = [NSString stringWithFormat:@"Failed to decompress: %@", entryName];
                    } else if (actualSize + produced > uncompSize) {
                        failure = [NSString stringWithFormat:@"Size mismatch for: %@", entryName];
                    } else if (produced > 0) {
                        actualCrc = (uint32_t)crc32(actualCrc, buffer, (uInt)produced);
                        actualSize += produced;
                        if (fwrite(buffer, 1, produced, out) != produced) {
                            failure = [NSString stringWithFormat:@"Failed to write: %@ (%s)", safeName, strerror(errno)];
                        }
                    }
                }
                inflateEnd(&stream);
            }
        }

        if (fclose(out) != 0 && !failure) {
            failure = [NSString stringWithFormat:@"Failed to write: %@ (%s)", safeName, strerror(errno)];
        }
        if (!failure && actualSize != uncompSize) {
            failure = [NSString stringWithFormat:@"Size mismatch for: %@", entryName];
        }
        if (!failure && actualCrc != crc) {
            failure = [NSString stringWithFormat:@"CRC mismatch for: %@", entryName];
        }
        // rename replaces a file of that name and fails on a directory
        if (!failure && rename(tempFilePath.fileSystemRepresentation, destFilePath.fileSystemRepresentation) != 0) {
            failure = [NSString stringWithFormat:@"Failed to write: %@ (%s)", safeName, strerror(errno)];
        }
        if (failure) break;

        [written removeLastObject];
        [written addObject:destFilePath];
        total += actualSize;
    }

    free(buffer);

    if (failure) {
        for (NSString *path in written) {
            [fm removeItemAtPath:path error:nil];
        }
    }
    return failure;
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

#pragma mark - Encrypt (string)

RCT_EXPORT_METHOD(encryptString:(NSString *)plaintextBase64
                  passphrase:(NSString *)passphrase
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
        NSData *plaintext = [[NSData alloc] initWithBase64EncodedString:plaintextBase64
                                                                options:NSDataBase64DecodingIgnoreUnknownCharacters];
        if (!plaintext) {
            reject(@"ERR_ENCRYPT", @"Invalid base64 input", nil);
            return;
        }

        NSError *error = nil;
        NSData *output = [CryptoHelper encryptData:plaintext passphrase:passphrase error:&error];
        if (!output) {
            reject(@"ERR_ENCRYPT", error.localizedDescription ?: @"Encryption failed", error);
            return;
        }

        resolve([output base64EncodedStringWithOptions:0]);
    });
}

#pragma mark - Decrypt (string)

RCT_EXPORT_METHOD(decryptString:(NSString *)dataBase64
                  passphrase:(NSString *)passphrase
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
        NSData *fileData = [[NSData alloc] initWithBase64EncodedString:dataBase64
                                                               options:NSDataBase64DecodingIgnoreUnknownCharacters];
        if (!fileData) {
            reject(@"ERR_DECRYPT", @"Invalid base64 input", nil);
            return;
        }

        NSError *error = nil;
        NSData *plaintext = [CryptoHelper decryptData:fileData passphrase:passphrase error:&error];
        if (!plaintext) {
            reject(@"ERR_DECRYPT", error.localizedDescription ?: @"Decryption failed. Incorrect seed or corrupted file.", error);
            return;
        }

        resolve([plaintext base64EncodedStringWithOptions:0]);
    });
}

@end
