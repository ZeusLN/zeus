import { action, reaction, observable } from 'mobx';

import SettingsStore from './SettingsStore';
import NodeInfoStore from './NodeInfoStore';
import { localeString } from '../utils/LocaleUtils';

import {
    NeutrinoProbeRecord,
    bitcoinP2pPort,
    isWeakNeutrinoProbeOutcome,
    probeNeutrinoPeerList
} from '../utils/NeutrinoPeersUtils';

const ZOMBIE_CHAN_THRESHOLD = 21000;

interface Peer {
    peer: string;
    ms: string | number;
}

export default class AlertStore {
    @observable public hasError: boolean = false;
    @observable public zombieError: boolean = false;
    @observable public neutrinoPeerError: boolean = false;
    @observable public problematicNeutrinoPeers: Array<Peer> = [];
    @observable public vssError: string | null = null;
    @observable public esploraError: string | null = null;
    @observable public rgsError: string | null = null;
    settingsStore: SettingsStore;
    nodeInfoStore: NodeInfoStore;

    constructor(settingsStore: SettingsStore, nodeInfoStore: NodeInfoStore) {
        this.settingsStore = settingsStore;
        this.nodeInfoStore = nodeInfoStore;

        reaction(
            () => this.nodeInfoStore.networkInfo,
            () => {
                if (
                    this.settingsStore?.implementation === 'embedded-lnd' &&
                    this.nodeInfoStore?.networkInfo?.num_zombie_chans >
                        ZOMBIE_CHAN_THRESHOLD
                ) {
                    this.hasError = true;
                    this.zombieError = true;
                }
            }
        );
    }

    @action
    public reset = () => {
        this.hasError = false;
        this.zombieError = false;
        this.neutrinoPeerError = false;
        this.problematicNeutrinoPeers = [];
        this.vssError = null;
        this.esploraError = null;
        this.rgsError = null;
    };

    @action
    public setVssError = (error: string) => {
        this.vssError = error;
        this.hasError = true;
    };

    @action
    public setEsploraError = (error: string) => {
        this.esploraError = error;
        this.hasError = true;
    };

    @action
    public setRgsError = (error: string) => {
        this.rgsError = error;
        this.hasError = true;
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

        if (this.problematicNeutrinoPeers.length > 0) {
            this.hasError = true;
            this.neutrinoPeerError = true;
            return;
        }

        this.neutrinoPeerError = false;
        if (
            !this.zombieError &&
            !this.vssError &&
            !this.esploraError &&
            !this.rgsError
        ) {
            this.hasError = false;
        }
    };

    @action
    public checkNeutrinoPeers = async () => {
        const peers =
            this.settingsStore.embeddedLndNetwork === 'Testnet'
                ? this.settingsStore.settings.neutrinoPeersTestnet
                : this.settingsStore.settings.neutrinoPeersMainnet;

        const p2pPort = bitcoinP2pPort(
            this.settingsStore.embeddedLndNetwork === 'Testnet'
        );
        const probes = await probeNeutrinoPeerList(peers, p2pPort);
        this.setNeutrinoPeerAlertsFromProbes(probes);
    };
}
