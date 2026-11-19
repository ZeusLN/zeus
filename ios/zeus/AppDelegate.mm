#import "AppDelegate.h"

#import "RNNotifications.h"

static NSString *const kHasRunBeforeKey = @"HAS_RUN_BEFORE";

/**
 Path of the file NSUserDefaults persists standardUserDefaults to. Read
 directly so a value cached in this process cannot stand in for it.
 */
static NSString *StandardDefaultsPath(void) {
    NSString *library = NSSearchPathForDirectoriesInDomains(NSLibraryDirectory, NSUserDomainMask, YES).firstObject;
    return [NSString stringWithFormat:@"%@/Preferences/%@.plist", library, [[NSBundle mainBundle] bundleIdentifier]];
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

 Returns NO when it could not run yet, so the caller can retry once protected data is available.
 */
static BOOL ClearKeychainIfNecessary(BOOL protectedDataAvailable, NSString *defaultsPath) {
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

    NSArray *secItemClasses = @[
        (__bridge id)kSecClassGenericPassword,
        (__bridge id)kSecClassInternetPassword,
        (__bridge id)kSecClassCertificate,
        (__bridge id)kSecClassKey,
        (__bridge id)kSecClassIdentity
    ];

    // Maps through all Keychain classes and deletes all items that match
    for (id secItemClass in secItemClasses) {
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
static BOOL RunPendingKeychainCheck(BOOL *pending, BOOL protectedDataAvailable, NSString *defaultsPath) {
    if (!*pending || !protectedDataAvailable) {
        return NO;
    }
    *pending = NO;
    ClearKeychainIfNecessary(YES, defaultsPath);
    return YES;
}

@interface AppDelegate () {
  // Set when launch happened without protected data, so the first-run
  // keychain check still has to run
  BOOL _keychainCheckPending;
}
@end

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  // React Native is started by SceneDelegate once the window scene connects.
  [RNNotifications startMonitorNotifications];
  _keychainCheckPending = !ClearKeychainIfNecessary(application.isProtectedDataAvailable, StandardDefaultsPath());
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
                              StandardDefaultsPath())) {
    [[NSNotificationCenter defaultCenter] removeObserver:self
                                                    name:UIApplicationDidBecomeActiveNotification
                                                  object:nil];
  }
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
