//
//  Callback.h
//  LncRn
//
#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface Callback : NSObject
@property (nonatomic, copy) RCTResponseSenderBlock rnCallback;
-(void)setCallback:(RCTResponseSenderBlock)callback;
-(void)sendResult:(NSString *)data;
@end
