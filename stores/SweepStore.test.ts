jest.mock('../stores/Stores', () => ({}));
jest.mock('../utils/UrlUtils', () => ({
    __esModule: true,
    default: { getMempoolApiUrl: () => 'https://mempool.test/api' }
}));
jest.mock('../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));

import * as bitcoin from 'bitcoinjs-lib';

import SweepStore from './SweepStore';
import ecc from '../zeus_modules/noble_ecc';

// The app initializes this through the AddressUtils import side effect
bitcoin.initEccLib(ecc);

// Private key 1 (mainnet compressed WIF). The key's network version byte is
// ignored; the node's network decides which addresses are derived.
const WIF = 'KwDiBf89QgGbjEhKnhXJuH7LrciVrZi3qYjgd9M7rFU73sVHnoWn';

const queriedAddresses = (fetchMock: jest.Mock) =>
    fetchMock.mock.calls.map(
        ([url]: [string]) =>
            url.replace('https://mempool.test/api/address/', '').split('/')[0]
    );

const prepare = async (nodeInfo: any) => {
    const fetchMock = jest.fn(() =>
        Promise.resolve({ ok: true, json: () => Promise.resolve([]) })
    );
    (global as any).fetch = fetchMock;
    const store = new SweepStore({ nodeInfo } as any);
    await store.prepareSweepInputs(WIF);
    return { store, addresses: queriedAddresses(fetchMock) };
};

describe('SweepStore.prepareSweepInputs network selection', () => {
    const originalFetch = (global as any).fetch;
    afterEach(() => {
        (global as any).fetch = originalFetch;
    });

    it('uses mainnet params on mainnet', async () => {
        const { store, addresses } = await prepare({});
        expect(store.network.bech32).toBe('bc');
        expect(addresses).toEqual([
            '1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH',
            '3JvL6Ymt8MVWiCNHC7oWU6nLeHNJKLZGLN',
            'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
            expect.stringMatching(/^bc1p/)
        ]);
    });

    it('uses testnet params on testnet', async () => {
        const { store, addresses } = await prepare({ isTestNet: true });
        expect(store.network.bech32).toBe('tb');
        expect(addresses.slice(0, 3)).toEqual([
            'mrCDrCybB6J1vRfbwM5hemdJz73FwDBC8r',
            '2NAUYAHhujozruyzpsFRP63mbrdaU5wnEpN',
            'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx'
        ]);
    });

    it('uses regtest params on regtest', async () => {
        // Backends report regtest without also setting testnet
        const { store, addresses } = await prepare({ isRegTest: true });
        expect(store.network.bech32).toBe('bcrt');
        expect(addresses[2]).toBe(
            'bcrt1qw508d6qejxtdg4y5r3zarvary0c5xw7kygt080'
        );
    });

    it('uses testnet params on signet', async () => {
        const { store, addresses } = await prepare({ isSigNet: true });
        expect(store.network.bech32).toBe('tb');
        expect(addresses[2]).toBe('tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx');
    });

    it('uses testnet params on Mutinynet', async () => {
        // LDK Node reports Mutinynet as both signet and mutinynet
        const { store } = await prepare({ isSigNet: true, isMutinynet: true });
        expect(store.network.bech32).toBe('tb');
    });

    it('reports no UTXOs found when every derived address is empty', async () => {
        const { store } = await prepare({});
        expect(store.sweepError).toBe(true);
        expect(store.sweepErrorMsg).toBe('views.Wif.noUtxosFound');
    });
});
