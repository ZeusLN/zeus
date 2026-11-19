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
    NSMutableDictionary *body = [NSMutableDictionary dictionaryWithObject:data forKey:@"result"];
    if (self.nameSpace) {
        body[@"namespace"] = self.nameSpace;
    }
    if (self.requestId.length > 0) {
        body[@"request_id"] = self.requestId;
    }
    [self.delegate sendEventWithName:self.eventId body:body];
}

@end
