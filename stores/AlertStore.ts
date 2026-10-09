import { action, observable } from 'mobx';

import SettingsStore from './SettingsStore';
import { localeString } from '../utils/LocaleUtils';

import { NEUTRINO_PING_THRESHOLD_MS, pingPeer } from '../utils/LndMobileUtils';

interface Peer {
    peer: string;
    ms: string | number;
}

export default class AlertStore {
    @observable public hasError: boolean = false;
    @observable public neutrinoPeerError: boolean = false;
    @observable public problematicNeutrinoPeers: Array<Peer> = [];
    @observable public vssError: string | null = null;
    @observable public esploraError: string | null = null;
    @observable public rgsError: string | null = null;
    settingsStore: SettingsStore;

    constructor(settingsStore: SettingsStore) {
        this.settingsStore = settingsStore;
    }

    @action
    public reset = () => {
        this.hasError = false;
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

        this.problematicNeutrinoPeers = filteredResults;
        if (this.problematicNeutrinoPeers.length > 0) {
            this.hasError = true;
            this.neutrinoPeerError = true;
        }
    };
}
