import { action, reaction, observable } from 'mobx';
// @ts-ignore:next-line
import Ping from 'react-native-ping';

import SettingsStore from './SettingsStore';
import NodeInfoStore from './NodeInfoStore';
import { localeString } from '../utils/LocaleUtils';

import {
    NEUTRINO_PING_TIMEOUT_MS,
    NEUTRINO_PING_THRESHOLD_MS
} from '../utils/LndMobileUtils';

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
    };

    @action
    public checkNeutrinoPeers = async () => {
        const peers =
            this.settingsStore.embeddedLndNetwork === 'Testnet'
                ? this.settingsStore.settings.neutrinoPeersTestnet
                : this.settingsStore.settings.neutrinoPeersMainnet;

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

        this.problematicNeutrinoPeers = filteredResults;
        if (this.problematicNeutrinoPeers.length > 0) {
            this.hasError = true;
            this.neutrinoPeerError = true;
        }
    };
}
