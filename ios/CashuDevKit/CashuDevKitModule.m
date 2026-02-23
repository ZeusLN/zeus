//
//  CashuDevKitModule.m
//  zeus
//
//  Objective-C bridge for CashuDevKitModule Swift class
//

#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(CashuDevKitModule, RCTEventEmitter)

// Database Path
RCT_EXTERN_METHOD(getDatabasePath:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

// Wallet Management
RCT_EXTERN_METHOD(initializeWallet:(NSString *)mnemonic
                  unit:(NSString *)unit
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(addMint:(NSString *)mintUrl
                  targetProofCount:(nonnull NSNumber *)targetProofCount
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(removeMint:(NSString *)mintUrl
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getMintUrls:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

// Balance Operations
RCT_EXTERN_METHOD(getTotalBalance:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getBalances:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

// Mint Info
RCT_EXTERN_METHOD(fetchMintInfo:(NSString *)mintUrl
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getMintKeysets:(NSString *)mintUrl
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

// Mint Quotes (Receiving)
RCT_EXTERN_METHOD(createMintQuote:(NSString *)mintUrl
                  amount:(nonnull NSNumber *)amount
                  description:(NSString * _Nullable)description
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(checkMintQuote:(NSString *)mintUrl
                  quoteId:(NSString *)quoteId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

// External Mint Quote (direct HTTP, bypasses local database)
RCT_EXTERN_METHOD(checkExternalMintQuote:(NSString *)mintUrl
                  quoteId:(NSString *)quoteId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(addExternalMintQuote:(NSString *)mintUrl
                  quoteId:(NSString *)quoteId
                  amount:(nonnull NSNumber *)amount
                  request:(NSString *)request
                  state:(NSString *)state
                  expiry:(nonnull NSNumber *)expiry
                  secretKey:(NSString * _Nullable)secretKey
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(mintExternal:(NSString *)mintUrl
                  quoteId:(NSString *)quoteId
                  amount:(nonnull NSNumber *)amount
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(mint:(NSString *)mintUrl
                  quoteId:(NSString *)quoteId
                  conditionsJson:(NSString * _Nullable)conditionsJson
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

// Melt Quotes (Paying)
RCT_EXTERN_METHOD(createMeltQuote:(NSString *)mintUrl
                  request:(NSString *)request
                  optionsJson:(NSString * _Nullable)optionsJson
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(checkMeltQuote:(NSString *)mintUrl
                  quoteId:(NSString *)quoteId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(melt:(NSString *)mintUrl
                  quoteId:(NSString *)quoteId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

// Token Operations
RCT_EXTERN_METHOD(prepareSend:(NSString *)mintUrl
                  amount:(nonnull NSNumber *)amount
                  optionsJson:(NSString * _Nullable)optionsJson
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(confirmSend:(NSString *)preparedSendId
                  memo:(NSString * _Nullable)memo
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(cancelSend:(NSString *)preparedSendId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(receive:(NSString *)encodedToken
                  optionsJson:(NSString * _Nullable)optionsJson
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

// Token Utility
RCT_EXTERN_METHOD(decodeToken:(NSString *)encodedToken
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(isValidToken:(NSString *)encodedToken
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

// Restore
RCT_EXTERN_METHOD(restore:(NSString *)mintUrl
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(restoreFromSeed:(NSString *)mintUrl
                  seedHex:(NSString *)seedHex
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

// Proof Management
RCT_EXTERN_METHOD(checkProofsState:(NSString *)mintUrl
                  proofsJson:(NSString *)proofsJson
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

// BOLT12 Support
RCT_EXTERN_METHOD(createMintBolt12Quote:(NSString *)mintUrl
                  amount:(nonnull NSNumber *)amount
                  description:(NSString * _Nullable)description
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(createMeltBolt12Quote:(NSString *)mintUrl
                  request:(NSString *)request
                  optionsJson:(NSString * _Nullable)optionsJson
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(createMeltHumanReadableQuote:(NSString *)mintUrl
                  address:(NSString *)address
                  amountMsat:(nonnull NSNumber *)amountMsat
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

// Transactions
RCT_EXTERN_METHOD(listTransactions:(NSString * _Nullable)direction
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
