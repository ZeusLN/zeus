// The native LndMobile and LNC modules emit every update of a streaming RPC
// under the method name, so concurrent calls of the same method share one
// event. A call started with a request id gets that id back as `request_id`
// on each of its events (updates, errors and EOF), which lets a listener
// ignore the other calls' events.

let counter = 0;

// Ids only need to be unique within this JS runtime: native echoes them back
// and never persists them.
export const newStreamRequestId = (): string =>
    `${Date.now().toString(36)}-${(++counter).toString(36)}`;

export const isEventForRequest = (event: any, requestId: string): boolean =>
    !!event && typeof event === 'object' && event.request_id === requestId;
