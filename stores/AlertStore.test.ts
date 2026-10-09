import { observable, runInAction } from 'mobx';

import AlertStore from './AlertStore';
import { pingPeer } from '../utils/LndMobileUtils';

jest.mock('./SettingsStore', () => ({
    __esModule: true,
    default: class SettingsStore {}
}));

jest.mock('../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));

jest.mock('../utils/LndMobileUtils', () => ({
    NEUTRINO_PING_THRESHOLD_MS: 1000,
    pingPeer: jest.fn()
}));

const pingPeerMock = pingPeer as jest.Mock;

const TIMED_OUT = 'views.Settings.EmbeddedNode.NeutrinoPeers.timedOut';

const makeSettingsStore = (embeddedLndNetwork = 'Mainnet') =>
    ({
        implementation: 'embedded-lnd',
        embeddedLndNetwork,
        settings: {
            neutrinoPeersMainnet: ['fast.mainnet', 'slow.mainnet'],
            neutrinoPeersTestnet: ['fast.testnet']
        }
    } as any);

const pingTimes: { [peer: string]: number } = {
    'fast.mainnet': 120,
    'slow.mainnet': 1500,
    'fast.testnet': 80
};

describe('AlertStore', () => {
    beforeEach(() => {
        pingPeerMock.mockReset();
        pingPeerMock.mockImplementation(async (peer: string) => ({
            ms: pingTimes[peer],
            reachable: true
        }));
    });

    it('does not raise an alert for a high zombie channel count', () => {
        // lnd's zombie index only grows (closed channels stay in it),
        // so the count says nothing about payment health. The store
        // used to watch NodeInfoStore.networkInfo and alert above 21000.
        const nodeInfoStore = observable({ networkInfo: {} as any });
        const store = new (AlertStore as any)(
            makeSettingsStore(),
            nodeInfoStore
        );

        runInAction(() => {
            nodeInfoStore.networkInfo = { num_zombie_chans: '500000' };
        });

        expect(store.hasError).toBe(false);
    });

    describe('checkNeutrinoPeers', () => {
        it('flags mainnet peers slower than the threshold', async () => {
            const store = new AlertStore(makeSettingsStore());

            await store.checkNeutrinoPeers();

            expect(store.problematicNeutrinoPeers).toEqual([
                { peer: 'slow.mainnet', ms: 1500 }
            ]);
            expect(store.neutrinoPeerError).toBe(true);
            expect(store.hasError).toBe(true);
        });

        it('flags peers whose ping times out', async () => {
            pingPeerMock.mockImplementation(async (peer: string) => {
                if (peer === 'fast.mainnet') throw new Error('timed out');
                return { ms: 100, reachable: true };
            });
            const store = new AlertStore(makeSettingsStore());

            await store.checkNeutrinoPeers();

            expect(store.problematicNeutrinoPeers).toEqual([
                { peer: 'fast.mainnet', ms: TIMED_OUT }
            ]);
            expect(store.hasError).toBe(true);
        });

        it('pings the testnet peer list on testnet', async () => {
            const store = new AlertStore(makeSettingsStore('Testnet'));

            await store.checkNeutrinoPeers();

            expect(pingPeerMock).toHaveBeenCalledTimes(1);
            expect(pingPeerMock).toHaveBeenCalledWith('fast.testnet');
            expect(store.problematicNeutrinoPeers).toEqual([]);
            expect(store.neutrinoPeerError).toBe(false);
            expect(store.hasError).toBe(false);
        });
    });

    it('reset clears every alert', async () => {
        const store = new AlertStore(makeSettingsStore());
        await store.checkNeutrinoPeers();
        store.setVssError('vss');
        store.setEsploraError('esplora');
        store.setRgsError('rgs');

        store.reset();

        expect(store.hasError).toBe(false);
        expect(store.neutrinoPeerError).toBe(false);
        expect(store.problematicNeutrinoPeers).toEqual([]);
        expect(store.vssError).toBeNull();
        expect(store.esploraError).toBeNull();
        expect(store.rgsError).toBeNull();
    });
});
