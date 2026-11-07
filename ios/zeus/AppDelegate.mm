#import "AppDelegate.h"

#import "RNNotifications.h"

static NSString *const kHasRunBeforeKey = @"HAS_RUN_BEFORE";

/**
 Set when a fresh install finds device-local keychain items left by an earlier install on this
 device. JS reads it through KeychainAudit.m and then does not copy the iCloud Keychain
 partition back into the device-local one, so a reinstall starts empty as the first-run clear
 intends. Never cleared: the install stays a reinstall.
 */
static NSString *const kKeychainSurvivedReinstallKey = @"KEYCHAIN_SURVIVED_REINSTALL";

/**
 Path of the file NSUserDefaults persists standardUserDefaults to. Read
 directly so a value cached in this process cannot stand in for it.
 */
static NSString *StandardDefaultsPath(void) {
    NSString *library = NSSearchPathForDirectoriesInDomains(NSLibraryDirectory, NSUserDomainMask, YES).firstObject;
    return [NSString stringWithFormat:@"%@/Preferences/%@.plist", library, [[NSBundle mainBundle] bundleIdentifier]];
}

/**
 Notification AppDelegate posts once a deferred first-run check has run. KeychainAudit.m waits
 for it before answering keychainSurvivedReinstall, so the name is repeated there.
 */
static NSString *const kFirstRunKeychainCheckDidRunNotification = @"ZeusFirstRunKeychainCheckDidRun";

typedef NS_ENUM(NSInteger, LocalKeychainItems) {
    // The keychain could not be read, as before the first unlock after a reboot
    LocalKeychainItemsUnknown,
    LocalKeychainItemsNone,
    LocalKeychainItemsFound
};

static NSArray *SecItemClasses(void) {
    return @[
        (__bridge id)kSecClassGenericPassword,
        (__bridge id)kSecClassInternetPassword,
        (__bridge id)kSecClassCertificate,
        (__bridge id)kSecClassKey,
        (__bridge id)kSecClassIdentity
    ];
}

/**
 Whether device-local keychain items exist. A query without kSecAttrSynchronizable matches
 device-local items only, so items that reached this device through iCloud Keychain do not count.
 On a fresh install only this device's earlier install can have left device-local items behind.
 */
static LocalKeychainItems ReadLocalKeychainItems(void) {
    BOOL unknown = NO;
    for (id secItemClass in SecItemClasses()) {
        NSDictionary *query = @{
            (__bridge id)kSecClass: secItemClass,
            (__bridge id)kSecMatchLimit: (__bridge id)kSecMatchLimitOne
        };
        OSStatus status = SecItemCopyMatching((__bridge CFDictionaryRef)query, NULL);
        if (status == errSecSuccess) {
            return LocalKeychainItemsFound;
        }
        if (status != errSecItemNotFound) {
            unknown = YES;
        }
    }
    return unknown ? LocalKeychainItemsUnknown : LocalKeychainItemsNone;
}

/**
 Deletes all Keychain items accessible by this app if this is the first time the user launches the app.

 iOS keeps keychain items across uninstalls but not NSUserDefaults, so a missing HAS_RUN_BEFORE
 flag means a fresh install. The flag can also read NO on an existing install: before the first
 unlock after a reboot the defaults file cannot be read, so a background launch then sees empty
 defaults, and clearing there would delete every wallet configuration. So this does nothing until
 protected data is available, and only clears when the defaults file on disk lacks the flag as
 well. isProtectedDataAvailable is also NO while the device is locked after the first unlock,
 when the file is readable, so the check waits then too, which is stricter than needed.

 itemsAtLaunch is what ReadLocalKeychainItems returned at launch, before JS started. A check
 deferred until protected data is available uses it to decide whether this is a reinstall, because
 by then JS may have written device-local items of its own. Zeus items use
 kSecAttrAccessibleAfterFirstUnlock, so whenever JS could write one, the launch read could see
 those an earlier install left. Only when launch could not read the keychain is it read again here.

 Returns NO when it could not run yet, so the caller can retry once protected data is available.
 */
static BOOL ClearKeychainIfNecessary(BOOL protectedDataAvailable, NSString *defaultsPath, LocalKeychainItems itemsAtLaunch) {
    if (!protectedDataAvailable) {
        return NO;
    }

    NSUserDefaults *defaults = [NSUserDefaults standardUserDefaults];
    if ([defaults boolForKey:kHasRunBeforeKey]) {
        return YES;
    }

    NSDictionary *persisted = [NSDictionary dictionaryWithContentsOfFile:defaultsPath];
    if ([persisted[kHasRunBeforeKey] boolValue]) {
        // The file has the flag, so leave defaults alone: writing into a
        // domain that may have been read empty could replace other keys
        return YES;
    }

    // Set the appropriate value so we don't clear next time the app is launched
    [defaults setBool:YES forKey:kHasRunBeforeKey];

    LocalKeychainItems items =
        itemsAtLaunch != LocalKeychainItemsUnknown ? itemsAtLaunch : ReadLocalKeychainItems();
    if (items == LocalKeychainItemsFound) {
        [defaults setBool:YES forKey:kKeychainSurvivedReinstallKey];
    }

    // Maps through all Keychain classes and deletes all items that match
    for (id secItemClass in SecItemClasses()) {
        NSDictionary *spec = @{(__bridge id)kSecClass: secItemClass};
        SecItemDelete((__bridge CFDictionaryRef)spec);
    }

    return YES;
}

/**
 Runs the first-run check that launch deferred because protected data was unavailable. Runs it
 at most once, and only with protected data available. Returns YES when it ran, so the caller
 can stop listening for retries.
 */
static BOOL RunPendingKeychainCheck(BOOL *pending, BOOL protectedDataAvailable, NSString *defaultsPath, LocalKeychainItems itemsAtLaunch) {
    if (!*pending || !protectedDataAvailable) {
        return NO;
    }
    *pending = NO;
    ClearKeychainIfNecessary(YES, defaultsPath, itemsAtLaunch);
    return YES;
}

@interface AppDelegate () {
  // Set when launch happened without protected data, so the first-run
  // keychain check still has to run
  BOOL _keychainCheckPending;
  // What ReadLocalKeychainItems returned at launch, for the deferred check
  LocalKeychainItems _localKeychainItemsAtLaunch;
}
@end

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  // React Native is started by SceneDelegate once the window scene connects.
  [RNNotifications startMonitorNotifications];
  _localKeychainItemsAtLaunch = ReadLocalKeychainItems();
  _keychainCheckPending = !ClearKeychainIfNecessary(application.isProtectedDataAvailable, StandardDefaultsPath(), _localKeychainItemsAtLaunch);
  if (_keychainCheckPending) {
    // The protected-data callback alone is not enough: it is not documented
    // to reach an app that was suspended when the device unlocked. Becoming
    // active always happens before the user can create anything, so check
    // there too. A notification keeps this working under a scene delegate.
    [[NSNotificationCenter defaultCenter] addObserver:self
                                             selector:@selector(runPendingKeychainCheck)
                                                 name:UIApplicationDidBecomeActiveNotification
                                               object:nil];
  }

  if (@available(iOS 16.1, *)) {
    Class managerClass = NSClassFromString(@"NWCActivityManager");
    if (managerClass && [managerClass respondsToSelector:@selector(shared)]) {
      #pragma clang diagnostic push
      #pragma clang diagnostic ignored "-Warc-performSelector-leaks"
      [managerClass performSelector:@selector(shared)];
      #pragma clang diagnostic pop
    }
  }

  return YES;
}

- (void)application:(UIApplication *)application didRegisterForRemoteNotificationsWithDeviceToken:(NSData *)deviceToken {
  [RNNotifications didRegisterForRemoteNotificationsWithDeviceToken:deviceToken];
}

- (void)application:(UIApplication *)application didFailToRegisterForRemoteNotificationsWithError:(NSError *)error {
  [RNNotifications didFailToRegisterForRemoteNotificationsWithError:error];
}

// Runs the first-run keychain check deferred at launch, once protected data
// is available. Safe to call repeatedly; only the first successful run acts.
- (void)runPendingKeychainCheck {
  if (RunPendingKeychainCheck(&_keychainCheckPending,
                              [UIApplication sharedApplication].isProtectedDataAvailable,
                              StandardDefaultsPath(),
                              _localKeychainItemsAtLaunch)) {
    [[NSNotificationCenter defaultCenter] removeObserver:self
                                                    name:UIApplicationDidBecomeActiveNotification
                                                  object:nil];
    [[NSNotificationCenter defaultCenter] postNotificationName:kFirstRunKeychainCheckDidRunNotification
                                                        object:nil];
  }
}

// Read by KeychainAudit.m, which holds keychainSurvivedReinstall until this is NO
- (BOOL)firstRunKeychainCheckPending {
  return _keychainCheckPending;
}

- (void)applicationProtectedDataDidBecomeAvailable:(UIApplication *)application {
  [self runPendingKeychainCheck];
}

- (void)applicationWillTerminate:(UIApplication *)application {
  NSLog(@"App will terminate – ending Live Activities (blocking)");
  if (@available(iOS 16.1, *)) {
    Class managerClass = NSClassFromString(@"NWCActivityManager");
    if (managerClass && [managerClass respondsToSelector:@selector(shared)]) {
      #pragma clang diagnostic push
      #pragma clang diagnostic ignored "-Warc-performSelector-leaks"
      id manager = [managerClass performSelector:@selector(shared)];
      if ([manager respondsToSelector:@selector(endAllActivitiesImmediately)]) {
        [manager performSelector:@selector(endAllActivitiesImmediately)];
      }
      #pragma clang diagnostic pop
    }
  }
}

@end
