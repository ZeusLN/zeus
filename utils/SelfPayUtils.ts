import { Platform } from 'react-native';
import { Notifications } from 'react-native-notifications';
import BigNumber from 'bignumber.js';

import BackendUtils from './BackendUtils';
import { localeString } from './LocaleUtils';
import { waitForLdkNodeReady } from './LdkNodeUtils';

// How long to wait for the node to come up before giving up on a request.
// The server holds the LNURL-pay callback for ~27s; anything slower than
// this cannot be answered in time anyway.
const NODE_READY_TIMEOUT_MS = 20000;

// The same request can arrive over both the socket and a push — converge
// on one fulfillment per request_id.
const inFlightRequests: Set<string> = new Set();

export interface SelfInvoiceRequest {
    request_id: string;
    amount_msat: string | number;
    handle?: string;
    comment?: string;
    nostr?: string;
    description_hash?: string;
    ts?: string | number;
}

// Lazy store access: SelfPayUtils is required from LightningAddressStore's
// socket handler, so a top-level import of Stores would be circular.
const getStores = () => require('../stores/Stores');

const fireLocalPaymentNotification = (amountMsat: number) => {
    try {
        const value = new BigNumber(amountMsat).div(1000).toString();
        const value_commas = value.replace(
            /\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g,
            ','
        );
        const title = localeString('zeuspay.paymentReceived.title');
        const body = localeString('zeuspay.paymentReceived.body', {
            value: value_commas,
            unit: value_commas === '1' ? 'sat' : localeString('general.sats')
        });
        if (Platform.OS === 'ios') {
            // @ts-ignore:next-line
            Notifications.postLocalNotification({
                title,
                body,
                sound: 'chime.aiff'
            });
        } else {
            // @ts-ignore:next-line
            Notifications.postLocalNotification({ title, body });
        }
    } catch (e) {
        console.log('SelfPay: local notification error', e);
    }
};

// Once the invoice is served, watch the node for the payment landing and
// report settlement (with preimage proof) back to the server so it can
// serve LUD-21 verify and fire zap receipts. If the app dies before the
// event arrives, reconcileSelfPayments covers it on next connect.
const watchForSettlement = (paymentHash: string) => {
    const { lightningAddressStore } = getStores();
    const ldkBackend = BackendUtils.ldkNode;

    const unsubscribe = ldkBackend.subscribeToEvents(async (event: any) => {
        if (
            event.type !== 'paymentReceived' ||
            event.paymentHash !== paymentHash
        ) {
            return;
        }
        unsubscribe();
        try {
            const invoice = await BackendUtils.lookupInvoice({
                r_hash: paymentHash
            });
            const preimage = invoice?.r_preimage;
            if (preimage) {
                await lightningAddressStore.reportSelfSettlement(
                    paymentHash,
                    preimage
                );
            }
            fireLocalPaymentNotification(Number(event.amountMsat));
        } catch (e) {
            console.log('SelfPay: settlement report error', e);
        }
    });
};

// The single convergence point for ZEUS Pay 'self' invoice requests: the
// foreground socket, the push handlers, and (later) the headless wake paths
// all land here. Generates a BOLT11 on the local LDK node, wraps it via the
// Flow LSP when enabled (mirroring InvoicesStore.createInvoice semantics:
// the local invoice is created for amount minus the LSP fee and the wrapped
// jit_bolt11 asks the payer for the full amount), and returns it to the
// server. Not answering at all is the error path — the server times the
// request out and returns a LUD-06 error to the payer.
export async function fulfillInvoiceRequest(
    request: SelfInvoiceRequest
): Promise<void> {
    const { settingsStore, lightningAddressStore, lspStore, channelsStore } =
        getStores();

    if (settingsStore.implementation !== 'ldk-node') return;

    const requestId = request.request_id;
    if (!requestId || inFlightRequests.has(requestId)) return;
    inFlightRequests.add(requestId);

    try {
        const amountMsat = new BigNumber(request.amount_msat || 0);
        if (!amountMsat.gt(0)) return;

        await waitForLdkNodeReady(NODE_READY_TIMEOUT_MS);

        const memo = request.comment
            ? `ZEUS Pay: ${request.comment}`
            : 'ZEUS Pay';

        // Flow LSP wrap, mirroring InvoicesStore.createInvoice
        let localAmountMsat = amountMsat;
        const useLsp =
            BackendUtils.supportsFlowLSP() && settingsStore.settings?.enableLSP;

        if (useLsp) {
            if (!lspStore.info?.pubkey) {
                try {
                    await lspStore.getLSPInfo();
                } catch (e) {}
            }

            const info: any = lspStore.info;
            const method = info?.connection_methods?.[0];
            try {
                await channelsStore.connectPeer(
                    {
                        host: `${method.address}:${method.port}`,
                        node_pubkey_string: info.pubkey,
                        local_funding_amount: ''
                    },
                    false,
                    true
                );
            } catch (e) {}

            try {
                await lspStore.getZeroConfFee(amountMsat.toNumber());
            } catch (e) {}

            const feeMsat = new BigNumber(lspStore.zeroConfFee || 0).times(
                1000
            );
            if (feeMsat.gte(amountMsat)) {
                console.log(
                    'SelfPay: LSP fee exceeds requested amount, not answering',
                    {
                        requestId,
                        amountMsat: amountMsat.toString(),
                        feeMsat: feeMsat.toString()
                    }
                );
                return;
            }
            localAmountMsat = amountMsat.minus(feeMsat);
        }

        const result = await BackendUtils.createInvoice({
            value_msat: localAmountMsat.toNumber(),
            memo,
            expiry_seconds: '3600',
            description_hash: request.description_hash
        });

        if (!result?.payment_request) {
            console.log('SelfPay: invoice creation failed', { requestId });
            return;
        }

        let pr = result.payment_request;
        if (useLsp) {
            // Hard-fail on LSP rejection like InvoicesStore does: an
            // unwrapped invoice for the reduced amount would both fail the
            // server's amount check and potentially dead-end without the
            // JIT channel it needs.
            pr = (await lspStore.getZeroConfInvoice(
                result.payment_request
            )) as string;
        }

        const submitResult = await lightningAddressStore.submitSelfInvoice(
            requestId,
            pr
        );
        if (submitResult?.expired) {
            console.log('SelfPay: request already expired', { requestId });
            return;
        }

        watchForSettlement(result.r_hash);
    } catch (e) {
        console.log('SelfPay: error fulfilling invoice request', {
            requestId,
            error: e?.toString?.() || e
        });
    } finally {
        inFlightRequests.delete(requestId);
    }
}

// Entry point for socket and notification payloads: fire-and-forget with
// logging, tolerant of unknown payload shapes.
export function handleInvoiceRequest(data: any): void {
    if (!data?.request_id) return;
    fulfillInvoiceRequest(data).catch((e) =>
        console.log('SelfPay: unhandled fulfillment error', e)
    );
}

// True when a notification payload is a ZEUS Pay 'self' invoice request.
export function isSelfInvoiceRequestPayload(payload: any): boolean {
    return payload?.type === 'invoice_request' && !!payload?.request_id;
}
