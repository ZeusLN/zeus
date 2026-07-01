// Callback.m
#import "Callback.h"
#import <React/RCTEventEmitter.h>
#import <Foundation/Foundation.h>
#include <atomic>

@implementation Callback {
    std::atomic<bool> _consumed;
}

-(instancetype)init {
    if ((self = [super init])) {
        _consumed.store(false, std::memory_order_relaxed);
    }
    return self;
}

-(void)setCallback:(RCTResponseSenderBlock)callback {
    self.rnCallback = callback;
}

-(void)sendResult:(NSString *)data {
    // Under React Native's new architecture, RCTResponseSenderBlock can only be
    // invoked once. The Go LNC bridge may legitimately fire callbacks more than
    // once for some routes (potentially from different threads); the atomic
    // compare-exchange drops subsequent invocations safely to avoid a fatal abort.
    bool expected = false;
    if (!_consumed.compare_exchange_strong(expected, true)) {
        return;
    }
    RCTResponseSenderBlock cb = self.rnCallback;
    if (cb == nil) {
        return;
    }
    // Defend against a nil data argument — @[nil] would throw NSInvalidArgumentException.
    cb(@[data ?: @""]);
}

@end
