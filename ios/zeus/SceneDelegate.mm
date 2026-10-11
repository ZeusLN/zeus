#import "SceneDelegate.h"

#import <RCTReactNativeFactory.h>
#import <React/RCTBundleURLProvider.h>
#import <React/RCTLinkingManager.h>

#import "AppDelegate.h"

#if __has_include(<ReactAppDependencyProvider/RCTAppDependencyProvider.h>)
#define USE_OSS_CODEGEN 1
#import <ReactAppDependencyProvider/RCTAppDependencyProvider.h>
#else
#define USE_OSS_CODEGEN 0
#endif

@implementation SceneDelegate {
  RCTReactNativeFactory *_reactNativeFactory;
}

- (void)scene:(UIScene *)scene
    willConnectToSession:(UISceneSession *)session
                 options:(UISceneConnectionOptions *)connectionOptions
{
  if (![scene isKindOfClass:[UIWindowScene class]]) {
    return;
  }

#if USE_OSS_CODEGEN
  self.dependencyProvider = [RCTAppDependencyProvider new];
#endif

  _reactNativeFactory = [[RCTReactNativeFactory alloc] initWithDelegate:self];
  self.window = [[UIWindow alloc] initWithWindowScene:(UIWindowScene *)scene];

  // react-native-blob-util, react-native-print and Reanimated's keyboard
  // observer still look up the window through the app delegate.
  AppDelegate *appDelegate = (AppDelegate *)[UIApplication sharedApplication].delegate;
  appDelegate.window = self.window;

  // Cold-start URLs (zeusln://share from the ShareQR extension, lightning:,
  // bitcoin:, etc.) arrive in connectionOptions; the factory passes them to
  // Linking.getInitialURL.
  [_reactNativeFactory startReactNativeWithModuleName:@"zeus"
                                             inWindow:self.window
                                    initialProperties:@{}
                                    connectionOptions:connectionOptions];
}

- (void)scene:(UIScene *)scene openURLContexts:(NSSet<UIOpenURLContext *> *)URLContexts
{
  [RCTLinkingManager scene:scene openURLContexts:URLContexts];
}

- (void)scene:(UIScene *)scene continueUserActivity:(NSUserActivity *)userActivity
{
  [RCTLinkingManager scene:scene continueUserActivity:userActivity];
}

- (void)sceneDidEnterBackground:(UIScene *)scene
{
  NSLog(@"App entered background");
}

- (void)sceneWillEnterForeground:(UIScene *)scene
{
  NSLog(@"App will enter foreground");
}

- (NSURL *)bundleURL
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

@end
