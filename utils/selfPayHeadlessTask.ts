import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
    startLdkNodeWallet,
    stopLdkNode,
    waitForLdkNodeReady,
    DEFAULT_SCORER_URL,
    DEFAULT_VSS_SERVER,
    SupportedNetwork
} from './LdkNodeUtils';
import { sleep } from './SleepUtils';
import {
    fulfillInvoiceRequest,
    isSelfInvoiceRequestPayload
} from './SelfPayUtils';

const PERSISTENT_LDK_KEY = 'persistentLdkNodeServicesEnabled';

// After answering, keep the process alive briefly so the settlement watcher
// can observe the payment landing and report it with preimage proof. The
// native task timeout (SelfPayHeadlessService) bounds the total run.
const SETTLEMENT_WAIT_MS = 30000;

// Android killed-state entry point for ZEUS Pay 'self' invoice requests:
// ZeusFcmService -> SelfPayHeadlessService -> this task. Runs in the app's
// JS runtime (reused when the app is alive, freshly booted otherwise) so the
// encrypted settings blob and node lifecycle code are the same ones the full
// app uses.
export default async function selfPayHeadlessTask(data: any): Promise<void> {
    try {
        if (!isSelfInvoiceRequestPayload(data)) return;

        // Lazy require: this module is loaded from index.js before the app
        // component, so keep store construction out of import time
        const Stores = require('../stores/Stores');
        const { settingsStore, nodeInfoStore } = Stores;

        if (
            !settingsStore.settings ||
            Object.keys(settingsStore.settings).length === 0
        ) {
            await settingsStore.getSettings();
        }

        if (settingsStore.implementation !== 'ldk-node') return;
        if (!settingsStore.settings?.lightningAddress?.enabled) return;

        // Probe whether the node is already running (persistent service, or
        // the full app is alive and connected)
        let nodeRunning = true;
        try {
            await waitForLdkNodeReady(2000);
        } catch {
            nodeRunning = false;
        }

        let startedHere = false;
        if (!nodeRunning) {
            const {
                ldkNodeDir,
                ldkMnemonic,
                ldkPassphrase,
                ldkNetwork,
                ldkEsploraServer,
                ldkRgsServer,
                ldkScorerUrl,
                ldkVssServer,
                settings
            } = settingsStore;

            if (!ldkMnemonic || !ldkNodeDir) {
                console.log('SelfPay headless: missing LDK config');
                return;
            }

            const {
                getLspConfigForNetwork
            } = require('../stores/SettingsStore');
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

            console.log('SelfPay headless: starting LDK node');
            await startLdkNodeWallet({
                nodeDir: ldkNodeDir,
                seedMnemonic: ldkMnemonic,
                passphrase: ldkPassphrase,
                network: (ldkNetwork || 'mainnet') as SupportedNetwork,
                esploraServerUrl: ldkEsploraServer,
                rgsServerUrl: ldkRgsServer,
                scorerUrl:
                    ldkScorerUrl === undefined
                        ? DEFAULT_SCORER_URL
                        : ldkScorerUrl,
                lsps1Config,
                trustedPeers0conf: trustedPeers,
                vssServerUrl: ldkVssServer || DEFAULT_VSS_SERVER
            });
            startedHere = true;
        }

        await waitForLdkNodeReady(20000);

        // The ZEUS Pay auth handshake signs with the node key and sends the
        // identity pubkey, which a fresh headless context hasn't fetched yet
        if (!nodeInfoStore.nodeInfo?.identity_pubkey) {
            try {
                await nodeInfoStore.getNodeInfo();
            } catch (e) {
                console.log('SelfPay headless: getNodeInfo failed', e);
            }
        }

        await fulfillInvoiceRequest(data);

        await sleep(SETTLEMENT_WAIT_MS);

        if (startedHere) {
            // If the user opened the app meanwhile, Wallet.tsx owns the node
            // lifecycle now — don't stop it out from under the UI
            const appActive = AppState.currentState === 'active';
            const persistent = await AsyncStorage.getItem(PERSISTENT_LDK_KEY);
            if (!appActive && persistent !== 'true') {
                console.log('SelfPay headless: stopping LDK node');
                await stopLdkNode();
            }
        }
    } catch (e) {
        console.log('SelfPay headless: task error', e);
    }
}
