//
//  StreamingCallback.h
//  LncRn
//
#import <Foundation/Foundation.h>
#import "Lndmobile.xcframework/ios-arm64/Lndmobile.framework/Headers/Lndmobile.objc.h"

@interface StreamingCallback : NSObject <LndmobileNativeCallback>
// weak: the delegate is the bridge-owned LncModule; the Go-side stream can
// outlive it (e.g. bridge reload), and an assign reference would dangle.
@property (weak) id delegate;
@property NSString *eventId;
// Set for the key callbacks, whose event names are shared across namespaces:
// a dial that outlives a wallet switch keeps reporting on them, so the
// payload carries the namespace for JS to filter on.
@property NSString *nameSpace;
-(void)setEventName:(NSString *)name;
-(void)sendResult:(NSString *)data;
@end
