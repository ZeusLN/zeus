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
        // TODO SubscribeState for some reason
        // returns error code "error reading from server: EOF" instead of simply "EOF"
        if (
            event.error_desc === 'EOF' ||
            event.error_desc === 'error reading from server: EOF' ||
            event.error_desc === 'channel event store shutting down'
        ) {
            log.i('Got EOF for stream: ' + name);
            return 'EOF';
        } else if (event.error_desc === 'closed') {
            log.i('checkLndStreamErrorResponse: Got closed error');
        }
        return new Error(event.error_desc);
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

export async function stopLnd(maxRetries = 10, delayMs = 500) {
    const { checkStatus, stopLnd } = lndMobile.index;

    try {
        const status = await checkStatus();
        const isRunning =
            (status & ELndMobileStatusCodes.STATUS_PROCESS_STARTED) ===
            ELndMobileStatusCodes.STATUS_PROCESS_STARTED;

        console.log('isRunning', isRunning);

        if (!isRunning) {
            console.log('LND is not running');
            return;
        }

        // Stop LND
        await stopLnd();
        await NativeModules.LndMobileTools.killLnd();

        // Poll until status becomes false
        for (let i = 0; i < maxRetries; i++) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));

            const currentStatus = await checkStatus();
            const stillRunning =
                (currentStatus &
                    ELndMobileStatusCodes.STATUS_PROCESS_STARTED) ===
                ELndMobileStatusCodes.STATUS_PROCESS_STARTED;

            console.log(
                `Polling attempt ${i + 1}/${maxRetries}, isRunning:`,
                stillRunning
            );

            if (!stillRunning) {
                console.log('LND stopped successfully');
                return;
            }
        }

        throw new Error(`LND failed to stop after ${maxRetries} attempts`);
    } catch (e) {
        console.log('error stopping LND', e);
        console.log((e as Error)?.message);
        const msg = (e as Error)?.message ?? '';
        if (msg.includes('wallet locked') || msg.includes('closed')) {
            console.log('LND wallet locked/Closed — stop not required');
            return;
        }
        throw e;
    }
}

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
                console.log(
                    'LND folder does not exist but wallet config exists - likely app was reinstalled'
                );
                throw new Error(LND_FOLDER_MISSING_ERROR);
            }
        } catch (e: any) {
            if (
                e?.message === LND_FOLDER_MISSING_ERROR ||
                e?.message?.includes("doesn't exist")
            ) {
                throw new Error(LND_FOLDER_MISSING_ERROR);
            }
            // Other errors during check - continue and let startLnd handle it
            console.log('Error checking LND folder:', e);
        }
    }

    // don't mark as started on wallet creation, only on proper start-up
    if (walletPassword) settingsStore.embeddedLndStarted = true;

    try {
        await startLnd({ args: '', lndDir, isTorEnabled, isTestnet });
    } catch (e: any) {
        const err_msg = e?.message;
        // Check for folder missing error before retrying
        if (err_msg.includes("doesn't exist")) {
            throw new Error(LND_FOLDER_MISSING_ERROR);
        }
        let started;
        while (!started) {
            try {
                console.log('error starting LND - retrying momentarily', e);
                if (
                    err_msg.includes('already started') ||
                    err_msg.includes('already running') ||
                    err_msg.includes('closed')
                ) {
                    await stopLnd();
                }
                await sleep(3000);
                await startLnd({
                    args: '',
                    lndDir,
                    isTorEnabled,
                    isTestnet
                });
                started = true;
            } catch (e2: any) {
                const e2_msg = e2?.message ?? '';
                // Stop retrying if folder is missing
                if (e2_msg.includes("doesn't exist")) {
                    throw new Error(LND_FOLDER_MISSING_ERROR);
                }
                if (
                    e2_msg.includes('wallet locked') ||
                    e2_msg.includes('closed')
                ) {
                    console.log(
                        'Stop failed but LND is already stopped, continuing...'
                    );
                    continue; // Retry the start
                }
            }
        }
    }
    // Add a small delay to ensure subscribeState is ready
    await sleep(500);

    await new Promise(async (res, rej) => {
        let isResolved = false;
        let unlockAttempted = false;
        const timeout = setTimeout(() => {
            if (!isResolved) {
                isResolved = true;
                LndMobileEventEmitter.removeAllListeners('SubscribeState');
                rej(new Error('Timeout waiting for LND to become ready'));
            }
        }, 60000);
        const cleanup = () => {
            if (timeout) clearTimeout(timeout);
            LndMobileEventEmitter.removeAllListeners('SubscribeState');
        };

        const stateHandler = async (e: any) => {
            if (isResolved) return;
            try {
                log.d('SubscribeState', [e]);
                const error = checkLndStreamErrorResponse('SubscribeState', e);

                if (error === 'EOF') {
                    return;
                } else if (error) {
                    isResolved = true;
                    cleanup();
                    rej(error);
                    return;
                }

                const state = decodeState(e.data ?? '');
                console.log('Current lnd state', state.state);
                log.d('Current lnd state');

                if (state.state === lnrpc.WalletState.NON_EXISTING) {
                    log.d('Got lnrpc.WalletState.NON_EXISTING');
                    isResolved = true;
                    cleanup();
                    // Add delay before resolving
                    await sleep(500);
                    res(true);
                } else if (state.state === lnrpc.WalletState.LOCKED) {
                    log.d('Got lnrpc.WalletState.LOCKED');
                    if (!unlockAttempted && walletPassword) {
                        unlockAttempted = true;
                        log.d('Wallet locked, unlocking wallet');
                        try {
                            await unlockWallet(walletPassword);
                            log.d('Wallet unlocked successfully');
                        } catch (unlockError: any) {
                            console.log(
                                'Error unlocking wallet:',
                                unlockError.message
                            );
                            isResolved = true;
                            cleanup();
                            rej(unlockError);
                        }
                    }
                } else if (state.state === lnrpc.WalletState.UNLOCKED) {
                    console.log('Got lnrpc.WalletState.UNLOCKED');
                    log.d('Got lnrpc.WalletState.UNLOCKED');
                    // Don't resolve - wait for RPC_ACTIVE or SERVER_ACTIVE
                } else if (state.state === lnrpc.WalletState.RPC_ACTIVE) {
                    console.log('Got lnrpc.WalletState.RPC_ACTIVE');
                    log.d('Got lnrpc.WalletState.RPC_ACTIVE');
                    try {
                        await waitForRpcReady();
                        syncStore.startSyncing();
                        if (settingsStore?.settings?.rescan) {
                            syncStore.startRescanTracking(0);
                        }
                        isResolved = true;
                        cleanup();
                        res(true);
                    } catch (rpcError: any) {
                        console.log(
                            'RPC ready check failed:',
                            rpcError.message
                        );
                        isResolved = true;
                        cleanup();
                        rej(rpcError);
                    }
                } else if (state.state === lnrpc.WalletState.SERVER_ACTIVE) {
                    log.d('Got lnrpc.WalletState.SERVER_ACTIVE');
                    isResolved = true;
                    cleanup();
                    res(true);
                } else {
                    log.d('Got unknown lnrpc.WalletState', [state.state]);
                }
            } catch (error: any) {
                console.log('SubscribeState error:', error.message);
                if (!isResolved) {
                    isResolved = true;
                    cleanup();
                    rej(error);
                }
            }
        };
        LndMobileEventEmitter.addListener('SubscribeState', stateHandler);
        // Give the listener time to fully register
        await sleep(100);
        try {
            console.log('Starting subscribeState...');
            await subscribeState();
            console.log('subscribeState started successfully');
        } catch (error) {
            if (!isResolved) {
                isResolved = true;
                cleanup();
                rej(error);
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
        } catch (e) {
            console.log('error generating seed', e);
        }
        if (!seed) {
            return;
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

export async function waitForRpcReady(timeoutMs = 30000) {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
        try {
            const info = await lndMobile.index.getInfo();
            console.log('RPC ready:', info.identity_pubkey);
            return;
        } catch (e: any) {
            console.log('RPC not ready yet:', e?.message);

            if (
                e?.message?.includes('starting up') ||
                e?.message?.includes('not yet ready')
            ) {
                await sleep(500);
                continue;
            }

            // real error → stop immediately
            throw e;
        }
    }

    throw new Error('RPC never became ready');
}
