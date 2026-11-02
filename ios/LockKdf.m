#import "LockKdf.h"
#import <CommonCrypto/CommonCrypto.h>

// PBKDF2-HMAC-SHA256 for the app-lock verifiers (utils/LockVerifierUtils).
// The derivation runs here rather than in JS because a pure-JS KDF under
// Hermes takes seconds per attempt. The secret arrives as hex of its UTF-8
// bytes, so CommonCrypto derives over exactly the bytes JS encoded.

static const NSUInteger kLockKdfMaxKeyLen = 64;

static int LockKdfHexValue(unichar c) {
    if (c >= '0' && c <= '9') return c - '0';
    if (c >= 'a' && c <= 'f') return c - 'a' + 10;
    if (c >= 'A' && c <= 'F') return c - 'A' + 10;
    return -1;
}

static NSData *LockKdfDataFromHex(NSString *hex) {
    if (hex == nil || hex.length % 2 != 0) {
        return nil;
    }
    NSMutableData *data = [NSMutableData dataWithLength:hex.length / 2];
    uint8_t *bytes = data.mutableBytes;
    for (NSUInteger i = 0; i < data.length; i++) {
        int hi = LockKdfHexValue([hex characterAtIndex:2 * i]);
        int lo = LockKdfHexValue([hex characterAtIndex:2 * i + 1]);
        if (hi < 0 || lo < 0) {
            return nil;
        }
        bytes[i] = (uint8_t)((hi << 4) | lo);
    }
    return data;
}

static NSString *LockKdfHexFromData(NSData *data) {
    const uint8_t *bytes = data.bytes;
    NSMutableString *hex = [NSMutableString stringWithCapacity:data.length * 2];
    for (NSUInteger i = 0; i < data.length; i++) {
        [hex appendFormat:@"%02x", bytes[i]];
    }
    return hex;
}

@implementation LockKdf

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup {
    return NO;
}

// The global concurrent queue lets the primary and duress checks of one
// unlock attempt run at the same time.
RCT_EXPORT_METHOD(pbkdf2Sha256:(NSString *)secretHex
                  saltHex:(NSString *)saltHex
                  iterations:(double)iterations
                  keyLen:(double)keyLen
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    if (iterations < 1 || iterations > UINT32_MAX || iterations != floor(iterations) ||
        keyLen < 1 || keyLen > kLockKdfMaxKeyLen || keyLen != floor(keyLen)) {
        reject(@"ERR_LOCK_KDF", @"Invalid PBKDF2 parameters", nil);
        return;
    }
    dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
        NSMutableData *secret = [LockKdfDataFromHex(secretHex) mutableCopy];
        NSData *salt = LockKdfDataFromHex(saltHex);
        if (secret.length == 0 || salt.length == 0) {
            reject(@"ERR_LOCK_KDF", @"Invalid secret or salt", nil);
            return;
        }
        NSMutableData *derived = [NSMutableData dataWithLength:(NSUInteger)keyLen];
        int status = CCKeyDerivationPBKDF(kCCPBKDF2,
                                          secret.bytes,
                                          secret.length,
                                          salt.bytes,
                                          salt.length,
                                          kCCPRFHmacAlgSHA256,
                                          (unsigned int)iterations,
                                          derived.mutableBytes,
                                          derived.length);
        memset(secret.mutableBytes, 0, secret.length);
        if (status != kCCSuccess) {
            reject(@"ERR_LOCK_KDF", @"Key derivation failed", nil);
            return;
        }
        resolve(LockKdfHexFromData(derived));
    });
}

@end
