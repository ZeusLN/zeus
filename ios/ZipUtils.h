#import <React/RCTBridgeModule.h>

@interface ZipUtils : NSObject <RCTBridgeModule>

// Returns nil on success, otherwise the error message
+ (NSString *)extractZipAtPath:(NSString *)zipPath toDirectory:(NSString *)destDirPath;

@end
