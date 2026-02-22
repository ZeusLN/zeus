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

/**
 * LND error codes - use for consistent error handling across the app
 */
export enum LndErrorCode {
    /** LND data folder does not exist */
    LND_FOLDER_MISSING = 'LND_FOLDER_MISSING',
    /** LND unlocked too quickly during wallet creation */
    WALLET_CREATION_UNLOCKED_TOO_QUICKLY = 'WALLET_CREATION_UNLOCKED_TOO_QUICKLY',
    /** RPC connection was closed */
    RPC_CONNECTION_CLOSED = 'RPC_CONNECTION_CLOSED',
    /** RPC did not become ready within timeout */
    RPC_READY_TIMEOUT = 'RPC_READY_TIMEOUT',
    /** LND failed to stop after max retries */
    LND_FAILED_TO_STOP = 'LND_FAILED_TO_STOP',
    /** LND failed to start after max retries */
    LND_START_FAILED = 'LND_START_FAILED',
    /** Failed to generate seed */
    GEN_SEED_FAILED = 'GEN_SEED_FAILED',
    /** Timeout waiting for LND to become ready */
    LND_READY_TIMEOUT = 'LND_READY_TIMEOUT',
    /** LND is already running (informational) */
    LND_ALREADY_RUNNING = 'LND_ALREADY_RUNNING',
    /** Wallet is locked - unlock required */
    WALLET_LOCKED = 'WALLET_LOCKED',
    /** Macaroon store is locked */
    MACAROON_STORE_LOCKED = 'MACAROON_STORE_LOCKED',
    /** Wallet/Unlocker already unlocked (genSeed race) */
    GEN_SEED_UNLOCKED = 'GEN_SEED_UNLOCKED',
    /** RPC not ready yet (transient) */
    RPC_NOT_READY = 'RPC_NOT_READY',
    /** Expected state when stopping LND  */
    STOP_LND_EXPECTED = 'STOP_LND_EXPECTED',
    /** Invalid response from LND stream */
    STREAM_INVALID_RESPONSE = 'STREAM_INVALID_RESPONSE',
    /** Stream ended normally (EOF) - not an error */
    STREAM_EOF = 'STREAM_EOF'
}

/**  messages for display in UI */
export const LND_ERROR_MESSAGES: Record<LndErrorCode, string> = {
    [LndErrorCode.LND_FOLDER_MISSING]:
        'LND wallet folder not found. The wallet may have been deleted.',
    [LndErrorCode.WALLET_CREATION_UNLOCKED_TOO_QUICKLY]:
        'Wallet creation failed: LND unlocked too quickly. Please try again.',
    [LndErrorCode.RPC_CONNECTION_CLOSED]: 'RPC connection closed.',
    [LndErrorCode.RPC_READY_TIMEOUT]:
        'RPC did not become ready in time. Please try again.',
    [LndErrorCode.LND_FAILED_TO_STOP]:
        'LND failed to stop. Please restart the app.',
    [LndErrorCode.LND_START_FAILED]:
        'LND failed to start. Please restart the app.',
    [LndErrorCode.GEN_SEED_FAILED]: 'Failed to generate wallet seed.',
    [LndErrorCode.LND_READY_TIMEOUT]:
        'LND did not become ready in time. Please try again.',
    [LndErrorCode.LND_ALREADY_RUNNING]: 'LND is already running.',
    [LndErrorCode.WALLET_LOCKED]: 'Wallet is locked. Unlock required.',
    [LndErrorCode.MACAROON_STORE_LOCKED]:
        'Macaroon store is locked. Please try again.',
    [LndErrorCode.GEN_SEED_UNLOCKED]:
        'Wallet already unlocked. Please try wallet creation again.',
    [LndErrorCode.RPC_NOT_READY]: 'RPC not ready yet. Please wait.',
    [LndErrorCode.STOP_LND_EXPECTED]: 'LND stopped (expected state).',
    [LndErrorCode.STREAM_INVALID_RESPONSE]:
        'Invalid response from LND. Please try again.',
    [LndErrorCode.STREAM_EOF]: 'Stream ended (expected).'
};

/** Raw message patterns that map to each error code (for matching native/stream errors) */
export const LND_ERROR_PATTERNS: Record<LndErrorCode, readonly string[]> = {
    [LndErrorCode.LND_FOLDER_MISSING]: [
        "doesn't exist",
        'does not exist',
        'no such file or directory',
        'wallet directory not found',
        'wallet may have been deleted'
    ],
    [LndErrorCode.WALLET_CREATION_UNLOCKED_TOO_QUICKLY]: [],
    [LndErrorCode.RPC_CONNECTION_CLOSED]: ['closed', 'connection closed'],
    [LndErrorCode.RPC_READY_TIMEOUT]: [],
    [LndErrorCode.LND_FAILED_TO_STOP]: [],
    [LndErrorCode.LND_START_FAILED]: [],
    [LndErrorCode.GEN_SEED_FAILED]: [],
    [LndErrorCode.LND_READY_TIMEOUT]: [],
    [LndErrorCode.LND_ALREADY_RUNNING]: ['already started', 'already running'],
    [LndErrorCode.WALLET_LOCKED]: ['wallet locked'],
    [LndErrorCode.MACAROON_STORE_LOCKED]: [
        'macaroon store is locked',
        'cannot retrieve macaroon',
        'cannot get macaroon'
    ],
    [LndErrorCode.GEN_SEED_UNLOCKED]: [
        'wallet already unlocked',
        'WalletUnlocker service is no longer available'
    ],
    [LndErrorCode.RPC_NOT_READY]: [
        'starting up',
        'not yet ready to accept calls',
        'not yet ready',
        'unitialized',
        'uninitialized'
    ],
    [LndErrorCode.STOP_LND_EXPECTED]: [
        'unable to read TLS cert',
        'connection refused',
        'connection reset'
    ],
    [LndErrorCode.STREAM_INVALID_RESPONSE]: [],
    [LndErrorCode.STREAM_EOF]: [
        'EOF',
        'error reading from server: EOF',
        'channel event store shutting down'
    ]
};

/** Match a raw error message to an LndErrorCode (returns first match) */
export function matchRawErrorToCode(msg: string): LndErrorCode | null {
    const normalized = msg.toLowerCase();
    for (const [code, patterns] of Object.entries(LND_ERROR_PATTERNS)) {
        if (
            patterns.length > 0 &&
            patterns.some((p) => normalized.includes(p.toLowerCase()))
        ) {
            return code as LndErrorCode;
        }
    }
    return null;
}

/** Check if message matches a specific error code */
export function matchesLndErrorCode(msg: string, code: LndErrorCode): boolean {
    const patterns = LND_ERROR_PATTERNS[code];
    if (!patterns.length) return false;
    const normalized = msg.toLowerCase();
    return patterns.some((p) => normalized.includes(p.toLowerCase()));
}

/** Codes that indicate expected state when stopping LND  */
const STOP_LND_EXPECTED_CODES: LndErrorCode[] = [
    LndErrorCode.STOP_LND_EXPECTED,
    LndErrorCode.WALLET_LOCKED,
    LndErrorCode.RPC_CONNECTION_CLOSED,
    LndErrorCode.LND_FOLDER_MISSING,
    LndErrorCode.RPC_NOT_READY
];

/** Check if error is expected when stopping LND  */
export function isStopLndExpectedError(msg: string): boolean {
    return STOP_LND_EXPECTED_CODES.some((code) =>
        matchesLndErrorCode(msg, code)
    );
}

/** Transient RPC errors that may resolve with retry (node switch, startup, etc.) */
const TRANSIENT_RPC_ERROR_CODES: LndErrorCode[] = [
    LndErrorCode.RPC_CONNECTION_CLOSED,
    LndErrorCode.RPC_NOT_READY,
    LndErrorCode.MACAROON_STORE_LOCKED
];

/** Check if error message is a transient RPC error (retryable) */
export function isTransientRpcError(msg: string): boolean {
    return TRANSIENT_RPC_ERROR_CODES.some((code) =>
        matchesLndErrorCode(msg, code)
    );
}

export function getLndErrorMessage(error: unknown): string {
    if (isLndError(error)) {
        const code = (error as { code?: LndErrorCode })?.code;
        if (code && LND_ERROR_MESSAGES[code]) {
            return LND_ERROR_MESSAGES[code];
        }
    }
    return error instanceof Error ? error.message : String(error ?? '');
}

export function createLndError(code: LndErrorCode, detail?: string): Error {
    const baseMessage = LND_ERROR_MESSAGES[code];
    const message = detail ? `${baseMessage} ${detail}`.trim() : baseMessage;
    const err = new Error(message) as Error & { code: LndErrorCode };
    err.code = code;
    return err;
}

export function isLndError(error: unknown, code?: LndErrorCode): boolean {
    const msg = error instanceof Error ? error.message : String(error ?? '');
    const errCode = (error as { code?: LndErrorCode })?.code;
    if (code) {
        return errCode === code || msg.includes(code);
    }
    return Object.values(LndErrorCode).some((c) => msg.includes(c));
}

/** Android needs longer delays - process cleanup is slower */

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

export async function deleteLndWallet(lndDir: string, skipStopLnd = false) {
    log.d('Attempting to delete Embedded LND wallet');
    try {
        if (!skipStopLnd) {
            await stopLnd();
        }
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

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    if (error && typeof error === 'object' && 'message' in error) {
        return String((error as { message: unknown }).message);
    }
    return String(error);
}

/**
 * Stops the LND process gracefully with retry mechanism
 * @param maxRetries - Maximum number of polling attempts to verify shutdown (default: 10)
 * @param delayMs - Delay between polling attempts in milliseconds (default: 500)
 * @throws Error if LND fails to stop after max retries (unexpected errors only)
 */
export async function stopLnd(maxRetries = 10, delayMs = 500) {
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
        // Check if LND is currently running
        const status = await runWithExpectedErrorHandling(
            () => checkStatus(),
            'checkStatus'
        );

        if (status === null) {
            log.d('LND status check returned expected error - already stopped');
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
                await sleep(delayMs);
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
            delayMs: 0,
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
    await sleep(500);
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
            log.d(
                'LND already started (likely from wallet creation) - continuing...'
            );
            return;
        }

        log.e('Error starting LND, attempting retry', [error]);
        await retryStartLnd({
            startLnd,
            startArgs,
            walletPassword,
            unlockWallet
        });
    }
}

const MAX_START_LND_RETRIES = 10;

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
            await sleep(3000);
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

            log.e(`Retry attempt ${attempt}/${MAX_START_LND_RETRIES} failed`, [
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
}) {
    return new Promise(async (resolve, reject) => {
        let isResolved = false;
        let unlockAttempted = false;

        const stateHandler = async (event: any) => {
            if (isResolved) return;

            try {
                log.d('SubscribeState event received', [event]);

                const error = checkLndStreamErrorResponse(
                    'SubscribeState',
                    event
                );
                if (error === 'EOF') {
                    return;
                } else if (error) {
                    isResolved = true;
                    cleanup();
                    reject(error);
                    return;
                }

                // Skip decode when connection closed or no data (avoids uncaught errors)
                if (event?.error_code && !event?.data) {
                    log.d(
                        'SubscribeState: connection closed or no data, skipping'
                    );
                    return;
                }

                const state = decodeState(event.data ?? '');
                log.d(`Current LND state: ${state.state}`);

                switch (state.state) {
                    case lnrpc.WalletState.NON_EXISTING:
                        log.d('Wallet does not exist - ready for creation');
                        isResolved = true;
                        cleanup();
                        await sleep(500);
                        resolve(true);
                        break;

                    case lnrpc.WalletState.LOCKED:
                        log.d('Wallet is locked');
                        if (!unlockAttempted && walletPassword) {
                            unlockAttempted = true;
                            try {
                                await unlockWallet(walletPassword);
                                log.d('Wallet unlocked successfully');
                            } catch (unlockError: any) {
                                log.e('Error unlocking wallet', [unlockError]);
                                isResolved = true;
                                cleanup();
                                reject(unlockError);
                                return;
                            }
                        }
                        break;

                    case lnrpc.WalletState.UNLOCKED:
                        log.d(
                            'Wallet unlocked - waiting for RPC to become active'
                        );
                        // Don't resolve - wait for RPC_ACTIVE or SERVER_ACTIVE
                        break;

                    case lnrpc.WalletState.RPC_ACTIVE:
                        log.d('RPC is active - waiting for RPC ready');
                        try {
                            await waitForRpcReady();
                            syncStore.startSyncing();
                            if (settingsStore?.settings?.rescan) {
                                syncStore.startRescanTracking(0);
                            }
                            isResolved = true;
                            cleanup();
                            resolve(true);
                        } catch (rpcError: any) {
                            log.e('RPC ready check failed', [rpcError]);
                            isResolved = true;
                            cleanup();
                            reject(rpcError);
                            return;
                        }
                        break;

                    case lnrpc.WalletState.SERVER_ACTIVE:
                        log.d('Server is active');
                        isResolved = true;
                        cleanup();
                        resolve(true);
                        break;

                    default:
                        log.d('Unknown wallet state', [state.state]);
                        break;
                }
            } catch (error: any) {
                log.e('SubscribeState handler error', [error]);
                if (!isResolved) {
                    isResolved = true;
                    cleanup();
                    reject(error);
                }
            }
        };

        const cleanup = () => {
            if (timeout) clearTimeout(timeout);
            LndMobileEventEmitter.removeAllListeners('SubscribeState');
        };

        const timeout = setTimeout(() => {
            if (!isResolved) {
                isResolved = true;
                cleanup();
                reject(createLndError(LndErrorCode.LND_READY_TIMEOUT));
            }
        }, 60000);

        LndMobileEventEmitter.addListener('SubscribeState', stateHandler);

        // Give the listener time to fully register
        await sleep(100);

        try {
            log.d('Starting state subscription');
            await subscribeState();
            log.d('State subscription started successfully');
        } catch (error) {
            if (!isResolved) {
                isResolved = true;
                cleanup();
                reject(error);
            }
        }
    });
}

export async function optimizeNeutrinoPeers(
    isTestnet?: boolean,
    peerTargetCount: number = 3
) {
    console.log('Optimizing Neutrino peers');
    let peers = isTestnet
        ? DEFAULT_NEUTRINO_PEERS_TESTNET
        : DEFAULT_NEUTRINO_PEERS_MAINNET;

    const results: any = [];
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

/** Delay between stopping LND and starting it again */
const GEN_SEED_STOP_DELAY_MS = Platform.OS === 'android' ? 3500 : 2000;

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
        maxRetries: 5,
        delayMs: 0,
        shouldRetry: (e) =>
            matchesLndErrorCode(
                getErrorMessage(e),
                LndErrorCode.GEN_SEED_UNLOCKED
            ),
        onRetry: async () => {
            log.d(
                'LND unlocked too quickly - stopping and retrying wallet creation'
            );
            await stopLnd();
            await sleep(GEN_SEED_STOP_DELAY_MS);
            await startLnd({
                lndDir,
                walletPassword: '',
                isTorEnabled: false,
                isTestnet
            });
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
    console.log('creating new LND');
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
