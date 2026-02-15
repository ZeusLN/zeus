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
import { sleep } from './SleepUtils';

import lndMobile from '../lndmobile/LndMobileInjection';
import {
    ELndMobileStatusCodes,
    gossipSync,
    cancelGossipSync,
    checkLndFolderExists
} from '../lndmobile/index';

export const LND_FOLDER_MISSING_ERROR = 'LND_FOLDER_MISSING';

import { settingsStore, syncStore } from '../stores/Stores';
import {
    DEFAULT_NEUTRINO_PEERS_MAINNET,
    SECONDARY_NEUTRINO_PEERS_MAINNET,
    DEFAULT_NEUTRINO_PEERS_TESTNET,
    DEFAULT_FEE_ESTIMATOR,
    DEFAULT_SPEEDLOADER
} from '../stores/SettingsStore';

import { lnrpc } from '../proto/lightning';

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

        // TODO SubscribeState for some reason
        // returns error code "error reading from server: EOF" instead of simply "EOF"
        if (
            errorDesc === 'EOF' ||
            errorDesc === 'error reading from server: EOF' ||
            errorDesc === 'channel event store shutting down'
        ) {
            log.i('Got EOF for stream: ' + name);
            return 'EOF';
        }

        // Ignore transient startup errors (RPC not ready yet)
        if (
            errorDesc.includes('starting up') ||
            errorDesc.includes('not yet ready to accept calls') ||
            errorDesc.includes('not yet ready')
        ) {
            log.d(`Transient startup error for ${name}: ${errorDesc}`);
            return null;
        }

        // Handle closed connection - this is expected when switching nodes or stopping LND
        if (errorDesc === 'closed') {
            log.d('Connection closed (expected during node switch/stop)');
            return null; // Not an error, just connection closed
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
            : ''
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
 * @throws Error if LND fails to stop after max retries or if wallet is locked/closed
 */
export async function stopLnd(maxRetries = 10, delayMs = 500) {
    const { checkStatus, stopLnd } = lndMobile.index;

    try {
        // Check if LND is currently running
        const status = await checkStatus();
        const isRunning =
            (status & ELndMobileStatusCodes.STATUS_PROCESS_STARTED) ===
            ELndMobileStatusCodes.STATUS_PROCESS_STARTED;

        log.d(`LND running status: ${isRunning}`);

        if (!isRunning) {
            log.d('LND is not running, stop not required');
            return;
        }

        // Initiate graceful shutdown
        log.d('Stopping LND...');
        await stopLnd();
        await NativeModules.LndMobileTools.killLnd();

        // Poll until LND process has fully stopped
        for (let i = 0; i < maxRetries; i++) {
            await sleep(delayMs);

            const currentStatus = await checkStatus();
            const stillRunning =
                (currentStatus &
                    ELndMobileStatusCodes.STATUS_PROCESS_STARTED) ===
                ELndMobileStatusCodes.STATUS_PROCESS_STARTED;

            log.d(
                `Stop polling attempt ${
                    i + 1
                }/${maxRetries}, still running: ${stillRunning}`
            );

            if (!stillRunning) {
                log.d('LND stopped successfully');
                return;
            }
        }

        throw new Error(`LND failed to stop after ${maxRetries} attempts`);
    } catch (error) {
        const errorMessage = (error as Error)?.message ?? '';

        // Handle cases where LND is already stopped, starting up, or not initialized
        if (
            errorMessage.includes('wallet locked') ||
            errorMessage.includes('closed') ||
            errorMessage.includes('unable to read TLS cert') ||
            errorMessage.includes('no such file or directory') ||
            errorMessage.includes("doesn't exist") ||
            errorMessage.includes('not yet ready to accept calls') ||
            errorMessage.includes('starting up') ||
            errorMessage.includes('not yet ready') ||
            errorMessage.includes('unitialized') || // Android-specific error
            errorMessage.includes('uninitialized')
        ) {
            log.d(`LND stop skipped (expected state): ${errorMessage}`);
            return;
        }

        // Only log as error if it's a real unexpected error
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
                throw new Error(LND_FOLDER_MISSING_ERROR);
            }
        } catch (error: any) {
            if (
                error?.message === LND_FOLDER_MISSING_ERROR ||
                error?.message?.includes("doesn't exist")
            ) {
                throw new Error(LND_FOLDER_MISSING_ERROR);
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
    startLnd: any;
    lndDir: string;
    isTorEnabled: boolean;
    isTestnet: boolean;
    walletPassword: string;
    unlockWallet: any;
}) {
    try {
        await startLnd({ args: '', lndDir, isTorEnabled, isTestnet });
    } catch (error: any) {
        const errorMessage = error?.message ?? '';

        // Check for folder missing error before retrying
        if (errorMessage.includes("doesn't exist")) {
            throw new Error(LND_FOLDER_MISSING_ERROR);
        }
        if (
            errorMessage.includes('already started') ||
            errorMessage.includes('already running')
        ) {
            log.d(
                'LND already started (likely from wallet creation) - continuing...'
            );
            return;
        }
        log.e('Error starting LND, attempting retry', [error]);

        // Retry loop for handling transient errors
        let started = false;
        while (!started) {
            try {
                // If LND is already running, stop it first
                if (
                    errorMessage.includes('already started') ||
                    errorMessage.includes('already running')
                ) {
                    log.d('LND already running, stopping before restart');
                    await stopLnd();
                }

                await sleep(3000);
                await startLnd({ args: '', lndDir, isTorEnabled, isTestnet });
                started = true;
                log.d('LND started successfully after retry');
            } catch (retryError: any) {
                const retryErrorMessage = retryError?.message ?? '';

                // Stop retrying if folder is missing
                if (retryErrorMessage.includes("doesn't exist")) {
                    throw new Error(LND_FOLDER_MISSING_ERROR);
                }

                // Handle wallet locked state
                if (
                    retryErrorMessage.includes('wallet locked') ||
                    retryErrorMessage.includes('locked')
                ) {
                    log.d('Wallet is locked, attempting to unlock');
                    if (walletPassword) {
                        try {
                            await unlockWallet(walletPassword);
                            log.d('Wallet unlocked successfully');
                        } catch (unlockError: any) {
                            log.e('Error unlocking wallet', [unlockError]);
                        }
                    }
                    break;
                }
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

        const timeout = setTimeout(() => {
            if (!isResolved) {
                isResolved = true;
                cleanup();
                reject(new Error('Timeout waiting for LND to become ready'));
            }
        }, 60000);

        const cleanup = () => {
            if (timeout) clearTimeout(timeout);
            LndMobileEventEmitter.removeAllListeners('SubscribeState');
        };

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
        try {
            seed = await genSeed(undefined);
        } catch (e: any) {
            const errorMessage = e?.message ?? '';
            console.log('error generating seed', errorMessage);
            if (
                errorMessage.includes('wallet already unlocked') ||
                errorMessage.includes(
                    'WalletUnlocker service is no longer available'
                )
            ) {
                throw new Error(
                    'Wallet creation failed: LND unlocked too quickly. Please try again.'
                );
            }
            throw new Error(`Failed to generate seed: ${errorMessage}`);
        }
        if (!seed) {
            throw new Error('Failed to generate seed: no seed returned');
        }
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
            if (errorMessage.includes('closed')) {
                throw new Error('RPC connection closed');
            }
            if (
                errorMessage.includes('starting up') ||
                errorMessage.includes('not yet ready')
            ) {
                await sleep(500);
                continue;
            }

            // Fatal error - stop immediately
            log.e('Fatal error while waiting for RPC', [error]);
            throw error;
        }
    }

    throw new Error(`RPC did not become ready within ${timeoutMs}ms`);
}
