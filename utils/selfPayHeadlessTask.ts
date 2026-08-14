import {
    fulfillInvoiceRequest,
    isSelfInvoiceRequestPayload
} from './SelfPayUtils';

// After answering, keep the process alive so the settlement watcher can
// observe the payment landing and report it with preimage proof. The native
// task timeout (SelfPayHeadlessService) bounds the total run.
const SETTLEMENT_WAIT_MS = 30000;

// Android killed-state entry point for ZEUS Pay 'self' invoice requests:
// ZeusFcmService -> SelfPayHeadlessService -> this task. Runs in the app's
// JS runtime (reused when the app is alive, freshly booted otherwise) so
// the encrypted settings blob and node lifecycle code are the same ones the
// full app uses. fulfillInvoiceRequest starts the node with the
// receive-only boot profile when nothing else has, and stops it again
// unless the app took over or persistent mode is on.
export default async function selfPayHeadlessTask(data: any): Promise<void> {
    try {
        if (!isSelfInvoiceRequestPayload(data)) return;

        await fulfillInvoiceRequest(data, {
            manageNodeLifecycle: true,
            settlementWaitMs: SETTLEMENT_WAIT_MS
        });
    } catch (e) {
        console.log('SelfPay headless: task error', e);
    }
}
