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

// prepareSweepInputs and finalizeSweepTransaction log every caught error
beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

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

describe('SweepStore end-to-end sweep', () => {
    const originalFetch = (global as any).fetch;
    afterEach(() => {
        (global as any).fetch = originalFetch;
    });

    const privateKey = Buffer.alloc(32);
    privateKey[31] = 1;
    const pubkey = Buffer.from(ecc.pointFromScalar(privateKey, true)!);
    const UTXO_VALUE = 100_000;

    // Funding transaction paying UTXO_VALUE to `script` at vout 0
    const fundingTx = (script: Buffer) => {
        const tx = new bitcoin.Transaction();
        tx.addInput(Buffer.alloc(32, 1), 0);
        tx.addOutput(script, UTXO_VALUE);
        return tx;
    };

    // Mock mempool API with one UTXO on `fundedAddress`
    const mockMempool = (fundedAddress: string, tx: bitcoin.Transaction) => {
        const txid = tx.getId();
        const scriptpubkey = tx.outs[0].script.toString('hex');
        const fetchMock = jest.fn((url: string) => {
            const path = url.replace('https://mempool.test/api', '');
            if (path.startsWith('/address/')) {
                const address = path.split('/')[2];
                const utxos =
                    address === fundedAddress
                        ? [{ txid, vout: 0, value: UTXO_VALUE }]
                        : [];
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(utxos)
                });
            }
            if (path === `/tx/${txid}/hex`) {
                return Promise.resolve({
                    ok: true,
                    text: () => Promise.resolve(tx.toHex())
                });
            }
            if (path === `/tx/${txid}`) {
                return Promise.resolve({
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            vout: [{ value: UTXO_VALUE, scriptpubkey }]
                        })
                });
            }
            return Promise.resolve({ ok: false });
        });
        (global as any).fetch = fetchMock;
        return fetchMock;
    };

    const network = bitcoin.networks.regtest;
    const cases: Array<{
        type: string;
        payment: bitcoin.Payment;
    }> = [
        { type: 'p2pkh', payment: bitcoin.payments.p2pkh({ pubkey, network }) },
        {
            type: 'p2sh-p2wpkh',
            payment: bitcoin.payments.p2sh({
                redeem: bitcoin.payments.p2wpkh({ pubkey, network }),
                network
            })
        },
        {
            type: 'p2wpkh',
            payment: bitcoin.payments.p2wpkh({ pubkey, network })
        }
    ];

    const DESTINATION = 'bcrt1qqgdrlt97x4847rf85utak8gre5q7k83uwh3ajj';

    cases.forEach(({ type, payment }) => {
        it(`sweeps a ${type} UTXO to a regtest destination`, async () => {
            mockMempool(payment.address!, fundingTx(payment.output!));
            const store = new SweepStore({
                nodeInfo: { isRegTest: true }
            } as any);

            await store.prepareSweepInputs(WIF);
            expect(store.sweepError).toBe(false);
            expect(store.addressType).toBe(type);
            expect(store.utxos).toHaveLength(1);
            expect(store.psbt.inputCount).toBe(1);

            store.destination = DESTINATION;
            await store.finalizeSweepTransaction('2');
            expect(store.sweepError).toBe(false);

            const tx = bitcoin.Transaction.fromHex(store.txHex!);
            expect(store.txId).toBe(tx.getId());
            expect(tx.ins).toHaveLength(1);
            expect(tx.outs).toHaveLength(1);
            expect(
                bitcoin.address.fromOutputScript(tx.outs[0].script, network)
            ).toBe(DESTINATION);
            expect(store.fee).toBe(Math.ceil(store.vBytes * 2));
            expect(tx.outs[0].value).toBe(UTXO_VALUE - store.fee);
            expect(store.valueToSend).toBe(UTXO_VALUE - store.fee);
        });
    });

    it('refuses taproot UTXOs, which sweeps do not support yet', async () => {
        const payment = bitcoin.payments.p2tr({
            internalPubkey: pubkey.subarray(1, 33),
            network
        });
        mockMempool(payment.address!, fundingTx(payment.output!));
        const store = new SweepStore({ nodeInfo: { isRegTest: true } } as any);

        await store.prepareSweepInputs(WIF);

        expect(store.addressType).toBe('p2tr');
        expect(store.sweepError).toBe(true);
        expect(store.sweepErrorMsg).toBe('views.Wif.addressTypeNotSupported');
    });

    it('fails when fees exceed the swept amount', async () => {
        const payment = cases[2].payment;
        mockMempool(payment.address!, fundingTx(payment.output!));
        const store = new SweepStore({ nodeInfo: { isRegTest: true } } as any);
        await store.prepareSweepInputs(WIF);

        store.destination = DESTINATION;
        await store.finalizeSweepTransaction('10000');

        expect(store.sweepError).toBe(true);
        expect(store.sweepErrorMsg).toBe(
            'views.Wif.insufficientFundsAfterFees'
        );
        expect(store.txHex).toBeNull();
    });

    it('fails when the destination is for another network', async () => {
        const payment = cases[2].payment;
        mockMempool(payment.address!, fundingTx(payment.output!));
        const store = new SweepStore({ nodeInfo: { isRegTest: true } } as any);
        await store.prepareSweepInputs(WIF);

        store.destination = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';
        await store.finalizeSweepTransaction('2');

        expect(store.sweepError).toBe(true);
        expect(store.txHex).toBeNull();
    });

    it('reports a failed UTXO lookup', async () => {
        (global as any).fetch = jest.fn(() => Promise.resolve({ ok: false }));
        const store = new SweepStore({ nodeInfo: {} } as any);

        await store.prepareSweepInputs(WIF);

        expect(store.sweepError).toBe(true);
        expect(store.sweepErrorMsg).toBe('views.Wif.errorFetchingUtxos');
    });

    it('reports a failed funding transaction lookup', async () => {
        const payment = cases[2].payment;
        const fetchMock = mockMempool(
            payment.address!,
            fundingTx(payment.output!)
        );
        const utxoLookup = fetchMock.getMockImplementation()!;
        fetchMock.mockImplementation((url: string) =>
            url.includes('/tx/')
                ? Promise.resolve({ ok: false })
                : utxoLookup(url)
        );
        const store = new SweepStore({ nodeInfo: { isRegTest: true } } as any);

        await store.prepareSweepInputs(WIF);

        expect(store.sweepError).toBe(true);
        expect(store.sweepErrorMsg).toBe('views.Wif.failedToFetchTxDetails');
    });
});
