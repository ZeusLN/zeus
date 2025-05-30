#import "LncModule.h"
#import "Callback.h"
#import "StreamingCallback.h"
#import "Lndmobile.xcframework/ios-arm64/Lndmobile.framework/Headers/Lndmobile.h"

#ifdef RCT_NEW_ARCH_ENABLED
#import "RNLncRnSpec.h"
#endif

@implementation LncModule
RCT_EXPORT_MODULE()

RCT_EXPORT_METHOD(initLNC:(NSString *)nameSpace)
{
    NSError *error;
    LndmobileInitLNC(nameSpace, @"info", &error);
    if (error) {
        NSLog(@"Init error   %@",   error);
    }
}

RCT_EXPORT_METHOD(registerLocalPrivCreateCallback:(NSString *)nameSpace
                 resolver:(RCTResponseSenderBlock)onLocalPrivCreate)
{
    Callback *lpccb = [[Callback alloc] init];
    [lpccb setCallback:onLocalPrivCreate];
    NSError *error;
    LndmobileRegisterLocalPrivCreateCallback(nameSpace, lpccb, &error);
    if (error) {
        NSLog(@"registerLocalPrivCreateCallback error   %@",   error);
    }
}

RCT_EXPORT_METHOD(registerRemoteKeyReceiveCallback:(NSString *)nameSpace
                 resolver:(RCTResponseSenderBlock)onRemoteKeyReceive)
{
    Callback * rkrcb = [[Callback alloc] init];
    [rkrcb setCallback:onRemoteKeyReceive];
    NSError *error;
    LndmobileRegisterRemoteKeyReceiveCallback(nameSpace, rkrcb, &error);
    if (error) {
        NSLog(@"registerRemoteKeyReceiveCallback error   %@",   error);
    }
}

RCT_EXPORT_METHOD(registerAuthDataCallback:(NSString *)nameSpace
                 resolver:(RCTResponseSenderBlock)onAuthData)
{
    Callback * oacb = [[Callback alloc] init];
    [oacb setCallback:onAuthData];
    NSError *error;
    LndmobileRegisterAuthDataCallback(nameSpace, oacb, &error);
    if (error) {
        NSLog(@"registerAuthDataCallback error   %@",   error);
    }
}

RCT_EXPORT_METHOD(isConnected:(NSString *)nameSpace
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
    BOOL isConnected;
    NSError *error;
    LndmobileIsConnected(nameSpace, &isConnected, &error);
    if (error) {
        reject(@"isConnected_failure", @"error thrown", error);
    } else {
        resolve(@(isConnected));
    }
}

RCT_EXPORT_METHOD(status:(NSString *)nameSpace
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
    NSError *error;
    NSString *status = LndmobileStatus(nameSpace, &error);
    if (status) {
        resolve(status);
    } else if (error) {
        reject(@"status_failure", @"error thrown", error);
    }
}

RCT_EXPORT_METHOD(expiry:(NSString *)nameSpace
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
    NSError *error;
    NSString *expiry = LndmobileGetExpiry(nameSpace, &error);
    if (expiry) {
        resolve(expiry);
    } else if (error) {
        reject(@"expiry_error", @"error thrown", error);
    }
}

RCT_EXPORT_METHOD(isReadOnly:(NSString *)nameSpace
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    BOOL readOnly;
    NSError *error;
    LndmobileIsReadOnly(nameSpace, &readOnly, &error);
    if (error) {
        reject(@"isReadOnly_error", @"error thrown", error);
    } else {
        resolve(@(readOnly));
    }
}

RCT_EXPORT_METHOD(hasPerms:(NSString *)nameSpace
                  permission:(NSString *)permission
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    BOOL hasPermissions;
    NSError *error;
    LndmobileHasPermissions(nameSpace, permission, &hasPermissions, &error);
    if (error) {
        reject(@"hasPermissions_error", @"error thrown", error);
    } else {
        resolve(@(hasPermissions));
    }
}

RCT_EXPORT_METHOD(connectServer:(NSString *)nameSpace
                 mailboxServerAddr:(NSString *)mailboxServerAddr
                 isDevServer:(BOOL)isDevServer
                 connectPhrase:(NSString *)connectPhrase
                 localStatic:(NSString *)localStatic
                 remoteStatic:(NSString *)remoteStatic
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
    NSError *error;
    LndmobileConnectServer(nameSpace, mailboxServerAddr, isDevServer, connectPhrase, localStatic, remoteStatic, &error);
    if (error) {
        resolve(error.localizedDescription);
    } else {
        resolve(@"");
    }
}

RCT_EXPORT_METHOD(disconnect:(NSString *)nameSpace)
{
    NSError *error;
    LndmobileDisconnect(nameSpace, &error);
    if (error) {
        NSLog(@"disconnect error   %@",   error);
    }
}

RCT_EXPORT_METHOD(invokeRPC:(NSString *)nameSpace
                 route:(NSString *)route
                 requestData:(NSString *)requestData
                 resolver:(RCTResponseSenderBlock)resolve)
{
    Callback * gocb = [[Callback alloc] init];
    [gocb setCallback:resolve];
    NSError *error;
    LndmobileInvokeRPC(nameSpace, route, requestData, gocb, &error);
    if (error) {
        NSLog(@"connectServer error   %@",   error);
    }
}

// placeholders to prevent NativeEventEmitter from erroring
// on initialization
-(void)startObserving {}
-(void)stopObserving {}

RCT_EXPORT_METHOD(initListener:(NSString *)nameSpace
                  eventName:(NSString *)eventName
                  request:(NSString *)request)
{
    StreamingCallback * gocb = [[StreamingCallback alloc] init];
    gocb.delegate = self;
    [gocb setEventName:eventName];
    NSError *error;
    LndmobileInvokeRPC(nameSpace, eventName, request, gocb, &error);
    if (error) {
        NSLog(@"%@ error   %@", eventName, error);
    }
}

- (NSArray<NSString *> *)supportedEvents {
    return @[
        @"chainrpc.ChainNotifier.RegisterBlockEpochNtfn",
        @"chainrpc.ChainNotifier.RegisterConfirmationsNtfn",
        @"chainrpc.ChainNotifier.RegisterSpendNtfn",
        @"invoicesrpc.Invoices.SubscribeSingleInvoice",
        @"lnrpc.Lightning.ChannelAcceptor",
        @"lnrpc.Lightning.CloseChannel",
        @"lnrpc.Lightning.OpenChannel",
        @"lnrpc.Lightning.RegisterRPCMiddleware",
        @"lnrpc.Lightning.SendPayment",
        @"lnrpc.Lightning.SendToRoute",
        @"lnrpc.Lightning.SubscribeChannelBackups",
        @"lnrpc.Lightning.SubscribeChannelEvents",
        @"lnrpc.Lightning.SubscribeChannelGraph",
        @"lnrpc.Lightning.SubscribeCustomMessages",
        @"lnrpc.Lightning.SubscribeInvoices",
        @"lnrpc.Lightning.SubscribePeerEvents",
        @"lnrpc.Lightning.SubscribeTransactions",
        @"looprpc.SwapClient.Monitor",
        @"poolrpc.ChannelAuctioneer.SubscribeBatchAuction",
        @"poolrpc.ChannelAuctioneer.SubscribeSidecar",
        @"poolrpc.HashMail.RecvStream"
        @"routerrpc.Router.HtlcInterceptor",
        @"routerrpc.Router.SendPayment",
        @"routerrpc.Router.SendPaymentV2",
        @"routerrpc.Router.SubscribeHtlcEvents",
        @"routerrpc.Router.TrackPayment",
        @"routerrpc.Router.TrackPaymentV2"
    ];
}

// chantools

RCT_EXPORT_METHOD(sweepRemoteClosed:(NSString *)seedPhrase
                 apiURL:(NSString *)apiURL
                 sweepAddr:(NSString *)sweepAddr
                 recoveryWindow:(NSInteger)recoveryWindow
                 feeRate:(NSInteger)feeRate
                 sleepSeconds:(NSInteger)sleepSeconds
                 publish:(BOOL)publish
                 isTestnet:(BOOL)isTestnet
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
    NSError *error;
    NSString *response = LndmobileSweepRemoteClosed(seedPhrase, apiURL, sweepAddr, recoveryWindow, feeRate, sleepSeconds, publish, isTestnet, &error);
    if (error) {
        // Create a string representation of the error
        NSString *errorString = [NSString stringWithFormat:@"%@",
                                 error.localizedDescription];

        reject(@"sweepRemoteClosed_failure", errorString, error);
    } else {
        resolve(response);
    }
}

// Swaps

RCT_EXPORT_METHOD(createClaimTransaction:(NSString *)endpoint
                 swapId:(NSString *)swapId
                 claimLeaf:(NSString *)claimLeaf
                 refundLeaf:(NSString *)refundLeaf
                 privateKey:(NSString *)privateKey
                 servicePubKey:(NSString *)servicePubKey
                 transactionHash:(NSString *)transactionHash
                 pubNonce:(NSString *)pubNonce
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
    NSError *error;
    LndmobileCreateClaimTransaction(endpoint, swapId, claimLeaf, refundLeaf, privateKey, servicePubKey, transactionHash, pubNonce, &error);
    if (error) {
        NSLog(@"createClaimTransaction error   %@",   error);
        reject(@"createClaimTransaction_error", error.localizedDescription, error);
    } else {
        resolve(@"Success");
    }
}

RCT_EXPORT_METHOD(createReverseClaimTransaction:(NSString *)endpoint
                 swapId:(NSString *)swapId
                 claimLeaf:(NSString *)claimLeaf
                 refundLeaf:(NSString *)refundLeaf
                 privateKey:(NSString *)privateKey
                 servicePubKey:(NSString *)servicePubKey
                 preimageHex:(NSString *)preimageHex
                 transactionHex:(NSString *)transactionHex
                 lockupAddress:(NSString *)lockupAddress
                 destinationAddress:(NSString *)destinationAddress
                 feeRate:(NSInteger)feeRate
                 isTestnet:(BOOL)isTestnet
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
    NSError *error;
    LndmobileCreateReverseClaimTransaction(endpoint, swapId, claimLeaf, refundLeaf, privateKey, servicePubKey, preimageHex, transactionHex, lockupAddress, destinationAddress, feeRate, isTestnet, &error);
    if (error) {
        NSLog(@"createReverseClaimTransaction error   %@",   error);
        reject(@"createReverseClaimTransaction_error", error.localizedDescription, error);
    } else {
        resolve(@"Success");
    }
}

RCT_EXPORT_METHOD(createRefundTransaction:(NSString *)endpoint
                 swapId:(NSString *)swapId
                 claimLeaf:(NSString *)claimLeaf
                 refundLeaf:(NSString *)refundLeaf
                 transactionHex:(NSString *)transactionHex
                 privateKey:(NSString *)privateKey
                 servicePubKey:(NSString *)servicePubKey
                 feeRate:(NSInteger)feeRate
                 timeoutBlockHeight:(NSInteger)timeoutBlockHeight
                 destinationAddress:(NSString *)destinationAddress
                 lockupAddress:(NSString *)lockupAddress
                 cooperative:(BOOL)cooperative
                 isTestnet:(BOOL)isTestnet
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
    NSError *error;
    NSString *txid = LndmobileCreateRefundTransaction(endpoint, swapId, claimLeaf, refundLeaf, transactionHex, privateKey, servicePubKey, feeRate, timeoutBlockHeight, destinationAddress, lockupAddress, cooperative, isTestnet, &error);
    if (error) {
        NSLog(@"createRefundTransaction error   %@",   error);
        reject(@"createRefundTransaction_error", error.localizedDescription, error);
    } else {
        resolve(txid); 
    }
}

// Don't compile this code when we build for the old architecture.
#ifdef RCT_NEW_ARCH_ENABLED
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeLncRnSpecJSI>(params);
}
#endif

@end
