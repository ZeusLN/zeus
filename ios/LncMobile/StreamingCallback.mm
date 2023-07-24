// StreamingCallback.m
#import "StreamingCallback.h"
#import <React/RCTEventEmitter.h>
#import <Foundation/Foundation.h>
@implementation StreamingCallback

-(void)setEventName:(NSString *)name {
    self.eventId = name;
}

-(void)sendResult:(NSString *)data {
    [self.delegate sendEventWithName:self.eventId body:@{@"result": data}];
}

@end
