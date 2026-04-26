import {
    Alert,
    DeviceEventEmitter,
    NativeEventEmitter,
    NativeModules,
    Platform
} from 'react-native';
import DeviceInfo from 'react-native-device-info';

import { generateSecureRandom } from 'react-native-securerandom';

import Log from '../lndmobile/log';
const log = Log('utils/LndMobileUtils.ts');

import Base64Utils from './Base64Utils';
import { localeString } from './LocaleUtils';
import { retry, sleep } from './SleepUtils';
import { importChannelDb } from './ChannelMigrationUtils';

import lndMobile from '../lndmobile/LndMobileInjection';
import {
    ELndMobileStatusCodes,
    gossipSync,
    cancelGossipSync,
    checkLndFolderExists
} from '../lndmobile/index';

import { settingsStore, syncStore } from '../stores/Stores';
import {
    DEFAULT_NEUTRINO_PEERS_MAINNET,
    SECONDARY_NEUTRINO_PEERS_MAINNET,
    DEFAULT_NEUTRINO_PEERS_TESTNET,
    DEFAULT_FEE_ESTIMATOR,
    DEFAULT_SPEEDLOADER
} from '../stores/SettingsStore';

import { lnrpc } from '../proto/lightning';

import {
    LndErrorCode,
    createLndError,
    getErrorMessage,
    isLndError,
    isStopLndExpectedError,
    matchesLndErrorCode
} from './LndMobileErrors';

export {
    LndErrorCode,
    LND_ERROR_MESSAGES,
    LND_ERROR_PATTERNS,
    MAX_TRANSIENT_RPC_RETRIES,
    TRANSIENT_RPC_RETRY_BASE_MS,
    createLndError,
    getErrorMessage,
    isLndError,
    isStopLndExpectedError,
    isTransientRpcError,
    matchRawErrorToCode,
    matchesLndErrorCode,
    retryOnTransientError
} from './LndMobileErrors';

// ---------------------------------------------------------------------------
// Timing constants
// ---------------------------------------------------------------------------
const STATE_SUBSCRIPTION_SETTLE_MS = 500; // Delay to allow state subscription to settle after LND start
const LND_RETRY_DELAY_MS = 3000; // Base delay between LND start retry attempts
const GEN_SEED_STOP_DELAY_MS = 3000; // Delay after stopping LND before wallet creation restart attempts
const GEN_SEED_MAX_RETRIES = 10; // Max retries when LND unlocks too quickly during wallet creation
const GEN_SEED_RETRY_DELAY_MS = 500; // Delay between genSeed retry attempts (ms)
const MAX_LND_START_RETRIES = 10; // Maximum retries for LND start
const LND_READY_TIMEOUT_MS = 60000; // Max wait for LND to reach ready state (wallet/RPC)
/** Max wait for SubscribeState EOF after stop/kill; avoids hanging if native never signals EOF. */
const LND_SHUTDOWN_EOF_TIMEOUT_MS = 60000;

export const NEUTRINO_PING_TIMEOUT_MS = 1500;
export const NEUTRINO_PING_OPTIMAL_MS = 200;
export const NEUTRINO_PING_LAX_MS = 500;
export const NEUTRINO_PING_THRESHOLD_MS = 1000;
const NEUTRINO_PING_CONCURRENCY = 3;

// Fetch-based latency check that runs entirely on the JS thread,
// avoiding the native thread race condition in react-native-ping.
export interface PingResult {
    ms: number;
    reachable: boolean;
}

export async function pingPeer(
    host: string,
    timeout: number = NEUTRINO_PING_TIMEOUT_MS
): Promise<PingResult> {
    if (host.includes('://')) {
        throw new Error(
            localeString(
                'views.Settings.EmbeddedNode.NeutrinoPeers.invalidHost'
            )
        );
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const start = global.performance.now();
    let reachable = false;
    try {
        await fetch(`http://${host}:8333`, {
            method: 'HEAD',
            signal: controller.signal
        });
        // Any HTTP response (even non-200) means the host is reachable.
        reachable = true;
    } catch (e: any) {
        if (controller.signal.aborted) {
            throw new Error(
                localeString(
                    'views.Settings.EmbeddedNode.NeutrinoPeers.timedOut'
                )
            );
        }
        // Bitcoin peers don't speak HTTP so fetch always throws — even
        // for reachable peers (TCP connects, then the non-HTTP response
        // causes a parse error).  We try to distinguish real peers from
        // nonexistent hosts via two independent signals:
        //
        // 1. Platform-specific DNS error messages.
        const msg = (e?.message || '').toLowerCase();
        const hasDnsHint =
            msg.includes('unable to resolve host') || // Android (OkHttp)
            msg.includes('no address associated') || // Android variant
            msg.includes('could not find the server') || // iOS
            msg.includes('cannot find host') || // iOS variant
            msg.includes('nodename nor servname') || // iOS/macOS getaddrinfo
            msg.includes('hostname could not be found') || // Windows
            msg.includes('not known'); // Linux getaddrinfo
        if (hasDnsHint) {
            reachable = false;
        } else {
            // 2. Timing heuristic for platforms where the error message
            //    is generic (e.g. Android "Network request failed").
            //    A real host needs at least one network round-trip for
            //    DNS + TCP before the error, while a DNS NXDOMAIN from
            //    the local resolver returns almost instantly.
            const elapsed = global.performance.now() - start;
            reachable = elapsed >= 100;
        }
    } finally {
        clearTimeout(timer);
    }
    return { ms: Math.round(global.performance.now() - start), reachable };
}

type NeutrinoPingRow = { peer: string; ms: number | string };

async function pingNeutrinoHosts(hosts: string[]): Promise<NeutrinoPingRow[]> {
    const rows: NeutrinoPingRow[] = [];
    for (let i = 0; i < hosts.length; i += NEUTRINO_PING_CONCURRENCY) {
        const batch = hosts.slice(i, i + NEUTRINO_PING_CONCURRENCY);
        const batchRows = await Promise.all(
            batch.map(async (peer) => {
                try {
                    const result = await pingPeer(peer);
                    const ms = result.reachable ? result.ms : 'Unreachable';
                    log.d(
                        `Neutrino ping ${peer} ${
                            typeof ms === 'number' ? `${ms}ms` : ms
                        }`
                    );
                    return { peer, ms };
                } catch {
                    return { peer, ms: 'Timed out' };
                }
            })
        );
        rows.push(...batchRows);
    }
    return rows;
}

function pickPeersUnderMs(
    rows: NeutrinoPingRow[],
    selected: string[],
    chosen: Set<string>,
    maxMs: number,
    cap: number
) {
    for (const { peer, ms } of rows) {
        if (selected.length >= cap) return;
        if (typeof ms !== 'number' || ms >= maxMs) continue;
        if (chosen.has(peer)) continue;
        selected.push(peer);
        chosen.add(peer);
    }
}

// ~4GB
const NEUTRINO_PERSISTENT_FILTER_THRESHOLD = 400000000;

export const LndMobileEventEmitter =
    Platform.OS == 'android'
        ? DeviceEventEmitter
        : // @ts-ignore:next-line
          new NativeEventEmitter(NativeModules.LndMobile);

export const LndMobileToolsEventEmitter =
    Platform.OS == 'android'
        ? DeviceEventEmitter
        : // @ts-ignore:next-line
          new NativeEventEmitter(NativeModules.LndMobileTools);

export function checkLndStreamErrorResponse(
    name: string,
    event: any
): Error | 'EOF' | null {
    if (!event || typeof event !== 'object') {
        return new Error(
            name + ': Got invalid response from lnd: ' + JSON.stringify(event)
        );
    }
    console.log('name', name);
    console.log('checkLndStreamErrorResponse error_desc:', event.error_desc);
    if (event.error_code) {
        const errorDesc = event.error_desc || '';

        if (matchesLndErrorCode(errorDesc, LndErrorCode.STREAM_EOF)) {
            log.i('Got EOF for stream: ' + name);
            return 'EOF';
        }

        // Ignore transient startup errors (RPC not ready yet)
        if (matchesLndErrorCode(errorDesc, LndErrorCode.RPC_NOT_READY)) {
            log.d(`Transient startup error for ${name}: ${errorDesc}`);
            return null;
        }

        // Handle closed connection - expected when switching nodes or stopping LND
        if (
            matchesLndErrorCode(errorDesc, LndErrorCode.RPC_CONNECTION_CLOSED)
        ) {
            log.d('Connection closed (expected during node switch/stop)');
            return createLndError(LndErrorCode.RPC_CONNECTION_CLOSED);
        }

        return new Error(errorDesc);
    }
    return null;
}

const writeLndConfig = async ({
    lndDir = 'lnd',
    isTestnet,
    rescan,
    compactDb,
    isSqlite
}: {
    lndDir: string;
    isTestnet?: boolean;
    rescan?: boolean;
    compactDb?: boolean;
    isSqlite?: boolean;
}) => {
    const { writeConfig } = lndMobile.index;

    const peerMode = settingsStore?.settings?.dontAllowOtherPeers
        ? 'connect'
        : 'addpeer';

    const totalMemory = await DeviceInfo.getTotalMemory();
    console.log('totalMemory', totalMemory);

    const persistFilters = totalMemory >= NEUTRINO_PERSISTENT_FILTER_THRESHOLD;

    console.log('persistFilters', persistFilters);

    const dbConfig = `[db]
    db.backend=${isSqlite ? 'sqlite' : 'bolt'}
    db.use-native-sql=${isSqlite ? 'true' : 'false'}
    db.no-graph-cache=false${
        !isSqlite
            ? `

    [bolt]
    db.bolt.auto-compact=${compactDb ? 'true' : 'false'}
    ${compactDb ? 'db.bolt.auto-compact-min-age=0' : ''}`
            : `

    [sqlite]
    db.sqlite.pragmaoptions=temp_store=memory`
    }`;

    const config = `[Application Options]
    debuglevel=info
    maxbackoff=2s
    sync-freelist=1
    accept-keysend=1
    tlsdisableautofill=1
    maxpendingchannels=1000
    max-commit-fee-rate-anchors=21
    accept-positive-inbound-fees=true
    payments-expiration-grace-period=168h
    ${rescan ? 'reset-wallet-transactions=true' : ''}

    ${dbConfig}
    
    [Routing]
    routing.assumechanvalid=1
    routing.strictgraphpruning=false

    [Bitcoin]
    bitcoin.active=1
    bitcoin.mainnet=${isTestnet ? 0 : 1}
    bitcoin.testnet=${isTestnet ? 1 : 0}
    bitcoin.node=neutrino
    bitcoin.defaultchanconfs=1

    [Neutrino]
    ${
        !isTestnet
            ? settingsStore?.settings?.neutrinoPeersMainnet
                  .map((peer) => `neutrino.${peerMode}=${peer}\n    `)
                  .join('')
            : settingsStore?.settings?.neutrinoPeersTestnet
                  .map((peer) => `neutrino.${peerMode}=${peer}\n    `)
                  .join('')
    }
    ${
        !isTestnet
            ? 'neutrino.assertfilterheader=230000:1308d5cfc6462f877a5587fd77d7c1ab029d45e58d5175aaf8c264cee9bde760'
            : ''
    }
    ${
        !isTestnet
            ? 'neutrino.assertfilterheader=660000:08312375fabc082b17fa8ee88443feb350c19a34bb7483f94f7478fa4ad33032'
            : ''
    }
    neutrino.broadcasttimeout=11s
    neutrino.persistfilters=${persistFilters}

    [fee]
    fee.url=${
        settingsStore?.settings?.feeEstimator === 'Custom'
            ? settingsStore?.settings?.customFeeEstimator
            : settingsStore?.settings?.feeEstimator || DEFAULT_FEE_ESTIMATOR
    }

    [autopilot]
    autopilot.active=0
    autopilot.private=1
    autopilot.minconfs=1
    autopilot.conftarget=3
    autopilot.allocation=1.0
    autopilot.heuristic=externalscore:1.00
    autopilot.heuristic=preferential:0.00

    [protocol]
    protocol.wumbo-channels=true
    protocol.option-scid-alias=true
    protocol.zero-conf=true
    protocol.simple-taproot-chans=true

    [routerrpc]
    routerrpc.estimator=${
        settingsStore?.settings?.bimodalPathfinding ? 'bimodal' : 'apriori'
    }`;

    await writeConfig({ lndDir, config });
};

export async function deleteLndWallet(lndDir: string) {
    log.d('Attempting to delete Embedded LND wallet');
    try {
        await stopLnd();
        await NativeModules.LndMobileTools.deleteLndDirectory(lndDir);
    } catch (error) {
        log.e('Embedded LND wallet deletion failed', [error]);
    }
}

export async function expressGraphSync() {
    syncStore.setExpressGraphSyncStatus(true);
    const start = new Date();

    const cancelOnEnd = syncStore.waitForExpressGraphSyncEnd().then(() => {
        console.log('Express graph sync cancelling...');
        cancelGossipSync();
        console.log('Express graph sync cancelled...');
    });

    if (settingsStore?.settings?.resetExpressGraphSyncOnStartup) {
        log.d('Clearing speedloader files');
        try {
            await NativeModules.LndMobileTools.DEBUG_deleteSpeedloaderLastrunFile();
            await NativeModules.LndMobileTools.DEBUG_deleteSpeedloaderDgraphDirectory();
        } catch (error) {
            log.e('Gossip files deletion failed', [error]);
        }

        if (settingsStore?.isSqlite) {
            log.d('Resetting native SQL graph database');
            try {
                const lndDir = settingsStore?.lndDir || 'lnd';
                const network =
                    settingsStore?.embeddedLndNetwork === 'Mainnet'
                        ? 'mainnet'
                        : 'testnet';
                await NativeModules.LndMobileTools.DEBUG_resetGraphDb(
                    lndDir,
                    network
                );
            } catch (error) {
                log.e('Graph database reset failed', [error]);
            }
        }
    }

    const gossipWork = (async () => {
        const gossipStatus = await gossipSync(
            settingsStore?.settings?.speedloader === 'Custom'
                ? settingsStore?.settings?.customSpeedloader
                : settingsStore?.settings?.speedloader || DEFAULT_SPEEDLOADER,
            settingsStore?.lndDir || 'lnd',
            settingsStore?.isSqlite || false
        );

        const completionTime =
            (new Date().getTime() - start.getTime()) / 1000 + 's';
        console.log('gossipStatus', `${gossipStatus} - ${completionTime}`);
    })();

    try {
        await Promise.race([gossipWork, cancelOnEnd]);
    } catch (e) {
        log.e('GossipSync exception!', [e]);
    } finally {
        syncStore.setExpressGraphSyncStatus(false);
    }

    return true;
}

export async function initializeLnd({
    lndDir = 'lnd',
    isTestnet,
    rescan,
    compactDb,
    isSqlite
}: {
    lndDir: string;
    isTestnet?: boolean;
    rescan?: boolean;
    compactDb?: boolean;
    isSqlite?: boolean;
}) {
    const { initialize } = lndMobile.index;
    await writeLndConfig({ lndDir, isTestnet, rescan, compactDb, isSqlite });
    await initialize();
}

/**
 * Resolves only when the SubscribeState gRPC stream emits EOF (LND stopped).
 * Must be called before initiating shutdown to avoid missing the event.
 */
function waitForSubscribeStateEOF(): {
    promise: Promise<void>;
    cancel: () => void;
} {
    let settled = false;
    let listener: ReturnType<typeof LndMobileEventEmitter.addListener> | null =
        null;
    let settle: () => void = () => {};

    const promise = new Promise<void>((resolve) => {
        settle = () => {
            if (settled) return;
            settled = true;
            listener?.remove();
            listener = null;
            resolve();
        };

        listener = LndMobileEventEmitter.addListener(
            'SubscribeState',
            (event: any) => {
                const err = checkLndStreamErrorResponse(
                    'SubscribeState',
                    event
                );
                if (err === 'EOF') {
                    log.d(
                        'SubscribeState EOF received — LND daemon fully stopped'
                    );
                    settle();
                }
            }
        );
    });

    return {
        promise,
        cancel: () => settle()
    };
}

/**
 * Stops the LND process gracefully using an event-driven approach.
 * Waits for SubscribeState EOF before returning when a stop was initiated.
 * @param forceStop - If true, skip status check and always call stopDaemon. Use when Go layer
 *   reports "already started" but Java checkStatus says not running (state mismatch).
 */
export async function stopLnd(forceStop = false) {
    const { checkStatus, stopLnd } = lndMobile.index;

    const runWithExpectedErrorHandling = async <T>(
        fn: () => Promise<T>,
        context: string
    ): Promise<T | null> => {
        try {
            return await fn();
        } catch (error) {
            const msg = getErrorMessage(error);
            if (isStopLndExpectedError(msg)) {
                log.d(`${context}: ${msg} (expected, treating as success)`);
                return null;
            }
            throw error;
        }
    };

    // Hoisted so catch can cancel it on early error.
    let shutdownWaiter: ReturnType<typeof waitForSubscribeStateEOF> | null =
        null;

    try {
        if (!forceStop) {
            // Check if LND is currently running
            const status = await runWithExpectedErrorHandling(
                () => checkStatus(),
                'checkStatus'
            );

            if (!status) {
                log.d(
                    'LND status check returned expected error - already stopped'
                );
                settingsStore.embeddedLndStarted = false;
                return;
            }

            const isRunning =
                (status & ELndMobileStatusCodes.STATUS_PROCESS_STARTED) ===
                ELndMobileStatusCodes.STATUS_PROCESS_STARTED;

            log.d(`LND running status: ${isRunning}`);

            if (!isRunning) {
                log.d('LND is not running, stop not required');
                settingsStore.embeddedLndStarted = false;
                return;
            }
        } else {
            log.d('Force stop: skipping status check (Go state mismatch)');
        }
        // Register before stop/kill so we do not miss an early SubscribeState EOF.
        shutdownWaiter = waitForSubscribeStateEOF();
        // Initiate graceful shutdown - both can throw; continue even if one fails
        log.d('Stopping LND...');
        try {
            await runWithExpectedErrorHandling(() => stopLnd(), 'stopLnd');
        } catch (stopError) {
            const stopMsg = getErrorMessage(stopError);
            if (
                matchesLndErrorCode(
                    stopMsg,
                    LndErrorCode.WALLET_RECOVERY_IN_PROGRESS
                )
            ) {
                log.d('Wallet recovery in progress - proceeding to force kill');
            } else {
                throw stopError;
            }
        }
        const killResult = await runWithExpectedErrorHandling(
            () => NativeModules.LndMobileTools.killLnd(),
            'killLnd'
        );
        if (killResult === null) {
            log.d(
                'killLnd returned expected error - LND may already be stopped'
            );
        }
        settingsStore.embeddedLndStarted = false;

        // Wait for Go to close the gRPC server (EOF), with a cap — native can omit EOF
        // while JS would otherwise await forever.
        log.d('Waiting for LND shutdown confirmation (SubscribeState EOF)...');
        const eofOrTimeout = await Promise.race([
            shutdownWaiter.promise.then(() => 'eof' as const),
            new Promise<'timeout'>((resolve) =>
                setTimeout(
                    () => resolve('timeout'),
                    LND_SHUTDOWN_EOF_TIMEOUT_MS
                )
            )
        ]);
        if (eofOrTimeout === 'timeout') {
            log.w(
                `SubscribeState EOF not received within ${LND_SHUTDOWN_EOF_TIMEOUT_MS}ms; proceeding after killLnd`
            );
            shutdownWaiter.cancel();
        } else {
            log.d('LND shutdown confirmed (SubscribeState EOF)');
        }
    } catch (error) {
        shutdownWaiter?.cancel();
        const errorMessage = getErrorMessage(error);
        if (isStopLndExpectedError(errorMessage)) {
            log.d(`LND stop completed with expected state: ${errorMessage}`);
            return;
        }
        log.e('Error stopping LND', [error]);
        throw error;
    }
}

/**
 * Starts the LND process and waits for it to reach a ready state
 * @param lndDir - LND data directory path
 * @param walletPassword - Password to unlock the wallet (empty for new wallet creation)
 * @param isTorEnabled - Whether Tor is enabled
 * @param isTestnet - Whether to run on testnet
 * @param isRecovery - Whether this is a wallet recovery (skips folder existence check)
 * @throws Error if LND folder is missing, startup fails, or timeout occurs
 */
export async function startLnd({
    lndDir = 'lnd',
    walletPassword,
    isTorEnabled = false,
    isTestnet = false,
    isRecovery = false
}: {
    lndDir: string;
    walletPassword: string;
    isTorEnabled: boolean;
    isTestnet: boolean;
    isRecovery?: boolean;
}) {
    const { startLnd, decodeState } = lndMobile.index;
    const { unlockWallet } = lndMobile.wallet;

    // Check if LND folder exists before starting (iOS issue: keychain data persists after uninstall)
    // Skip this check during wallet creation (when walletPassword is empty) or recovery (folder doesn't exist yet)
    if (Platform.OS === 'ios' && walletPassword && !isRecovery) {
        try {
            const folderExists = await checkLndFolderExists(lndDir);
            if (!folderExists) {
                log.e(
                    'LND folder does not exist but wallet config exists - likely app was reinstalled'
                );
                throw createLndError(LndErrorCode.LND_FOLDER_MISSING);
            }
        } catch (error: any) {
            if (
                isLndError(error, LndErrorCode.LND_FOLDER_MISSING) ||
                error?.message?.includes("doesn't exist")
            ) {
                throw createLndError(LndErrorCode.LND_FOLDER_MISSING);
            }
            // Other errors during check - continue and let startLnd handle it
            log.e('Error checking LND folder', [error]);
        }
    }

    // Mark as started only on proper start-up, not on wallet creation
    if (walletPassword) {
        settingsStore.embeddedLndStarted = true;
    }

    // Register the SubscribeState listener before native startLnd fires.
    // On both platforms, native startLnd starts the SubscribeState stream inside
    // its own callback before resolving the JS promise, so the first state event
    // may arrive before or alongside the resolved promise.  Registering first
    // guarantees we never miss it.  The JS subscribeState() call is a no-op
    // because "SubscribeState" is already tracked natively (streamsStarted /
    // activeStreams), preventing a duplicate subscription.
    const readyPromise = waitForLndReady({
        decodeState,
        walletPassword,
        unlockWallet
    });
    await startLndWithRetry({
        startLnd,
        lndDir,
        isTorEnabled,
        isTestnet,
        walletPassword,
        unlockWallet
    });
    await readyPromise;
}

/**
 * Helper function to start LND with retry logic
 */
async function startLndWithRetry({
    startLnd,
    lndDir,
    isTorEnabled,
    isTestnet,
    walletPassword,
    unlockWallet
}: {
    startLnd: (opts: {
        args: string;
        lndDir: string;
        isTorEnabled: boolean;
        isTestnet: boolean;
    }) => Promise<unknown>;
    lndDir: string;
    isTorEnabled: boolean;
    isTestnet: boolean;
    walletPassword: string;
    unlockWallet: (password: string) => Promise<void>;
}) {
    const startArgs = { args: '', lndDir, isTorEnabled, isTestnet };

    for (let attempt = 1; attempt <= MAX_LND_START_RETRIES; attempt++) {
        try {
            if (attempt > 1) {
                await sleep(LND_RETRY_DELAY_MS);
            }
            await startLnd(startArgs);
            if (attempt > 1) {
                log.d('LND started successfully after retry');
            }
            return;
        } catch (error: unknown) {
            const msg = getErrorMessage(error);

            if (matchesLndErrorCode(msg, LndErrorCode.LND_FOLDER_MISSING)) {
                throw createLndError(LndErrorCode.LND_FOLDER_MISSING);
            }
            if (matchesLndErrorCode(msg, LndErrorCode.LND_ALREADY_RUNNING)) {
                log.d(`LND already running (attempt ${attempt}) — force stop`);
                await stopLnd(true);
                continue;
            }
            if (matchesLndErrorCode(msg, LndErrorCode.WALLET_LOCKED)) {
                log.d('Wallet is locked, attempting to unlock');
                if (walletPassword) {
                    try {
                        await unlockWallet(walletPassword);
                        log.d('Wallet unlocked successfully');
                    } catch (unlockError: unknown) {
                        log.e('Error unlocking wallet', [unlockError]);
                    }
                }
                return;
            }

            log.w(`Retry attempt ${attempt}/${MAX_LND_START_RETRIES} failed`, [
                error
            ]);
            if (attempt === MAX_LND_START_RETRIES) {
                log.e(
                    `LND failed to start after ${MAX_LND_START_RETRIES} attempts`
                );
                throw createLndError(LndErrorCode.LND_START_FAILED);
            }
        }
    }
}

/**
 * Helper function to wait for LND to reach a ready state
 */

async function waitForLndReady({
    decodeState,
    walletPassword,
    unlockWallet
}: {
    decodeState: (data: string) => lnrpc.SubscribeStateResponse;
    walletPassword: string;
    unlockWallet: (password: string) => Promise<void>;
}): Promise<boolean> {
    let unlockAttempted = false;

    const handleRpcReady = async (context: string) => {
        await waitForRpcReady();
        if (walletPassword && !syncStore.isSyncing) {
            log.d('Starting sync');
            syncStore.startSyncing();
        }
        if (settingsStore?.settings?.rescan) {
            syncStore.startRescanTracking(0);
        }
        log.d(`${context}: RPC ready`);
    };

    const waitForState = () =>
        new Promise<boolean>((resolve, reject) => {
            let settled = false;
            let subscription: ReturnType<
                typeof LndMobileEventEmitter.addListener
            > | null = null;

            const cleanup = () => {
                clearTimeout(timeout);
                subscription?.remove();
                subscription = null;
            };

            const settle = (fn: () => void) => {
                if (settled) return;
                settled = true;
                cleanup();
                fn();
            };

            const stateHandler = (event: any) => {
                if (settled) return;
                log.d('SubscribeState event received', [event]);

                const error = checkLndStreamErrorResponse(
                    'SubscribeState',
                    event
                );
                if (error === 'EOF') {
                    // LND stopped mid-startup (force-stop on "already started").
                    // Keep this listener alive — it must handle state events from
                    // the restarted LND after the retry.
                    // Reset unlockAttempted so a fresh LOCKED event on the
                    // restarted LND triggers the unlock correctly.
                    unlockAttempted = false;
                    return;
                }
                if (error) {
                    settle(() => reject(error));
                    return;
                }

                if (event?.error_code && !event?.data) {
                    log.d(
                        'SubscribeState: connection closed or no data, skipping'
                    );
                    return;
                }

                const state = decodeState(event.data ?? '');
                log.d(`Current LND state: ${state.state}`);

                const handleAsync = async () => {
                    switch (state.state) {
                        case lnrpc.WalletState.NON_EXISTING:
                            log.d('Wallet does not exist - ready for creation');
                            await sleep(STATE_SUBSCRIPTION_SETTLE_MS);
                            settle(() => resolve(true));
                            break;

                        case lnrpc.WalletState.LOCKED:
                            log.d('Wallet is locked');
                            if (!unlockAttempted && walletPassword) {
                                unlockAttempted = true;
                                await unlockWallet(walletPassword);
                                log.d('Wallet unlocked successfully');
                            }
                            break;

                        case lnrpc.WalletState.UNLOCKED:
                            log.d(
                                'Wallet unlocked - waiting for RPC to become active'
                            );
                            break;

                        case lnrpc.WalletState.RPC_ACTIVE:
                            log.d('RPC is active');
                            await handleRpcReady('RPC_ACTIVE');
                            settle(() => resolve(true));
                            break;

                        case lnrpc.WalletState.SERVER_ACTIVE:
                            log.d('Server is active');
                            await handleRpcReady('SERVER_ACTIVE');
                            settle(() => resolve(true));
                            break;

                        default:
                            log.d('Unknown wallet state', [state.state]);
                            break;
                    }
                };

                handleAsync().catch((error) => {
                    log.e('SubscribeState handler error', [error]);
                    settle(() => reject(error));
                });
            };

            const timeout = setTimeout(
                () =>
                    settle(() =>
                        reject(createLndError(LndErrorCode.LND_READY_TIMEOUT))
                    ),
                LND_READY_TIMEOUT_MS
            );

            subscription = LndMobileEventEmitter.addListener(
                'SubscribeState',
                stateHandler
            );
        });

    // Register before native startLnd so we never miss the initial state event.
    const statePromise = waitForState();

    // Both platforms start the SubscribeState stream natively inside the
    // startLnd callback, before the JS promise resolves, so no explicit
    // subscribeState() call or guard sleep is needed here.
    log.d('SubscribeState stream started natively — skipping JS subscribe');

    return statePromise;
}

export async function optimizeNeutrinoPeers(
    isTestnet?: boolean,
    peerTargetCount = 3
) {
    const primary = isTestnet
        ? DEFAULT_NEUTRINO_PEERS_TESTNET
        : DEFAULT_NEUTRINO_PEERS_MAINNET;

    const rows = await pingNeutrinoHosts(primary);
    const selected: string[] = [];
    const chosen = new Set<string>();

    log.d(`optimizeNeutrinoPeers: target ${peerTargetCount}`);

    pickPeersUnderMs(
        rows,
        selected,
        chosen,
        NEUTRINO_PING_OPTIMAL_MS,
        Number.POSITIVE_INFINITY
    );
    pickPeersUnderMs(
        rows,
        selected,
        chosen,
        NEUTRINO_PING_LAX_MS,
        peerTargetCount
    );
    pickPeersUnderMs(
        rows,
        selected,
        chosen,
        NEUTRINO_PING_THRESHOLD_MS,
        peerTargetCount
    );

    if (selected.length < peerTargetCount && !isTestnet) {
        for (const group of SECONDARY_NEUTRINO_PEERS_MAINNET) {
            if (selected.length >= peerTargetCount) break;
            const batch = await pingNeutrinoHosts(group);
            pickPeersUnderMs(
                batch,
                selected,
                chosen,
                NEUTRINO_PING_THRESHOLD_MS,
                peerTargetCount
            );
        }
    }

    if (selected.length === 0) {
        log.d('optimizeNeutrinoPeers: using defaults (no fast peers found)');
        return;
    }

    const dontAllowOtherPeers = selected.length > 2;
    await settingsStore.updateSettings(
        isTestnet
            ? { neutrinoPeersTestnet: selected, dontAllowOtherPeers }
            : { neutrinoPeersMainnet: selected, dontAllowOtherPeers }
    );
    log.d('optimizeNeutrinoPeers: selected', [selected]);
}

/**
 * Stops LND, waits for process to fully terminate, then starts fresh.
 * Used when genSeed fails due to "unlocked too quickly" - we need a clean restart.
 */
async function restartLndForWalletCreation(
    lndDir: string,
    isTestnet: boolean
): Promise<void> {
    const { startLnd, decodeState } = lndMobile.index;
    const { unlockWallet } = lndMobile.wallet;

    await stopLnd();
    await sleep(GEN_SEED_STOP_DELAY_MS);

    try {
        await retry({
            fn: async () => {
                const readyPromise = waitForLndReady({
                    decodeState,
                    walletPassword: '',
                    unlockWallet
                });
                await startLnd({
                    args: '',
                    lndDir,
                    isTorEnabled: false,
                    isTestnet
                });
                await readyPromise;
            },
            maxRetries: MAX_LND_START_RETRIES,
            delayMs: 0,
            shouldRetry: (e) =>
                matchesLndErrorCode(
                    getErrorMessage(e),
                    LndErrorCode.LND_ALREADY_RUNNING
                ),
            onRetry: async (attempt) => {
                log.d(
                    `Restarting LND for wallet creation (attempt ${
                        attempt + 1
                    }/${MAX_LND_START_RETRIES})`
                );
                await stopLnd();
                await sleep(GEN_SEED_STOP_DELAY_MS + attempt * 1000);
            }
        });
    } catch (e) {
        if (
            matchesLndErrorCode(
                getErrorMessage(e),
                LndErrorCode.LND_ALREADY_RUNNING
            )
        ) {
            throw createLndError(
                LndErrorCode.WALLET_CREATION_UNLOCKED_TOO_QUICKLY
            );
        }
        throw e;
    }
}

/**
 * Calls genSeed with retry when LND transitions too quickly (WalletUnlocker race condition)
 */
async function genSeedWithRetry(
    genSeed: (aezeedPassphrase?: string) => Promise<any>,
    lndDir: string,
    isTestnet: boolean
): Promise<any> {
    return retry({
        fn: async () => {
            const seed = await genSeed(undefined);
            if (!seed) {
                throw createLndError(LndErrorCode.GEN_SEED_FAILED);
            }
            return seed;
        },
        maxRetries: GEN_SEED_MAX_RETRIES,
        delayMs: GEN_SEED_RETRY_DELAY_MS,
        shouldRetry: (e) =>
            matchesLndErrorCode(
                getErrorMessage(e),
                LndErrorCode.GEN_SEED_UNLOCKED
            ),
        onRetry: async () => {
            log.d('LND unlocked too quickly - restarting for wallet creation');
            await restartLndForWalletCreation(lndDir, isTestnet ?? false);
        }
    }).catch((e) => {
        const msg = getErrorMessage(e);
        if (matchesLndErrorCode(msg, LndErrorCode.GEN_SEED_UNLOCKED)) {
            throw createLndError(
                LndErrorCode.WALLET_CREATION_UNLOCKED_TOO_QUICKLY
            );
        }
        throw createLndError(LndErrorCode.GEN_SEED_FAILED, msg);
    });
}

export async function createLndWallet({
    lndDir,
    seedMnemonic,
    walletPassphrase,
    isTestnet,
    channelBackupsBase64,
    channelDbUri,
    channelDbFileName,
    setStatus,
    isSqlite = false
}: {
    lndDir: string;
    seedMnemonic?: string;
    walletPassphrase?: string;
    isTestnet?: boolean;
    channelBackupsBase64?: string;
    channelDbUri?: string;
    channelDbFileName?: string;
    setStatus?: (message: string | null) => void;
    isSqlite?: boolean;
}) {
    const {
        initialize,
        createIOSApplicationSupportAndLndDirectories,
        excludeLndICloudBackup
    } = lndMobile.index;
    const { genSeed, initWallet } = lndMobile.wallet;

    if (Platform.OS === 'ios') {
        log.d('createLndWallet: creating iOS directories');
        await createIOSApplicationSupportAndLndDirectories(lndDir);
        await excludeLndICloudBackup(lndDir);
    }

    log.d('createLndWallet: writing LND config');
    await writeLndConfig({
        lndDir,
        isTestnet,
        isSqlite
    });
    log.d('createLndWallet: initializing native module');
    await initialize();

    if (setStatus)
        setStatus(localeString('views.Tools.migration.status.startingLnd'));
    log.d('createLndWallet: starting LND');
    await startLnd({
        lndDir,
        walletPassword: '',
        isTorEnabled: false,
        isTestnet: isTestnet || false
    });
    log.d('createLndWallet: LND started successfully');

    let seed: any;
    if (!seedMnemonic) {
        seed = await genSeedWithRetry(genSeed, lndDir, isTestnet ?? false);
    } else {
        seed = {
            cipher_seed_mnemonic: seedMnemonic?.split(' ')
        };
    }

    const random = await generateSecureRandom(32);
    const randomBase64 = Base64Utils.bytesToBase64(random);

    const isRestore = walletPassphrase || seedMnemonic;
    const hasChannelDb = channelDbUri && channelDbFileName;
    if (setStatus)
        setStatus(
            localeString('views.Tools.migration.status.initializingWallet')
        );
    log.d(
        `createLndWallet: calling initWallet (recoveryWindow=${
            isRestore && !hasChannelDb ? 500 : 'none'
        })`
    );
    const wallet: any = await initWallet(
        seed.cipher_seed_mnemonic,
        randomBase64,
        isRestore && !hasChannelDb ? 500 : undefined,
        channelBackupsBase64 ? channelBackupsBase64 : undefined,
        walletPassphrase ? walletPassphrase : undefined
    );
    log.d(
        `createLndWallet: initWallet returned (has macaroon: ${!!wallet?.admin_macaroon})`
    );

    if (hasChannelDb) {
        if (setStatus)
            setStatus(localeString('views.Tools.migration.export.stoppingLnd'));
        try {
            await stopLnd(true);
        } catch (e: any) {
            if (e?.message?.includes?.('closed')) {
                console.log('LND stopped successfully.');
            } else {
                console.error('Failed to stop LND:', e.message);
                Alert.alert(
                    localeString('general.error'),
                    localeString('views.Tools.migration.export.failedToStopLnd')
                );
                throw e;
            }
        }

        if (setStatus)
            setStatus(
                localeString('views.Tools.migration.status.importingBackup')
            );
        await importChannelDb(
            channelDbUri,
            channelDbFileName,
            lndDir,
            isTestnet || false
        );

        LndMobileEventEmitter.removeAllListeners('SubscribeState');
        settingsStore.embeddedLndStarted = false;
        settingsStore.walletJustCreated = false;
    } else {
        // Mark that LND is already running from wallet creation,
        // so Wallet.tsx skips the stop→init→start cycle
        settingsStore.embeddedLndStarted = true;
        settingsStore.walletJustCreated = true;
    }

    return { wallet, seed, randomBase64 };
}

/**
 * Waits for LND RPC to become ready by polling getInfo
 * @param timeoutMs - Maximum time to wait in milliseconds (default: 30000)
 * @returns The getInfo response once RPC is ready
 * @throws Error if RPC doesn't become ready within timeout or encounters a fatal error
 */
export async function waitForRpcReady(timeoutMs = 30000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
        try {
            const info = await lndMobile.index.getInfo();
            log.d(`RPC ready - Node pubkey: ${info.identity_pubkey}`);
            return info;
        } catch (error: any) {
            const errorMessage = error?.message ?? '';
            log.d(`RPC not ready yet: ${errorMessage}`);

            // Connection closed - stop polling
            if (
                matchesLndErrorCode(
                    errorMessage,
                    LndErrorCode.RPC_CONNECTION_CLOSED
                )
            ) {
                throw createLndError(LndErrorCode.RPC_CONNECTION_CLOSED);
            }
            if (matchesLndErrorCode(errorMessage, LndErrorCode.RPC_NOT_READY)) {
                await sleep(500);
                continue;
            }

            // Fatal error - stop immediately
            log.e('Fatal error while waiting for RPC', [error]);
            throw error;
        }
    }

    throw createLndError(
        LndErrorCode.RPC_READY_TIMEOUT,
        `Timeout: ${timeoutMs}ms`
    );
}
