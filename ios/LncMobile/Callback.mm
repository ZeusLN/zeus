// Callback.m
#import "Callback.h"
#import <React/RCTEventEmitter.h>
#import <Foundation/Foundation.h>

@implementation Callback

-(void)setCallback:(RCTResponseSenderBlock)callback {
    self.rnCallback = callback;
}

-(void)sendResult:(NSString *)data {
    self.rnCallback(@[data]);
}

@end
