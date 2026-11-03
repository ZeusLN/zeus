// Make react-native-notifications' iOS completion handlers run at most once
//
// For each foreground notification, RNNotificationCenterMulticast enters a
// dispatch group once per delegate and hands the delegate a completion block
// that leaves the group. RNNotificationsStore keeps that block under the
// notification identifier until JS calls finishPresentingNotification.
//
// completePresentation: (and completeAction:) look the block up, queue it on
// the main queue, and only remove it from the dictionary inside the queued
// block. When two completion calls for one identifier reach the main queue
// before the first queued block runs, both find the block, the group is left
// twice, and libdispatch aborts the app ("Unbalanced call to
// dispatch_group_leave()"). Seen on iOS 27.2 TestFlight builds while receiving
// ZEUS Pay notifications; upstream reports are wix/react-native-notifications
// #913, #894 and #1061, closed without a fix.
//
// This patch:
// - makes each delegate's completion block in the multicast one-shot, so a
//   repeated call is ignored instead of leaving the group again
// - removes the stored handler in the same step that reads it, so a second
//   completion call for the identifier finds nothing
// - guards the handler dictionaries with a lock: the multicast writes them
//   from a global queue while JS completion calls read them on main
//
// Upstream: react-native-notifications 5.2.2. Like the keychain patches this
// THROWS when the expected source is missing, so a dependency bump cannot
// silently drop the fix.

import fs from 'fs';

export const MARKER = '// ZEUS PATCH: notifications-completion-once';

const IOS_DIR = './node_modules/react-native-notifications/lib/ios';
const MULTICAST_PATH = `${IOS_DIR}/RNNotificationCenterMulticast.m`;
const STORE_PATH = `${IOS_DIR}/RNNotificationsStore.m`;

const MULTICAST_EDITS = [
    {
        name: 'willPresent completion',
        from: `    __block UNNotificationPresentationOptions allOptions = UNNotificationPresentationOptionNone;
    void (^myCompletion)(UNNotificationPresentationOptions);
    myCompletion = ^(UNNotificationPresentationOptions options){
      allOptions |= options;
      dispatch_group_leave(completionGroup);
    };`,
        to: `    ${MARKER}
    // Each delegate gets its own completion that leaves the group at most
    // once. See patches/patch-notifications-completion-once.mjs.
    NSObject *completionLock = [NSObject new];
    __block UNNotificationPresentationOptions allOptions = UNNotificationPresentationOptionNone;
    void (^(^makeCompletion)(void))(UNNotificationPresentationOptions) = ^{
      __block BOOL called = NO;
      return ^(UNNotificationPresentationOptions options){
        @synchronized (completionLock) {
          if (called) {
            return;
          }
          called = YES;
          allOptions |= options;
        }
        dispatch_group_leave(completionGroup);
      };
    };`
    },
    {
        name: 'willPresent delegate call',
        from: `[delegate userNotificationCenter:center willPresentNotification:notification withCompletionHandler:myCompletion];`,
        to: `[delegate userNotificationCenter:center willPresentNotification:notification withCompletionHandler:makeCompletion()];`
    },
    {
        name: 'willPresent result',
        from: `    dispatch_async(dispatch_get_main_queue(), ^{
      completionHandler(allOptions);
    });`,
        to: `    // A delegate can still complete after the wait times out
    UNNotificationPresentationOptions presentationOptions;
    @synchronized (completionLock) {
      presentationOptions = allOptions;
    }
    dispatch_async(dispatch_get_main_queue(), ^{
      completionHandler(presentationOptions);
    });`
    },
    {
        name: 'didReceiveResponse completion',
        from: `    void (^myCompletion)(void) = ^{
      dispatch_group_leave(completionGroup);
    };`,
        to: `    ${MARKER}
    NSObject *completionLock = [NSObject new];
    void (^(^makeCompletion)(void))(void) = ^{
      __block BOOL called = NO;
      return ^{
        @synchronized (completionLock) {
          if (called) {
            return;
          }
          called = YES;
        }
        dispatch_group_leave(completionGroup);
      };
    };`
    },
    {
        name: 'didReceiveResponse delegate call',
        from: `[delegate userNotificationCenter:center didReceiveNotificationResponse:response withCompletionHandler:myCompletion];`,
        to: `[delegate userNotificationCenter:center didReceiveNotificationResponse:response withCompletionHandler:makeCompletion()];`
    }
];

const STORE_EDITS = [
    {
        name: 'handler accessors',
        from: `- (void)setActionCompletionHandler:(void (^)(void))completionHandler withCompletionKey:(NSString *)completionKey {
    _actionCompletionHandlers[completionKey] = completionHandler;
}

- (void)setPresentationCompletionHandler:(void (^)(UNNotificationPresentationOptions))completionHandler withCompletionKey:(NSString *)completionKey {
    _presentationCompletionHandlers[completionKey] = completionHandler;
}

- (void)setBackgroundActionCompletionHandler:(void (^)(UIBackgroundFetchResult))completionHandler withCompletionKey:(NSString *)completionKey {
    _backgroundActionCompletionHandlers[completionKey] = completionHandler;
}

- (void (^)(void))getActionCompletionHandler:(NSString *)key {
    return _actionCompletionHandlers[key];
}

- (void (^)(UNNotificationPresentationOptions))getPresentationCompletionHandler:(NSString *)key {
    return _presentationCompletionHandlers[key];
}

- (void)completeAction:(NSString *)completionKey {
    void (^completionHandler)() = (void (^)())[_actionCompletionHandlers valueForKey:completionKey];
    if (completionHandler) {
        dispatch_async(dispatch_get_main_queue(), ^{
            completionHandler();
            [_actionCompletionHandlers removeObjectForKey:completionKey];
        });
    }
}

- (void)completePresentation:(NSString *)completionKey withPresentationOptions:(UNNotificationPresentationOptions)presentationOptions {
    void (^completionHandler)() = (void (^)(UNNotificationPresentationOptions))[_presentationCompletionHandlers valueForKey:completionKey];
    if (completionHandler) {
        dispatch_async(dispatch_get_main_queue(), ^{
            completionHandler(presentationOptions);
            [_presentationCompletionHandlers removeObjectForKey:completionKey];
        });
    }
}

- (void)completeBackgroundAction:(NSString *)completionKey withBackgroundFetchResult:(UIBackgroundFetchResult)backgroundFetchResult {
    void (^completionHandler)() = (void (^)(UIBackgroundFetchResult))[_backgroundActionCompletionHandlers valueForKey:completionKey];
    if (completionHandler) {
        dispatch_async(dispatch_get_main_queue(), ^{
            completionHandler(backgroundFetchResult);
            [_backgroundActionCompletionHandlers removeObjectForKey:completionKey];
        });
    }
}`,
        to: `${MARKER}
// The multicast writes these dictionaries from a global queue and JS
// completion calls read them on main, so every access takes the lock. Each
// complete* method removes the handler in the same step that reads it, so a
// second call for the same key finds nothing. See
// patches/patch-notifications-completion-once.mjs.
- (void)setActionCompletionHandler:(void (^)(void))completionHandler withCompletionKey:(NSString *)completionKey {
    if (!completionKey) {
        return;
    }
    @synchronized (self) {
        _actionCompletionHandlers[completionKey] = completionHandler;
    }
}

- (void)setPresentationCompletionHandler:(void (^)(UNNotificationPresentationOptions))completionHandler withCompletionKey:(NSString *)completionKey {
    if (!completionKey) {
        return;
    }
    @synchronized (self) {
        _presentationCompletionHandlers[completionKey] = completionHandler;
    }
}

- (void)setBackgroundActionCompletionHandler:(void (^)(UIBackgroundFetchResult))completionHandler withCompletionKey:(NSString *)completionKey {
    if (!completionKey) {
        return;
    }
    @synchronized (self) {
        _backgroundActionCompletionHandlers[completionKey] = completionHandler;
    }
}

- (void (^)(void))getActionCompletionHandler:(NSString *)key {
    if (!key) {
        return nil;
    }
    @synchronized (self) {
        return _actionCompletionHandlers[key];
    }
}

- (void (^)(UNNotificationPresentationOptions))getPresentationCompletionHandler:(NSString *)key {
    if (!key) {
        return nil;
    }
    @synchronized (self) {
        return _presentationCompletionHandlers[key];
    }
}

- (id)takeHandlerFrom:(NSMutableDictionary *)handlers forKey:(NSString *)completionKey {
    if (!completionKey) {
        return nil;
    }
    @synchronized (self) {
        id completionHandler = handlers[completionKey];
        [handlers removeObjectForKey:completionKey];
        return completionHandler;
    }
}

- (void)completeAction:(NSString *)completionKey {
    void (^completionHandler)(void) = [self takeHandlerFrom:_actionCompletionHandlers forKey:completionKey];
    if (completionHandler) {
        dispatch_async(dispatch_get_main_queue(), ^{
            completionHandler();
        });
    }
}

- (void)completePresentation:(NSString *)completionKey withPresentationOptions:(UNNotificationPresentationOptions)presentationOptions {
    void (^completionHandler)(UNNotificationPresentationOptions) = [self takeHandlerFrom:_presentationCompletionHandlers forKey:completionKey];
    if (completionHandler) {
        dispatch_async(dispatch_get_main_queue(), ^{
            completionHandler(presentationOptions);
        });
    }
}

- (void)completeBackgroundAction:(NSString *)completionKey withBackgroundFetchResult:(UIBackgroundFetchResult)backgroundFetchResult {
    void (^completionHandler)(UIBackgroundFetchResult) = [self takeHandlerFrom:_backgroundActionCompletionHandlers forKey:completionKey];
    if (completionHandler) {
        dispatch_async(dispatch_get_main_queue(), ^{
            completionHandler(backgroundFetchResult);
        });
    }
}`
    }
];

const applyEdits = (path, edits) => {
    if (!fs.existsSync(path)) {
        throw new Error(
            `patch-notifications-completion-once: ${path} not found; ` +
                'the completion fix cannot be applied'
        );
    }

    const source = fs.readFileSync(path, 'utf8');
    if (source.includes(MARKER)) {
        return false;
    }

    let patched = source;
    for (const { name, from, to } of edits) {
        const count = patched.split(from).length - 1;
        if (count !== 1) {
            throw new Error(
                `patch-notifications-completion-once: expected one "${name}" ` +
                    `block in ${path}, found ${count}. Update the patch for ` +
                    'this react-native-notifications version before building.'
            );
        }
        patched = patched.replace(from, () => to);
    }

    fs.writeFileSync(path, patched);
    return true;
};

export function patchNotificationsCompletionOnce() {
    console.log('Patching react-native-notifications completion handlers');

    if (applyEdits(MULTICAST_PATH, MULTICAST_EDITS)) {
        console.log('  - Patched RNNotificationCenterMulticast.m');
    }
    if (applyEdits(STORE_PATH, STORE_EDITS)) {
        console.log('  - Patched RNNotificationsStore.m');
    }
}
