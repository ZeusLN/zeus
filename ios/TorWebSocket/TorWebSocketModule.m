#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(TorWebSocketModule, RCTEventEmitter)

RCT_EXTERN_METHOD(connect:(NSString *)id url:(NSString *)url headers:(NSDictionary *)headers socksPort:(nonnull NSNumber *)socksPort)
RCT_EXTERN_METHOD(send:(NSString *)id message:(NSString *)message)
RCT_EXTERN_METHOD(close:(NSString *)id)

@end
