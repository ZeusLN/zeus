#import "AppDelegate.h"

#import "RNNotifications.h"

/**
 Deletes all Keychain items accessible by this app if this is the first time the user launches the app
 */
static void ClearKeychainIfNecessary() {
    // Checks whether or not this is the first time the app is run
    if ([[NSUserDefaults standardUserDefaults] boolForKey:@"HAS_RUN_BEFORE"] == NO) {
        // Set the appropriate value so we don't clear next time the app is launched
        [[NSUserDefaults standardUserDefaults] setBool:YES forKey:@"HAS_RUN_BEFORE"];

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
    }
}

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  // React Native is started by SceneDelegate once the window scene connects.
  [RNNotifications startMonitorNotifications];
  ClearKeychainIfNecessary();

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
