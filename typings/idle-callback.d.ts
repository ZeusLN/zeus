// React Native installs `requestIdleCallback`/`cancelIdleCallback` as globals
// (Libraries/Core/setUpTimers.js) but ships no TypeScript declarations for
// them, and Zeus does not pull in the DOM lib. These mirror the Flow types in
// react-native/src/private/webapis/idlecallbacks/specs/NativeIdleCallbacks.js.
//
// The handle is opaque on purpose: the bridgeless implementation returns a
// jsi::Object, the legacy JSTimers implementation returns a number. Only ever
// hand it back to cancelIdleCallback.

declare interface IdleDeadline {
    didTimeout: boolean;
    timeRemaining: () => number;
}

declare interface IdleRequestOptions {
    timeout?: number;
}

declare type IdleCallbackHandle = unknown;

declare function requestIdleCallback(
    callback: (deadline: IdleDeadline) => void,
    options?: IdleRequestOptions
): IdleCallbackHandle;

declare function cancelIdleCallback(handle: IdleCallbackHandle): void;
