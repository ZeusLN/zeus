//
//  Callback.h
//  LncRn
//
#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>
#import "Lndmobile.xcframework/ios-arm64/Lndmobile.framework/Headers/Lndmobile.objc.h"

@interface Callback : NSObject <LndmobileNativeCallback>
@property (nonatomic, copy) RCTResponseSenderBlock rnCallback;
-(void)setCallback:(RCTResponseSenderBlock)callback;
-(void)sendResult:(NSString *)data;
@end
