import { observable, runInAction } from 'mobx';

import AlertStore from './AlertStore';
import {
    probeNeutrinoPeerList,
    waitForNeutrinoPeers
} from '../utils/NeutrinoPeersUtils';

jest.mock('./SettingsStore', () => ({
    __esModule: true,
    default: class SettingsStore {}
}));

jest.mock('../utils/LocaleUtils');

jest.mock('../utils/NeutrinoPeersUtils', () => ({
    NEUTRINO_PING_THRESHOLD_MS: 1000,
    bitcoinP2pPort: (isTestnet: boolean) => (isTestnet ? 18333 : 8333),
    isWeakNeutrinoProbeOutcome: (ms: any) =>
        ms === 'Timed out' ||
        ms === 'Unreachable' ||
        (typeof ms === 'number' && ms > 1000),
    probeNeutrinoPeerList: jest.fn(),
    waitForNeutrinoPeers: jest.fn()
}));

const probeMock = probeNeutrinoPeerList as jest.Mock;
const waitForPeersMock = waitForNeutrinoPeers as jest.Mock;

const TIMED_OUT = 'views.Settings.EmbeddedNode.NeutrinoPeers.timedOut';
const UNREACHABLE = 'views.Settings.EmbeddedNode.NeutrinoPeers.unreachable';

const makeSettingsStore = (
    embeddedLndNetwork = 'Mainnet',
    embeddedTor = false
) => {
    const store: any = {
        implementation: 'embedded-lnd',
        embeddedLndNetwork,
        connectionSeq: 0,
        settings: {
            embeddedTor,
            neutrinoPeersMainnet: ['fast.mainnet', 'slow.mainnet'],
            neutrinoPeersTestnet: ['fast.testnet']
        }
    };
    store.getConnectionGuard = () => {
        const seq = store.connectionSeq;
        return () => store.connectionSeq === seq;
    };
    return store;
};

const pingTimes: { [peer: string]: number } = {
    'fast.mainnet': 120,
    'slow.mainnet': 1500,
    'fast.testnet': 80
};

describe('AlertStore', () => {
    beforeEach(() => {
        probeMock.mockReset();
        probeMock.mockImplementation(async (peers: string[]) =>
            peers.map((peer) => ({ peer, ms: pingTimes[peer] }))
        );
        waitForPeersMock.mockReset();
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
            probeMock.mockImplementation(async (peers: string[]) =>
                peers.map((peer) => ({
                    peer,
                    ms: peer === 'fast.mainnet' ? 'Timed out' : 100
                }))
            );
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

            expect(probeMock).toHaveBeenCalledTimes(1);
            expect(probeMock).toHaveBeenCalledWith(['fast.testnet'], 18333);
            expect(store.problematicNeutrinoPeers).toEqual([]);
            expect(store.neutrinoPeerError).toBe(false);
            expect(store.hasError).toBe(false);
        });

        it('drops the result when the wallet changes during the pings', async () => {
            const settingsStore = makeSettingsStore();
            probeMock.mockImplementation(async (peers: string[]) => {
                // a wallet switch lands while the old wallet's peers are
                // still being pinged
                settingsStore.connectionSeq++;
                return peers.map((peer) => ({ peer, ms: pingTimes[peer] }));
            });
            const store = new AlertStore(settingsStore);

            await store.checkNeutrinoPeers();

            expect(store.problematicNeutrinoPeers).toEqual([]);
            expect(store.neutrinoPeerError).toBe(false);
            expect(store.hasError).toBe(false);
        });

        it('does not probe over clearnet while embedded Tor is on', async () => {
            const store = new AlertStore(makeSettingsStore('Mainnet', true));

            await store.checkNeutrinoPeers();

            expect(probeMock).not.toHaveBeenCalled();
            expect(store.neutrinoPeerError).toBe(false);
        });
    });

    describe('monitorNeutrinoPeers', () => {
        it('clears the alert when neutrino is connected, whatever the probes say', async () => {
            waitForPeersMock.mockResolvedValue(['1.2.3.4:8333']);
            const store = new AlertStore(makeSettingsStore());
            store.setNeutrinoPeerAlertsFromProbes([
                { peer: 'slow.mainnet', ms: 1500 }
            ]);

            await store.monitorNeutrinoPeers();

            expect(probeMock).not.toHaveBeenCalled();
            expect(store.problematicNeutrinoPeers).toEqual([]);
            expect(store.neutrinoPeerError).toBe(false);
        });

        it('flags every saved peer when neutrino connects to none', async () => {
            waitForPeersMock.mockResolvedValue([]);
            const store = new AlertStore(makeSettingsStore());

            await store.monitorNeutrinoPeers();

            expect(store.problematicNeutrinoPeers).toEqual([
                // the probe calls it fast, but neutrino could not use it
                { peer: 'fast.mainnet', ms: UNREACHABLE },
                { peer: 'slow.mainnet', ms: 1500 }
            ]);
            expect(store.neutrinoPeerError).toBe(true);
        });

        it('flags every saved peer without probing while Tor is on', async () => {
            waitForPeersMock.mockResolvedValue([]);
            const store = new AlertStore(makeSettingsStore('Mainnet', true));

            await store.monitorNeutrinoPeers();

            expect(probeMock).not.toHaveBeenCalled();
            expect(store.problematicNeutrinoPeers).toEqual([
                { peer: 'fast.mainnet', ms: UNREACHABLE },
                { peer: 'slow.mainnet', ms: UNREACHABLE }
            ]);
        });

        it('falls back to the probes when neutrino cannot report its status', async () => {
            waitForPeersMock.mockResolvedValue(null);
            const store = new AlertStore(makeSettingsStore());

            await store.monitorNeutrinoPeers();

            expect(probeMock).toHaveBeenCalledTimes(1);
            expect(store.problematicNeutrinoPeers).toEqual([
                { peer: 'slow.mainnet', ms: 1500 }
            ]);
        });

        it('drops the result when the wallet changes while waiting', async () => {
            const settingsStore = makeSettingsStore();
            waitForPeersMock.mockImplementation(async () => {
                settingsStore.connectionSeq++;
                return [];
            });
            const store = new AlertStore(settingsStore);

            await store.monitorNeutrinoPeers();

            expect(probeMock).not.toHaveBeenCalled();
            expect(store.neutrinoPeerError).toBe(false);
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

describe('AlertStore mempoolError', () => {
    it('sets and clears the mempool error', () => {
        const store = new AlertStore(makeSettingsStore());

        store.setMempoolError('mempool.space', 'HTTP 500');
        expect(store.mempoolError).toEqual({
            host: 'mempool.space',
            message: 'HTTP 500'
        });
        expect(store.hasError).toBe(true);

        store.clearMempoolError();
        expect(store.mempoolError).toBeNull();
        expect(store.hasError).toBe(false);
    });

    it('keeps hasError true while another error remains', () => {
        const store = new AlertStore(makeSettingsStore());

        store.setVssError('vss down');
        store.setMempoolError('mempool.space', 'HTTP 500');
        expect(store.hasError).toBe(true);

        store.clearMempoolError();
        // vssError is still set — hasError must stay true
        expect(store.hasError).toBe(true);
    });

    it('reset clears mempoolError', () => {
        const store = new AlertStore(makeSettingsStore());

        store.setMempoolError('mempool.space', 'HTTP 500');
        store.reset();
        expect(store.mempoolError).toBeNull();
        expect(store.hasError).toBe(false);
    });

    describe('setMempoolErrorFromUrl host extraction', () => {
        it.each([
            ['https://mempool.space/api/v1/fees/recommended', 'mempool.space'],
            [
                'https://mempool.space/testnet/api/blocks/tip/height',
                'mempool.space'
            ],
            [
                'https://custom.example.com:8080/api/v1/fees/recommended',
                'custom.example.com:8080'
            ]
        ])('extracts the host from %s → %s', (url, expectedHost) => {
            const store = new AlertStore(makeSettingsStore());

            store.setMempoolErrorFromUrl(url, 'HTTP 500');

            expect(store.mempoolError).toEqual({
                host: expectedHost,
                message: 'HTTP 500'
            });
        });

        it('falls back to the full string on a parse error', () => {
            const store = new AlertStore(makeSettingsStore());

            store.setMempoolErrorFromUrl('not a url', 'HTTP 500');

            expect(store.mempoolError).toEqual({
                host: 'not a url',
                message: 'HTTP 500'
            });
        });
    });
});
