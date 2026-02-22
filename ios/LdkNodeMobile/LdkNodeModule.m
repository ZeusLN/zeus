#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(LdkNodeModule, RCTEventEmitter)

// Builder Methods
RCT_EXTERN_METHOD(createBuilder:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(setNetwork:(NSString *)network resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(setStorageDirPath:(NSString *)path resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(setEsploraServer:(NSString *)serverUrl resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(setGossipSourceRgs:(NSString *)rgsServerUrl resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(setGossipSourceP2p:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(setListeningAddresses:(NSArray *)addresses resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(setLiquiditySourceLsps1:(NSString *)nodeId address:(NSString *)address token:(NSString *)token resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(setLiquiditySourceLsps2:(NSString *)nodeId address:(NSString *)address token:(NSString *)token resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(setTrustedPeers0conf:(NSArray *)peers resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)

// Mnemonic Methods
RCT_EXTERN_METHOD(generateMnemonic:(nonnull NSNumber *)wordCount resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)

// Node Build Methods
RCT_EXTERN_METHOD(buildNode:(NSString *)mnemonic passphrase:(NSString *)passphrase resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)

// Node Lifecycle Methods
RCT_EXTERN_METHOD(start:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(stop:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(syncWallets:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)

// Node Info Methods
RCT_EXTERN_METHOD(nodeId:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(status:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(listBalances:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(networkGraphInfo:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)

// Channel Methods
RCT_EXTERN_METHOD(listChannels:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(openChannel:(NSString *)nodeId address:(NSString *)address channelAmountSats:(nonnull NSNumber *)channelAmountSats pushToCounterpartyMsat:(nonnull NSNumber *)pushToCounterpartyMsat announceChannel:(BOOL)announceChannel resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(closeChannel:(NSString *)userChannelId counterpartyNodeId:(NSString *)counterpartyNodeId resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)

// On-chain Methods
RCT_EXTERN_METHOD(newOnchainAddress:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(sendToOnchainAddress:(NSString *)address amountSats:(nonnull NSNumber *)amountSats resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(sendAllToOnchainAddress:(NSString *)address retainReserve:(BOOL)retainReserve resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)

// BOLT11 Payment Methods
RCT_EXTERN_METHOD(receiveBolt11:(double)amountMsat invoiceDescription:(NSString *)invoiceDescription expirySecs:(double)expirySecs resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(receiveVariableAmountBolt11:(NSString *)invoiceDescription expirySecs:(double)expirySecs resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(sendBolt11:(NSString *)invoice resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(sendBolt11UsingAmount:(NSString *)invoice amountMsat:(double)amountMsat resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)

// Payment Methods
RCT_EXTERN_METHOD(listPayments:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)

// Peer Methods
RCT_EXTERN_METHOD(connect:(NSString *)nodeId address:(NSString *)address persist:(BOOL)persist resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(disconnect:(NSString *)nodeId resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(listPeers:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)

// Event Methods
RCT_EXTERN_METHOD(nextEvent:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(waitNextEvent:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(eventHandled:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)

// LSPS1 Methods
RCT_EXTERN_METHOD(lsps1RequestChannel:(double)lspBalanceSat clientBalanceSat:(double)clientBalanceSat channelExpiryBlocks:(double)channelExpiryBlocks announceChannel:(BOOL)announceChannel resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(lsps1CheckOrderStatus:(NSString *)orderId resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)

// Message Signing Methods
RCT_EXTERN_METHOD(signMessage:(NSString *)message resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(verifySignature:(NSString *)message signature:(NSString *)signature publicKey:(NSString *)publicKey resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)

@end
