// StreamingCallback.m
#import "StreamingCallback.h"
#import <React/RCTEventEmitter.h>
#import <Foundation/Foundation.h>
@implementation StreamingCallback

-(void)setEventName:(NSString *)name {
    self.eventId = name;
}

-(void)sendResult:(NSString *)data {
    // The Go bridge declares this parameter nullable; wrapping nil in a
    // dictionary literal throws NSInvalidArgumentException. Unlike Callback,
    // no JS promise awaits an event, so a nil result is simply dropped.
    if (data == nil) {
        return;
    }
    [self.delegate sendEventWithName:self.eventId body:@{@"result": data}];
}

@end
