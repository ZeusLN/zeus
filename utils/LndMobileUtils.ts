import {
    DeviceEventEmitter,
    NativeEventEmitter,
    NativeModules,
    Platform
} from 'react-native';

import { generateSecureRandom } from 'react-native-securerandom';
import * as base64 from 'base64-js';
import NetInfo from '@react-native-community/netinfo';

import Log from '../lndmobile/log';
const log = Log('utils/LndMobileUtils.ts');

import { sleep } from '../utils/SleepUtils';

import lndMobile from '../lndmobile/LndMobileInjection';
import { ELndMobileStatusCodes } from '../lndmobile/index';

import stores from '../stores/Stores';

import { lnrpc } from '../proto/lightning';

import { gossipSync } from '../lndmobile/index';

export const LndMobileEventEmitter =
    Platform.OS == 'android'
        ? DeviceEventEmitter
        : new NativeEventEmitter(NativeModules.LndMobile);

export const LndMobileToolsEventEmitter =
    Platform.OS == 'android'
        ? DeviceEventEmitter
        : new NativeEventEmitter(NativeModules.LndMobileTools);

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

const writeLndConfig = async (isTestnet?: boolean) => {
    const { writeConfig } = lndMobile.index;

    // TODO move off of Blixt neutrino servers
    const config = `[Application Options]
    debuglevel=info
    maxbackoff=2s
    sync-freelist=1
    accept-keysend=1
    tlsdisableautofill=1
    maxpendingchannels=1000
    
    [db]
    db.no-graph-cache=false
    
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
    neutrino.connect=${
        isTestnet ? 'testnet.blixtwallet.com' : 'node.blixtwallet.com'
    }
    neutrino.feeurl=https://nodes.lightning.computer/fees/v1/btc-fee-estimates.json
    neutrino.broadcasttimeout=11s
    neutrino.persistfilters=true
    
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
    
    [routerrpc]
    routerrpc.estimator=apriori`;

    await writeConfig(config);
    return;
};

export async function expressGraphSync() {
    if (stores.settingsStore?.settings?.resetExpressGraphSyncOnStartup) {
        log.d('Clearing speedloader files');
        try {
            // TODO(hsjoberg): LndMobileTools should be injected
            await NativeModules.LndMobileTools.DEBUG_deleteSpeedloaderLastrunFile();
            await NativeModules.LndMobileTools.DEBUG_deleteSpeedloaderDgraphDirectory();
        } catch (error) {
            log.e('Gossip files deletion failed', [error]);
        }
    }
    if (stores.settingsStore.embeddedLndNetwork === 'Mainnet') {
        stores.syncStore.setExpressGraphSyncStatus(true);
        // check connection type and whether user has allowed EGS on mobile
        const connectionState = stores.settingsStore?.settings
            ?.expressGraphSyncMobile
            ? { type: 'wifi' }
            : await NetInfo.fetch();
        console.log('~~starting gossip', connectionState.type);
        const gossipStatus = await gossipSync(connectionState.type);
        console.log('~~gossipStatus', gossipStatus);
        stores.syncStore.setExpressGraphSyncStatus(false);
    }
    return;
}

export async function initializeLnd(isTestnet?: boolean) {
    const { initialize } = lndMobile.index;

    await writeLndConfig(isTestnet);
    await initialize();
}

export async function startLnd(walletPassword: string) {
    const { checkStatus, startLnd, decodeState, subscribeState } =
        lndMobile.index;
    const { unlockWallet } = lndMobile.wallet;

    const status = await checkStatus();
    if (
        (status & ELndMobileStatusCodes.STATUS_PROCESS_STARTED) !==
        ELndMobileStatusCodes.STATUS_PROCESS_STARTED
    ) {
        await startLnd('');
    }

    await new Promise(async (res) => {
        LndMobileEventEmitter.addListener('SubscribeState', async (e: any) => {
            try {
                log.d('SubscribeState', [e]);
                const error = checkLndStreamErrorResponse('SubscribeState', e);
                if (error === 'EOF') {
                    return;
                } else if (error) {
                    throw error;
                }

                const state = decodeState(e.data ?? '');
                log.i('Current lnd state', [state]);
                if (state.state === lnrpc.WalletState.NON_EXISTING) {
                    log.d('Got lnrpc.WalletState.NON_EXISTING');
                } else if (state.state === lnrpc.WalletState.LOCKED) {
                    log.d('Got lnrpc.WalletState.LOCKED');
                    log.d('Wallet locked, unlocking wallet');
                    await unlockWallet(walletPassword);
                } else if (state.state === lnrpc.WalletState.UNLOCKED) {
                    log.d('Got lnrpc.WalletState.UNLOCKED');
                } else if (state.state === lnrpc.WalletState.RPC_ACTIVE) {
                    log.d('Got lnrpc.WalletState.RPC_ACTIVE');
                    stores.syncStore.startSyncing();
                    res(true);
                } else if (state.state === lnrpc.WalletState.SERVER_ACTIVE) {
                    log.d('Got lnrpc.WalletState.SERVER_ACTIVE');
                    stores.syncStore.startSyncing();
                    res(true);
                } else {
                    log.d('Got unknown lnrpc.WalletState', [state.state]);
                }
            } catch (error: any) {
                console.log('err', error.message);
            }
        });
        await subscribeState();
    });
}

export async function createLndWallet(
    seedMnemonic?: string,
    walletPassphrase?: string,
    isTestnet?: boolean
) {
    const {
        initialize,
        startLnd,
        createIOSApplicationSupportAndLndDirectories,
        excludeLndICloudBackup,
        checkStatus
    } = lndMobile.index;
    const { genSeed, initWallet } = lndMobile.wallet;

    if (Platform.OS === 'ios') {
        await createIOSApplicationSupportAndLndDirectories();
        await excludeLndICloudBackup();
    }

    await writeLndConfig(isTestnet);
    await initialize();

    const status = await checkStatus();
    if (
        (status & ELndMobileStatusCodes.STATUS_PROCESS_STARTED) !==
        ELndMobileStatusCodes.STATUS_PROCESS_STARTED
    ) {
        await startLnd('');
    }
    sleep(2000);

    let seed: any;
    if (!seedMnemonic) {
        seed = await genSeed(undefined);
        if (!seed) return;
    } else {
        seed = {
            cipher_seed_mnemonic: seedMnemonic?.split(' ')
        };
    }

    const random = await generateSecureRandom(32);
    const randomBase64 = base64.fromByteArray(random);

    const isRestore = walletPassphrase || seedMnemonic;
    const wallet: any = await initWallet(
        seed.cipher_seed_mnemonic,
        randomBase64,
        !!isRestore ? 100 : undefined,
        undefined, // TODO add channels backup restore
        walletPassphrase ? walletPassphrase : undefined
    );
    return { wallet, seed, randomBase64 };
}
