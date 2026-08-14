import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Notifications } from 'react-native-notifications';
import BigNumber from 'bignumber.js';

import BackendUtils from './BackendUtils';
import { localeString } from './LocaleUtils';
import { sleep } from './SleepUtils';
import {
    startLdkNodeWallet,
    stopLdkNode,
    waitForLdkNodeReady,
    DEFAULT_SCORER_URL,
    DEFAULT_VSS_SERVER,
    SupportedNetwork
} from './LdkNodeUtils';

// How long to wait for the node to come up before giving up on a request.
// The server holds the LNURL-pay callback for ~27s; anything slower than
// this cannot be answered in time anyway.
const NODE_READY_TIMEOUT_MS = 20000;

const PERSISTENT_LDK_KEY = 'persistentLdkNodeServicesEnabled';

// Stop watching for a settlement that never comes; reconciliation covers it
const SETTLEMENT_WATCH_MAX_MS = 15 * 60 * 1000;

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
// serve LUD-21 verify and fire zap receipts. Resolves once the report has
// been attempted; background callers race this against their remaining
// budget. If the app dies before the event arrives, reconcileSelfPayments
// covers it on next connect.
const watchForSettlement = (paymentHash: string): Promise<void> => {
    const { lightningAddressStore } = getStores();
    const ldkBackend = BackendUtils.ldkNode;

    return new Promise((resolve) => {
        let done = false;
        const finish = () => {
            if (done) return;
            done = true;
            unsubscribe();
            clearTimeout(timer);
            resolve();
        };

        const timer = setTimeout(finish, SETTLEMENT_WATCH_MAX_MS);

        const unsubscribe = ldkBackend.subscribeToEvents(async (event: any) => {
            if (
                event.type !== 'paymentReceived' ||
                event.paymentHash !== paymentHash
            ) {
                return;
            }
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
            } finally {
                finish();
            }
        });
    });
};

// Make sure the LDK node is up, starting it with the receive-only boot
// profile (no gossip, no scorer, deferred chain sync) when nothing else has:
// the background wake paths run without views/Wallet/Wallet.tsx's connect
// flow. Returns whether this call started the node, so the caller can tear
// it down again.
export async function ensureLdkNodeRunning(): Promise<{
    startedHere: boolean;
}> {
    const { settingsStore, nodeInfoStore } = getStores();

    if (
        !settingsStore.settings ||
        Object.keys(settingsStore.settings).length === 0
    ) {
        await settingsStore.getSettings();
    }

    // Probe whether the node is already running (persistent service, or the
    // full app is alive and connected)
    let startedHere = false;
    try {
        await waitForLdkNodeReady(2000);
    } catch {
        const {
            ldkNodeDir,
            ldkMnemonic,
            ldkPassphrase,
            ldkNetwork,
            ldkEsploraServer,
            settings
        } = settingsStore;

        if (!ldkMnemonic || !ldkNodeDir) {
            throw new Error('SelfPay: missing LDK config');
        }

        const { getLspConfigForNetwork } = require('../stores/SettingsStore');
        const lspConfig = getLspConfigForNetwork(
            settings,
            ldkNetwork || 'mainnet'
        );
        const lsps1Config =
            lspConfig.lsps1Pubkey && lspConfig.lsps1Host
                ? {
                      nodeId: lspConfig.lsps1Pubkey,
                      address: lspConfig.lsps1Host,
                      token: settings.lsps1Token || null
                  }
                : undefined;
        const trustedPeers = [lspConfig.defaultPubkey];
        if (
            lsps1Config?.nodeId &&
            lsps1Config.nodeId !== lspConfig.defaultPubkey
        ) {
            trustedPeers.push(lsps1Config.nodeId);
        }

        console.log('SelfPay: starting LDK node (receive profile)');
        await startLdkNodeWallet({
            nodeDir: ldkNodeDir,
            seedMnemonic: ldkMnemonic,
            passphrase: ldkPassphrase,
            network: (ldkNetwork || 'mainnet') as SupportedNetwork,
            esploraServerUrl: ldkEsploraServer,
            scorerUrl: DEFAULT_SCORER_URL,
            lsps1Config,
            trustedPeers0conf: trustedPeers,
            vssServerUrl: settingsStore.ldkVssServer || DEFAULT_VSS_SERVER,
            skipRgs: true,
            skipScorer: true,
            skipSync: true
        });
        startedHere = true;
    }

    await waitForLdkNodeReady(NODE_READY_TIMEOUT_MS);

    // The ZEUS Pay auth handshake signs with the node key and sends the
    // identity pubkey, which a fresh background context hasn't fetched yet
    if (!nodeInfoStore.nodeInfo?.identity_pubkey) {
        try {
            await nodeInfoStore.getNodeInfo();
        } catch (e) {
            console.log('SelfPay: getNodeInfo failed', e);
        }
    }

    return { startedHere };
}

// Stop a node this wake path started, unless the app has since come to the
// foreground (Wallet.tsx owns the lifecycle then) or Android persistent
// mode wants it kept alive.
const teardownNodeIfOwned = async (startedHere: boolean) => {
    if (!startedHere) return;
    if (AppState.currentState === 'active') return;
    if (Platform.OS === 'android') {
        const persistent = await AsyncStorage.getItem(PERSISTENT_LDK_KEY);
        if (persistent === 'true') return;
    }
    console.log('SelfPay: stopping LDK node after background wake');
    await stopLdkNode();
};

export interface FulfillOptions {
    // Take responsibility for node start/stop (background wake paths)
    manageNodeLifecycle?: boolean;
    // After answering, wait up to this long for the payment to land so the
    // settlement report goes out before the process is frozen or killed
    settlementWaitMs?: number;
}

// The single convergence point for ZEUS Pay 'self' invoice requests: the
// foreground socket, the push handlers, and (later) the headless wake paths
// all land here. Generates a BOLT11 on the local LDK node, wraps it via the
// Flow LSP when enabled (mirroring InvoicesStore.createInvoice semantics:
// the local invoice is created for amount minus the LSP fee and the wrapped
// jit_bolt11 asks the payer for the full amount), and returns it to the
// server. Not answering at all is the error path — the server times the
// request out and returns a LUD-06 error to the payer.
export async function fulfillInvoiceRequest(
    request: SelfInvoiceRequest,
    options?: FulfillOptions
): Promise<void> {
    const { settingsStore, lightningAddressStore, lspStore, channelsStore } =
        getStores();

    if (settingsStore.implementation !== 'ldk-node') return;

    const requestId = request.request_id;
    if (!requestId || inFlightRequests.has(requestId)) return;
    inFlightRequests.add(requestId);

    let startedNodeHere = false;

    try {
        const amountMsat = new BigNumber(request.amount_msat || 0);
        if (!amountMsat.gt(0)) return;

        if (options?.manageNodeLifecycle) {
            const { startedHere } = await ensureLdkNodeRunning();
            startedNodeHere = startedHere;
        } else {
            await waitForLdkNodeReady(NODE_READY_TIMEOUT_MS);
        }

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

        const settlement = watchForSettlement(result.r_hash);
        if (options?.settlementWaitMs) {
            await Promise.race([settlement, sleep(options.settlementWaitMs)]);
        }
    } catch (e) {
        console.log('SelfPay: error fulfilling invoice request', {
            requestId,
            error: e?.toString?.() || e
        });
    } finally {
        inFlightRequests.delete(requestId);
        if (options?.manageNodeLifecycle) {
            try {
                await teardownNodeIfOwned(startedNodeHere);
            } catch (e) {
                console.log('SelfPay: node teardown error', e);
            }
        }
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
