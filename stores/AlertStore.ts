import { action, computed, observable } from 'mobx';

import SettingsStore from './SettingsStore';
import { localeString } from '../utils/LocaleUtils';

import { NEUTRINO_PING_THRESHOLD_MS, pingPeer } from '../utils/LndMobileUtils';

interface Peer {
    peer: string;
    ms: string | number;
}

export interface MempoolError {
    host: string;
    message: string;
}

export default class AlertStore {
    @observable public neutrinoPeerError: boolean = false;
    @observable public problematicNeutrinoPeers: Array<Peer> = [];
    @observable public vssError: string | null = null;
    @observable public esploraError: string | null = null;
    @observable public rgsError: string | null = null;
    @observable public mempoolError: MempoolError | null = null;
    settingsStore: SettingsStore;

    constructor(settingsStore: SettingsStore) {
        this.settingsStore = settingsStore;
    }

    @computed
    get hasError(): boolean {
        return Boolean(
            this.vssError ||
                this.esploraError ||
                this.rgsError ||
                this.neutrinoPeerError ||
                this.mempoolError
        );
    }

    @action
    public reset = () => {
        this.neutrinoPeerError = false;
        this.problematicNeutrinoPeers = [];
        this.vssError = null;
        this.esploraError = null;
        this.rgsError = null;
        this.mempoolError = null;
    };

    @action
    public setVssError = (error: string) => {
        this.vssError = error;
    };

    @action
    public setEsploraError = (error: string) => {
        this.esploraError = error;
    };

    @action
    public setRgsError = (error: string) => {
        this.rgsError = error;
    };

    @action
    public setMempoolError = (host: string, message: string) => {
        this.mempoolError = { host, message };
    };

    /**
     * Derive the host from the URL that was actually fetched, so SyncStore
     * (which builds its own URL from settings and can be on Testnet) names
     * the correct server. Never read nodeInfoStore.nodeInfo here — that
     * would report the wrong instance during initial sync.
     */
    @action
    public setMempoolErrorFromUrl = (url: string, message: string) => {
        let host: string;
        try {
            host = new URL(url).host;
        } catch {
            host = url;
        }
        this.setMempoolError(host, message);
    };

    @action
    public clearMempoolError = () => {
        this.mempoolError = null;
    };

    @action
    public checkNeutrinoPeers = async () => {
        // Pinging every peer can outlast a wallet switch, and nothing awaits
        // this, so the result must not land on the next wallet's alerts
        const isCurrent = this.settingsStore.getConnectionGuard();
        const peers =
            this.settingsStore.embeddedLndNetwork === 'Testnet'
                ? this.settingsStore.settings.neutrinoPeersTestnet
                : this.settingsStore.settings.neutrinoPeersMainnet;

        const results: any = [];
        for (let i = 0; i < peers.length; i++) {
            const peer = peers[i];
            await new Promise(async (resolve) => {
                try {
                    const result = await pingPeer(peer);
                    console.log(`# ${peer} - ${result.ms}`);
                    results.push({
                        peer,
                        ms: result.reachable
                            ? result.ms
                            : localeString(
                                  'views.Settings.EmbeddedNode.NeutrinoPeers.unreachable'
                              )
                    });
                    resolve(true);
                } catch (e) {
                    console.log('e', e);
                    results.push({
                        peer,
                        ms: localeString(
                            'views.Settings.EmbeddedNode.NeutrinoPeers.timedOut'
                        )
                    });
                    resolve(true);
                }
            });
        }

        const filteredResults = results.filter((result: any) => {
            return (
                result.ms ===
                    localeString(
                        'views.Settings.EmbeddedNode.NeutrinoPeers.timedOut'
                    ) ||
                (Number.isInteger(result.ms) &&
                    result.ms > NEUTRINO_PING_THRESHOLD_MS)
            );
        });

        if (!isCurrent()) return;
        this.problematicNeutrinoPeers = filteredResults;
        // Field only. hasError is now a computed getter.
        if (this.problematicNeutrinoPeers.length > 0) {
            this.neutrinoPeerError = true;
        }
    };
}
