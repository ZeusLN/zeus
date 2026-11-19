// Excerpts of react-native-keychain 10.0.0 ios/RNKeychainManager/RNKeychainManager.m
// (MIT, Joel Arvidsson), used by patches/patch-keychain-atomic-update.test.ts.


CFBooleanRef cloudSyncValue(NSDictionary *options)
{
  if (options && options[@"cloudSync"]) {
    return kCFBooleanTrue;
  }
  return kCFBooleanFalse;
}

- (void)hasCredentialsWithSecClass:(CFTypeRef)secClass
{
}

RCT_EXPORT_METHOD(setGenericPasswordForOptions:(NSDictionary *)options
                  withUsername:(NSString *)username
                  withPassword:(NSString *)password
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  NSString *service = serviceValue(options);
  CFBooleanRef cloudSync = cloudSyncValue(options);
  NSDictionary *attributes = attributes = @{
    (__bridge NSString *)kSecClass: (__bridge id)(kSecClassGenericPassword),
    (__bridge NSString *)kSecAttrService: service,
    (__bridge NSString *)kSecAttrAccount: username,
    (__bridge NSString *)kSecAttrSynchronizable: (__bridge id)(cloudSync),
    (__bridge NSString *)kSecValueData: [password dataUsingEncoding:NSUTF8StringEncoding]
  };

  [self deletePasswordsForOptions:options];

  [self insertKeychainEntry:attributes withOptions:options resolver:resolve rejecter:reject];
}

RCT_EXPORT_METHOD(setInternetCredentialsForServer:(NSString *)server
                  withUsername:(NSString*)username
                  withPassword:(NSString*)password
                  withOptions:(NSDictionary *)options
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [self deleteCredentialsForServer:server withOptions: options];
  CFBooleanRef cloudSync = cloudSyncValue(options);

  NSDictionary *attributes = @{
    (__bridge NSString *)kSecClass: (__bridge id)(kSecClassInternetPassword),
    (__bridge NSString *)kSecAttrServer: server,
    (__bridge NSString *)kSecAttrAccount: username,
    (__bridge NSString *)kSecValueData: [password dataUsingEncoding:NSUTF8StringEncoding],
    (__bridge NSString *)kSecAttrSynchronizable: (__bridge id)(cloudSync),
  };

  [self insertKeychainEntry:attributes withOptions:options resolver:resolve rejecter:reject];
}
