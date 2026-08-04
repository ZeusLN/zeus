import * as bitcoin from 'bitcoinjs-lib';
import { toXOnly } from 'bitcoinjs-lib/src/psbt/bip371';
import { getPublicKey } from '@noble/secp256k1';
// @ts-ignore:next-line
import { decode as wifDecode } from 'wif';

import SweepStore from './SweepStore';

jest.mock('./NodeInfoStore', () => ({
    __esModule: true,
    default: class {}
}));

jest.mock('../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));

// Private key 0x...01 (compressed, mainnet)
const WIF = 'KwDiBf89QgGbjEhKnhXJuH7LrciVrZi3qYjgd9M7rFU73sVHnoWn';

const network = bitcoin.networks.bitcoin;
const { privateKey } = wifDecode(WIF);
const publicKey = Buffer.from(getPublicKey(privateKey, true));

const p2pkhAddress = bitcoin.payments.p2pkh({ pubkey: publicKey, network })
    .address!;
const p2wpkhAddress = bitcoin.payments.p2wpkh({ pubkey: publicKey, network })
    .address!;
const p2trAddress = bitcoin.payments.p2tr({
    internalPubkey: toXOnly(publicKey),
    network
}).address!;

// Build a real funding tx paying the p2pkh address, so the PSBT's
// nonWitnessUtxo hash check passes
const P2PKH_VALUE = 200_000_000;
const fundingTx = new bitcoin.Transaction();
fundingTx.version = 2;
fundingTx.addInput(Buffer.alloc(32, 1), 0);
fundingTx.addOutput(
    bitcoin.address.toOutputScript(p2pkhAddress, network),
    P2PKH_VALUE
);
const p2pkhTxid = fundingTx.getId();

const P2WPKH_VALUE = 50_000_000;
const p2wpkhTxid = '2'.repeat(64);

const P2TR_VALUE = 30_000_000;

const mockNodeInfoStore: any = { nodeInfo: { isTestNet: false } };

function mockEsplora(balances: {
    p2pkh?: boolean;
    p2sh?: boolean;
    p2wpkh?: boolean;
    p2tr?: boolean;
}) {
    global.fetch = jest.fn(async (url: string) => {
        const utxosFor = (address: string) => {
            if (address === p2pkhAddress && balances.p2pkh)
                return [{ txid: p2pkhTxid, vout: 0, value: P2PKH_VALUE }];
            if (address === p2wpkhAddress && balances.p2wpkh)
                return [{ txid: p2wpkhTxid, vout: 0, value: P2WPKH_VALUE }];
            if (address === p2trAddress && balances.p2tr)
                return [{ txid: '3'.repeat(64), vout: 0, value: P2TR_VALUE }];
            return [];
        };

        const utxoMatch = url.match(/\/address\/([^/]+)\/utxo$/);
        if (utxoMatch)
            return {
                ok: true,
                json: async () => utxosFor(utxoMatch[1])
            };

        if (url.endsWith(`/tx/${p2pkhTxid}/hex`))
            return {
                ok: true,
                text: async () => fundingTx.toHex()
            };

        if (url.endsWith(`/tx/${p2wpkhTxid}`))
            return {
                ok: true,
                json: async () => ({
                    vout: [
                        {
                            value: P2WPKH_VALUE,
                            scriptpubkey: bitcoin.payments
                                .p2wpkh({ pubkey: publicKey, network })
                                .output!.toString('hex')
                        }
                    ]
                })
            };

        throw new Error(`unexpected fetch: ${url}`);
    }) as any;
}

describe('SweepStore', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('sweeps UTXOs from every address type of the key, not just the first', async () => {
        mockEsplora({ p2pkh: true, p2wpkh: true });

        const store = new SweepStore(mockNodeInfoStore);
        await store.prepareSweepInputs(WIF);

        expect(store.sweepError).toBe(false);
        expect(store.sweptAddressTypes).toEqual(['p2pkh', 'p2wpkh']);
        expect(store.psbt.inputCount).toBe(2);
        expect(store.onChainBalance).toBe(P2PKH_VALUE + P2WPKH_VALUE);
    });

    it('signs and finalizes a mixed-input sweep transaction', async () => {
        mockEsplora({ p2pkh: true, p2wpkh: true });

        const store = new SweepStore(mockNodeInfoStore);
        await store.prepareSweepInputs(WIF);
        store.destination = p2wpkhAddress;
        await store.finalizeSweepTransaction('2');

        expect(store.sweepError).toBe(false);
        expect(store.txHex).toBeTruthy();
        const tx = bitcoin.Transaction.fromHex(store.txHex!);
        expect(tx.ins.length).toBe(2);
        expect(tx.outs[0].value).toBe(P2PKH_VALUE + P2WPKH_VALUE - store.fee);
    });

    it('warns about unswept taproot funds while sweeping supported types', async () => {
        mockEsplora({ p2wpkh: true, p2tr: true });

        const store = new SweepStore(mockNodeInfoStore);
        await store.prepareSweepInputs(WIF);

        expect(store.sweepError).toBe(false);
        expect(store.sweptAddressTypes).toEqual(['p2wpkh']);
        expect(store.onChainBalance).toBe(P2WPKH_VALUE);
        expect(store.unsweptTaprootSats).toBe(P2TR_VALUE);
    });

    it('errors when funds are exclusively on an unsupported taproot address', async () => {
        mockEsplora({ p2tr: true });

        const store = new SweepStore(mockNodeInfoStore);
        await store.prepareSweepInputs(WIF);

        expect(store.sweepError).toBe(true);
        expect(store.sweepErrorMsg).toBe('views.Wif.addressTypeNotSupported');
        expect(store.unsweptTaprootSats).toBe(P2TR_VALUE);
    });

    it('errors when no address type has UTXOs', async () => {
        mockEsplora({});

        const store = new SweepStore(mockNodeInfoStore);
        await store.prepareSweepInputs(WIF);

        expect(store.sweepError).toBe(true);
        expect(store.sweepErrorMsg).toBe('views.Wif.noUtxosFound');
    });

    it('resets stale balance and taproot warning between scans', async () => {
        mockEsplora({ p2wpkh: true, p2tr: true });

        const store = new SweepStore(mockNodeInfoStore);
        await store.prepareSweepInputs(WIF);
        expect(store.onChainBalance).toBe(P2WPKH_VALUE);
        expect(store.unsweptTaprootSats).toBe(P2TR_VALUE);

        mockEsplora({});
        await store.prepareSweepInputs(WIF);
        expect(store.sweepError).toBe(true);
        expect(store.onChainBalance).toBe(0);
        expect(store.unsweptTaprootSats).toBe(0);
    });
});
