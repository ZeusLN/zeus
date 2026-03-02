import {
    DeviceEventEmitter,
    NativeEventEmitter,
    NativeModules,
    Platform
} from 'react-native';
import DeviceInfo from 'react-native-device-info';

import { generateSecureRandom } from 'react-native-securerandom';

// @ts-ignore:next-line
import Ping from 'react-native-ping';

import Log from '../lndmobile/log';
const log = Log('utils/LndMobileUtils.ts');

import Base64Utils from './Base64Utils';
import { retry, sleep } from './SleepUtils';

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
const LISTENER_REGISTRATION_MS = 100; // Delay to allow event listener to fully register before subscribing
const LND_RETRY_DELAY_MS = 3000; // Base delay between LND start retry attempts
const ANDROID_PROCESS_CLEANUP_DELAY_MS = 4000; // Extra time Android needs for process cleanup (slower than iOS)
const IOS_PROCESS_CLEANUP_DELAY_MS = 2000; // iOS process cleanup delay
const GEN_SEED_STOP_DELAY_MS = 3000; // Delay after stopping LND before wallet creation restart attempts
const GEN_SEED_MAX_RETRIES = 10; // Max retries when LND unlocks too quickly during wallet creation
const GEN_SEED_RETRY_DELAY_MS = 500; // Delay between genSeed retry attempts (ms)
const STOP_LND_MAX_RETRIES = 10; // Stop LND: max polling attempts to verify shutdown
const STOP_LND_POLL_DELAY_MS = 500; // Stop LND: delay between polling attempts (ms)
const MAX_START_LND_RETRIES = 10; // Maximum start attempts for LND
const LND_READY_TIMEOUT_MS = 60000; // Max wait for LND to reach ready state (wallet/RPC)

export const NEUTRINO_PING_TIMEOUT_MS = 1500;
export const NEUTRINO_PING_OPTIMAL_MS = 200;
export const NEUTRINO_PING_LAX_MS = 500;
export const NEUTRINO_PING_THRESHOLD_MS = 1000;

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
    return await new Promise(async (resolve) => {
        syncStore.setExpressGraphSyncStatus(true);
        const start = new Date();

        syncStore.waitForExpressGraphSyncEnd().then(() => {
            // call cancellation to LND here
            console.log('Express graph sync cancelling...');
            cancelGossipSync();
            console.log('Express graph sync cancelled...');
            resolve(true);
        });

        if (settingsStore?.settings?.resetExpressGraphSyncOnStartup) {
            log.d('Clearing speedloader files');
            try {
                await NativeModules.LndMobileTools.DEBUG_deleteSpeedloaderLastrunFile();
                await NativeModules.LndMobileTools.DEBUG_deleteSpeedloaderDgraphDirectory();
            } catch (error) {
                log.e('Gossip files deletion failed', [error]);
            }
        }

        try {
            const gossipStatus = await gossipSync(
                settingsStore?.settings?.speedloader === 'Custom'
                    ? settingsStore?.settings?.customSpeedloader
                    : settingsStore?.settings?.speedloader ||
                          DEFAULT_SPEEDLOADER
            );

            const completionTime =
                (new Date().getTime() - start.getTime()) / 1000 + 's';
            console.log('gossipStatus', `${gossipStatus} - ${completionTime}`);
            syncStore.setExpressGraphSyncStatus(false);
            resolve(true);
        } catch (e) {
            log.e('GossipSync exception!', [e]);
            syncStore.setExpressGraphSyncStatus(false);
            resolve(true);
        }
    });
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
 * Stops the LND process gracefully with retry mechanism
 * @param maxRetries - Maximum number of polling attempts to verify shutdown (default: 10)
 * @param delayMs - Delay between polling attempts in milliseconds (default: 500)
 * @param forceStop - If true, skip status check and always call stopDaemon. Use when Go layer
 *   reports "already started" but Java checkStatus says not running (state mismatch).
 * @throws Error if LND fails to stop after max retries (unexpected errors only)
 */
export async function stopLnd(
    maxRetries = STOP_LND_MAX_RETRIES,
    delayMs = STOP_LND_POLL_DELAY_MS,
    forceStop = false
) {
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
        // Initiate graceful shutdown - both can throw; continue even if one fails
        log.d('Stopping LND...');
        await runWithExpectedErrorHandling(() => stopLnd(), 'stopLnd');
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

        // Poll until LND process has fully stopped
        await retry({
            fn: async () => {
                const currentStatus = await runWithExpectedErrorHandling(
                    () => checkStatus(),
                    'poll'
                );
                if (currentStatus === null) {
                    log.d('LND stopped (status check returned expected error)');
                    return;
                }
                const stillRunning =
                    (currentStatus &
                        ELndMobileStatusCodes.STATUS_PROCESS_STARTED) ===
                    ELndMobileStatusCodes.STATUS_PROCESS_STARTED;
                if (!stillRunning) {
                    log.d('LND stopped successfully');
                    return;
                }
                throw new Error(
                    `LND failed to stop after ${maxRetries} attempts`
                );
            },
            maxRetries,
            delayMs,
            onRetry: (attempt) => {
                log.d(
                    `Stop polling attempt ${attempt}/${maxRetries}, LND still running`
                );
            }
        });
    } catch (error) {
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
    const { startLnd, decodeState, subscribeState } = lndMobile.index;
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

    await startLndWithRetry({
        startLnd,
        lndDir,
        isTorEnabled,
        isTestnet,
        walletPassword,
        unlockWallet
    });
    // Wait for state subscription to be ready
    await sleep(STATE_SUBSCRIPTION_SETTLE_MS);
    await waitForLndReady({
        decodeState,
        subscribeState,
        walletPassword,
        unlockWallet
    });
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

    try {
        await startLnd(startArgs);
        return;
    } catch (error: unknown) {
        const errorMessage = getErrorMessage(error);

        if (
            matchesLndErrorCode(errorMessage, LndErrorCode.LND_FOLDER_MISSING)
        ) {
            throw createLndError(LndErrorCode.LND_FOLDER_MISSING);
        }
        if (
            matchesLndErrorCode(errorMessage, LndErrorCode.LND_ALREADY_RUNNING)
        ) {
            log.d('LND already started - force stop (Go thinks running)');
            await stopLnd(STOP_LND_MAX_RETRIES, STOP_LND_POLL_DELAY_MS, true);
            const delayMs =
                Platform.OS === 'android'
                    ? ANDROID_PROCESS_CLEANUP_DELAY_MS
                    : IOS_PROCESS_CLEANUP_DELAY_MS;
            await sleep(delayMs);
        }

        log.w('Error starting LND, attempting retry', [error]);
        await retryStartLnd({
            startLnd,
            startArgs,
            walletPassword,
            unlockWallet
        });
    }
}

async function retryStartLnd({
    startLnd,
    startArgs,
    walletPassword,
    unlockWallet
}: {
    startLnd: (opts: {
        args: string;
        lndDir: string;
        isTorEnabled: boolean;
        isTestnet: boolean;
    }) => Promise<unknown>;
    startArgs: {
        args: string;
        lndDir: string;
        isTorEnabled: boolean;
        isTestnet: boolean;
    };
    walletPassword: string;
    unlockWallet: (password: string) => Promise<void>;
}) {
    for (let attempt = 1; attempt <= MAX_START_LND_RETRIES; attempt++) {
        try {
            await sleep(LND_RETRY_DELAY_MS);
            await startLnd(startArgs);
            log.d('LND started successfully after retry');
            return;
        } catch (retryError: unknown) {
            const msg = getErrorMessage(retryError);

            if (matchesLndErrorCode(msg, LndErrorCode.LND_FOLDER_MISSING)) {
                throw createLndError(LndErrorCode.LND_FOLDER_MISSING);
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
            if (matchesLndErrorCode(msg, LndErrorCode.LND_ALREADY_RUNNING)) {
                log.d(`LND still running (attempt ${attempt}) - force stop`);
                await stopLnd(
                    STOP_LND_MAX_RETRIES,
                    STOP_LND_POLL_DELAY_MS,
                    true
                );
                await sleep(
                    Platform.OS === 'android'
                        ? ANDROID_PROCESS_CLEANUP_DELAY_MS
                        : IOS_PROCESS_CLEANUP_DELAY_MS
                );
                continue;
            }

            log.w(`Retry attempt ${attempt}/${MAX_START_LND_RETRIES} failed`, [
                retryError
            ]);
            if (attempt === MAX_START_LND_RETRIES) {
                log.e(
                    `LND failed to start after ${MAX_START_LND_RETRIES} attempts`
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
    subscribeState,
    walletPassword,
    unlockWallet
}: {
    decodeState: (data: string) => lnrpc.SubscribeStateResponse;
    subscribeState: () => Promise<string>;
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

            const cleanup = () => {
                clearTimeout(timeout);
                LndMobileEventEmitter.removeAllListeners('SubscribeState');
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
                if (error === 'EOF') return;
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
                            try {
                                await handleRpcReady('SERVER_ACTIVE');
                            } catch (e: any) {
                                log.e(
                                    'RPC ready check failed (SERVER_ACTIVE)',
                                    [e]
                                );
                            }
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

            LndMobileEventEmitter.addListener('SubscribeState', stateHandler);
        });

    await sleep(LISTENER_REGISTRATION_MS);

    log.d('Starting state subscription');
    await subscribeState();
    log.d('State subscription started successfully');

    return waitForState();
}

export async function optimizeNeutrinoPeers(
    isTestnet?: boolean,
    peerTargetCount: number = 3
) {
    console.log('Optimizing Neutrino peers');
    let peers = isTestnet
        ? DEFAULT_NEUTRINO_PEERS_TESTNET
        : DEFAULT_NEUTRINO_PEERS_MAINNET;

    const results: { peer: string; ms: number | string }[] = [];
    for (let i = 0; i < peers.length; i++) {
        const peer = peers[i];
        await new Promise(async (resolve) => {
            try {
                const ms = await Ping.start(peer, {
                    timeout: NEUTRINO_PING_TIMEOUT_MS
                });
                console.log(`# ${peer} - ${ms}`);
                results.push({
                    peer,
                    ms
                });
                resolve(true);
            } catch (e) {
                console.log('e', e);
                results.push({
                    peer,
                    ms: 'Timed out'
                });
                resolve(true);
            }
        });
    }

    // Optimal

    const selectedPeers: string[] = [];

    console.log(
        `Adding Neutrino peers with ping times <${NEUTRINO_PING_OPTIMAL_MS}ms`
    );

    const optimalResults = results.filter((result: any) => {
        return (
            Number.isInteger(result.ms) && result.ms < NEUTRINO_PING_OPTIMAL_MS
        );
    });

    optimalResults.forEach((result: any) => {
        selectedPeers.push(result.peer);
    });

    console.log('Peers count:', selectedPeers.length);

    // Lax

    if (selectedPeers.length < peerTargetCount) {
        console.log(
            `Adding Neutrino peers with ping times <${NEUTRINO_PING_LAX_MS}ms`
        );

        const laxResults = results.filter((result: any) => {
            return (
                Number.isInteger(result.ms) && result.ms < NEUTRINO_PING_LAX_MS
            );
        });

        laxResults.forEach((result: any) => {
            if (
                !selectedPeers.includes(result.peer) &&
                selectedPeers.length < peerTargetCount
            ) {
                selectedPeers.push(result.peer);
            }
        });

        console.log('Peers count:', selectedPeers.length);
    }

    // Threshold

    if (selectedPeers.length < peerTargetCount) {
        console.log(
            `Selecting Neutrino peers with ping times <${NEUTRINO_PING_THRESHOLD_MS}ms`
        );

        const thresholdResults = results.filter((result: any) => {
            return (
                Number.isInteger(result.ms) &&
                result.ms < NEUTRINO_PING_THRESHOLD_MS
            );
        });

        thresholdResults.forEach((result: any) => {
            if (
                !selectedPeers.includes(result.peer) &&
                selectedPeers.length < peerTargetCount
            ) {
                selectedPeers.push(result.peer);
            }
        });

        console.log('Peers count:', selectedPeers.length);
    }

    // Extra external peers
    if (selectedPeers.length < peerTargetCount && !isTestnet) {
        console.log(
            `Selecting Neutrino peers with ping times <${NEUTRINO_PING_THRESHOLD_MS}ms from alternate set`
        );

        for (let j = 0; j < SECONDARY_NEUTRINO_PEERS_MAINNET.length; j++) {
            if (selectedPeers.length < peerTargetCount) {
                peers = SECONDARY_NEUTRINO_PEERS_MAINNET[j];
                console.log('Trying peers', peers);
                for (let i = 0; i < peers.length; i++) {
                    const peer = peers[i];
                    await new Promise(async (resolve) => {
                        try {
                            const ms = await Ping.start(peer, {
                                timeout: NEUTRINO_PING_TIMEOUT_MS
                            });
                            console.log(`# ${peer} - ${ms}`);
                            results.push({
                                peer,
                                ms
                            });
                            resolve(true);
                        } catch (e) {
                            console.log('e', e);
                            results.push({
                                peer,
                                ms: 'Timed out'
                            });
                            resolve(true);
                        }
                    });
                }
            }
        }

        const filteredResults = results.filter((result: any) => {
            return (
                Number.isInteger(result.ms) &&
                result.ms < NEUTRINO_PING_THRESHOLD_MS
            );
        });

        filteredResults.forEach((result: any) => {
            if (
                !selectedPeers.includes(result.peer) &&
                selectedPeers.length < peerTargetCount
            ) {
                selectedPeers.push(result.peer);
            }
        });

        console.log('Peers count:', selectedPeers.length);
    }

    if (selectedPeers.length > 0) {
        if (isTestnet) {
            await settingsStore.updateSettings({
                neutrinoPeersTestnet: selectedPeers,
                dontAllowOtherPeers: selectedPeers.length > 2 ? true : false
            });
        } else {
            await settingsStore.updateSettings({
                neutrinoPeersMainnet: selectedPeers,
                dontAllowOtherPeers: selectedPeers.length > 2 ? true : false
            });
        }

        console.log('Selected the following Neutrino peers:', selectedPeers);
    } else {
        // TODO allow users to manually choose peers if we can't
        // pick good defaults for them
        console.log('Falling back to the default Neutrino peers.');
    }

    return;
}
/**
 * Stops LND, waits for process to fully terminate, then starts fresh.
 * Used when genSeed fails due to "unlocked too quickly" - we need a clean restart.
 */
async function restartLndForWalletCreation(
    lndDir: string,
    isTestnet: boolean
): Promise<void> {
    const { startLnd, decodeState, subscribeState } = lndMobile.index;
    const { unlockWallet } = lndMobile.wallet;

    await stopLnd();
    await sleep(GEN_SEED_STOP_DELAY_MS);

    try {
        await retry({
            fn: async () => {
                await startLnd({
                    args: '',
                    lndDir,
                    isTorEnabled: false,
                    isTestnet
                });
                await waitForLndReady({
                    decodeState,
                    subscribeState,
                    walletPassword: '',
                    unlockWallet
                });
            },
            maxRetries: MAX_START_LND_RETRIES,
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
                    }/${MAX_START_LND_RETRIES})`
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
    channelBackupsBase64
}: {
    lndDir: string;
    seedMnemonic?: string;
    walletPassphrase?: string;
    isTestnet?: boolean;
    channelBackupsBase64?: string;
}) {
    const {
        initialize,
        createIOSApplicationSupportAndLndDirectories,
        excludeLndICloudBackup
    } = lndMobile.index;
    const { genSeed, initWallet } = lndMobile.wallet;

    if (Platform.OS === 'ios') {
        await createIOSApplicationSupportAndLndDirectories(lndDir);
        await excludeLndICloudBackup(lndDir);
    }

    // New wallets always use SQLite
    await writeLndConfig({ lndDir, isTestnet, isSqlite: true });
    await initialize();

    await startLnd({
        lndDir,
        walletPassword: '',
        isTorEnabled: false,
        isTestnet: isTestnet || false
    });

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
    const wallet: any = await initWallet(
        seed.cipher_seed_mnemonic,
        randomBase64,
        isRestore ? 500 : undefined,
        channelBackupsBase64 ? channelBackupsBase64 : undefined,
        walletPassphrase ? walletPassphrase : undefined
    );
    return { wallet, seed, randomBase64 };
}

/**
 * Waits for LND RPC to become ready by polling getInfo
 * @param timeoutMs - Maximum time to wait in milliseconds (default: 30000)
 * @throws Error if RPC doesn't become ready within timeout or encounters a fatal error
 */
export async function waitForRpcReady(timeoutMs = 30000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
        try {
            const info = await lndMobile.index.getInfo();
            log.d(`RPC ready - Node pubkey: ${info.identity_pubkey}`);
            return;
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
