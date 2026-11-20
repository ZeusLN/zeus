import { action, computed, observable } from 'mobx';

import SettingsStore from './SettingsStore';
import { localeString } from '../utils/LocaleUtils';

import {
    NeutrinoProbeRecord,
    bitcoinP2pPort,
    isWeakNeutrinoProbeOutcome,
    probeNeutrinoPeerList,
    waitForNeutrinoPeers
} from '../utils/NeutrinoPeersUtils';

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
    public setNeutrinoPeerAlertsFromProbes = (
        probes: NeutrinoProbeRecord[]
    ) => {
        this.problematicNeutrinoPeers = probes
            .filter((probe) => isWeakNeutrinoProbeOutcome(probe.ms))
            .map((probe) => ({
                peer: probe.peer,
                ms:
                    typeof probe.ms === 'number'
                        ? probe.ms
                        : probe.ms === 'Timed out'
                        ? localeString(
                              'views.Settings.EmbeddedNode.NeutrinoPeers.timedOut'
                          )
                        : localeString(
                              'views.Settings.EmbeddedNode.NeutrinoPeers.unreachable'
                          )
            }));
        // Field only. hasError is a computed getter.
        this.neutrinoPeerError = this.problematicNeutrinoPeers.length > 0;
    };

    private savedNeutrinoPeers = (): string[] =>
        (this.settingsStore.embeddedLndNetwork === 'Testnet'
            ? this.settingsStore.settings.neutrinoPeersTestnet
            : this.settingsStore.settings.neutrinoPeersMainnet) || [];

    /**
     * Probe the saved peers and flag the weak ones. The probes go over
     * clearnet, so nothing is probed while embedded Tor is on.
     */
    @action
    public checkNeutrinoPeers = async () => {
        if (this.settingsStore.settings?.embeddedTor) return;

        // Pinging every peer can outlast a wallet switch, and nothing awaits
        // this, so the result must not land on the next wallet's alerts
        const isCurrent = this.settingsStore.getConnectionGuard();
        const p2pPort = bitcoinP2pPort(
            this.settingsStore.embeddedLndNetwork === 'Testnet'
        );
        const probes = await probeNeutrinoPeerList(
            this.savedNeutrinoPeers(),
            p2pPort
        );
        if (!isCurrent()) return;
        this.setNeutrinoPeerAlertsFromProbes(probes);
    };

    /**
     * Run once embedded LND is up. Never delays the connect: callers do not
     * await it.
     *
     * Neutrino's own peer list decides. If neutrino is connected to any peer
     * the alert is cleared, whatever a probe would say. If it connects to
     * none within the wait, every saved peer is flagged, with the probe
     * result where one is available. Only when neutrino cannot report its
     * status does this fall back to the probe-only check.
     */
    @action
    public monitorNeutrinoPeers = async () => {
        const isCurrent = this.settingsStore.getConnectionGuard();
        const connectedPeers = await waitForNeutrinoPeers(isCurrent);
        if (!isCurrent()) return;

        if (connectedPeers === null) {
            await this.checkNeutrinoPeers();
            return;
        }

        if (connectedPeers.length > 0) {
            this.setNeutrinoPeerAlertsFromProbes([]);
            return;
        }

        const peers = this.savedNeutrinoPeers();
        let probes: NeutrinoProbeRecord[] = peers.map((peer) => ({
            peer,
            ms: 'Unreachable'
        }));
        if (!this.settingsStore.settings?.embeddedTor) {
            const p2pPort = bitcoinP2pPort(
                this.settingsStore.embeddedLndNetwork === 'Testnet'
            );
            // Neutrino reached none of them, so a peer the probe calls
            // healthy is still flagged as unreachable
            probes = (await probeNeutrinoPeerList(peers, p2pPort)).map(
                (probe) =>
                    isWeakNeutrinoProbeOutcome(probe.ms)
                        ? probe
                        : { peer: probe.peer, ms: 'Unreachable' }
            );
            if (!isCurrent()) return;
        }
        this.setNeutrinoPeerAlertsFromProbes(probes);
    };
}
