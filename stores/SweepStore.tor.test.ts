// Pins each SweepStore mempool request to the active node's Tor setting:
// with Tor on it goes through doTorRequestRaw, with Tor off through
// ReactNativeBlobUtil. Uses the real NetworkUtils, unlike SweepStore.test.ts.
jest.mock('../stores/Stores');
jest.mock('../utils/UrlUtils', () => ({
    __esModule: true,
    default: { getMempoolApiUrl: () => 'https://mempool.test/api' }
}));
jest.mock('../utils/LocaleUtils');
jest.mock('../utils/TorUtils', () => ({
    doTorRequest: jest.fn(),
    doTorRequestRaw: jest.fn(),
    RequestMethod: { GET: 'GET', POST: 'POST', DELETE: 'DELETE' }
}));
jest.mock('react-native-blob-util', () => ({
    __esModule: true,
    default: { fetch: jest.fn() }
}));

import * as bitcoin from 'bitcoinjs-lib';
import ReactNativeBlobUtil from 'react-native-blob-util';

import SweepStore from './SweepStore';
import { doTorRequestRaw } from '../utils/TorUtils';
import ecc from '../zeus_modules/noble_ecc';

// The app initializes this through the AddressUtils import side effect
bitcoin.initEccLib(ecc);

const fetchMock = ReactNativeBlobUtil.fetch as jest.Mock;
const torMock = doTorRequestRaw as jest.Mock;

const API = 'https://mempool.test/api';
// Private key 1 (compressed WIF) for the test networks
const WIF = 'cMahea7zqjxrtgAbB7LSGbcQUr1uX1ojuat9jZodMN87JcbXMTcA';
const privateKey = Buffer.alloc(32);
privateKey[31] = 1;
const pubkey = Buffer.from(ecc.pointFromScalar(privateKey, true)!);
const network = bitcoin.networks.regtest;

const fundingTx = (script: Buffer) => {
    const tx = new bitcoin.Transaction();
    tx.addInput(Buffer.alloc(32, 1), 0);
    tx.addOutput(script, 100_000);
    return tx;
};

// Serves one UTXO on `funded` to whichever transport makes the request
const serveMempool = (funded: string, tx: bitcoin.Transaction) => {
    const txid = tx.getId();
    const scriptpubkey = tx.outs[0].script.toString('hex');
    const route = (url: string) => {
        const path = url.replace(API, '');
        if (path.startsWith('/address/')) {
            const utxos =
                path.split('/')[2] === funded
                    ? [{ txid, vout: 0, value: 100_000 }]
                    : [];
            return { status: 200, body: JSON.stringify(utxos) };
        }
        if (path === `/tx/${txid}/hex`)
            return { status: 200, body: tx.toHex() };
        if (path === `/tx/${txid}`)
            return {
                status: 200,
                body: JSON.stringify({
                    vout: [{ value: 100_000, scriptpubkey }]
                })
            };
        return { status: 404, body: '' };
    };
    torMock.mockImplementation(async (url: string) => route(url));
    fetchMock.mockImplementation(async (_method: string, url: string) => {
        const { status, body } = route(url);
        return {
            info: () => ({ status }),
            json: () => JSON.parse(body),
            text: () => body
        };
    });
    return txid;
};

const cases: Array<[string, bitcoin.Payment, (txid: string) => string]> = [
    [
        'p2pkh',
        bitcoin.payments.p2pkh({ pubkey, network }),
        (txid) => `${API}/tx/${txid}/hex`
    ],
    [
        'p2sh-p2wpkh',
        bitcoin.payments.p2sh({
            redeem: bitcoin.payments.p2wpkh({ pubkey, network }),
            network
        }),
        (txid) => `${API}/tx/${txid}`
    ],
    [
        'p2wpkh',
        bitcoin.payments.p2wpkh({ pubkey, network }),
        (txid) => `${API}/tx/${txid}`
    ]
];

const prepare = async (payment: bitcoin.Payment, enableTor: boolean) => {
    const txid = serveMempool(payment.address!, fundingTx(payment.output!));
    const store = new SweepStore(
        { nodeInfo: { isRegTest: true } } as any,
        {
            enableTor
        } as any
    );
    await store.prepareSweepInputs(WIF);
    expect(store.sweepError).toBe(false);
    return txid;
};

const torUrls = () => torMock.mock.calls.map(([url]) => url);
const directUrls = () => fetchMock.mock.calls.map(([, url]) => url);

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('SweepStore requests follow the Tor setting', () => {
    it.each(cases)(
        'looks up a %s UTXO and its funding transaction over Tor',
        async (_, payment, txUrl) => {
            const txid = await prepare(payment, true);

            expect(torUrls()).toContain(
                `${API}/address/${payment.address}/utxo`
            );
            expect(torUrls()).toContain(txUrl(txid));
            expect(fetchMock).not.toHaveBeenCalled();
        }
    );

    it.each(cases)(
        'looks up a %s UTXO and its funding transaction directly with Tor off',
        async (_, payment, txUrl) => {
            const txid = await prepare(payment, false);

            expect(directUrls()).toContain(
                `${API}/address/${payment.address}/utxo`
            );
            expect(directUrls()).toContain(txUrl(txid));
            expect(torMock).not.toHaveBeenCalled();
        }
    );
});
