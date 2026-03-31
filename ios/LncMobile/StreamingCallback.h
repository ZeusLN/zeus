//
//  StreamingCallback.h
//  LncRn
//
#import <Foundation/Foundation.h>
#import "Lndmobile.xcframework/ios-arm64/Lndmobile.framework/Headers/Lndmobile.objc.h"

@interface StreamingCallback : NSObject <LndmobileNativeCallback>
@property (assign) id delegate;
@property NSString *eventId;
-(void)setEventName:(NSString *)name;
-(void)sendResult:(NSString *)data;
@end
