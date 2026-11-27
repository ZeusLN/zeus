jest.mock('react-native-randombytes', () => ({
    randomBytes: (size: number) => Buffer.alloc(size, 0)
}));
jest.mock('react-native-blob-util', () => ({ fetch: jest.fn() }));
jest.mock('../utils/UrlUtils', () => ({ getMempoolApiUrl: jest.fn() }));
jest.mock('../utils/ErrorUtils', () => ({
    errorToUserFriendly: (e: any) => e?.message ?? String(e)
}));
jest.mock('../stores/Stores', () => ({
    alertStore: {
        setMempoolErrorFromUrl: jest.fn(),
        clearMempoolError: jest.fn()
    }
}));
// TransactionsStore imports BackendUtils, which pulls in LND → TorUtils →
// react-native-nitro-tor (ESM). Mock BackendUtils so Jest never loads it.
jest.mock('../utils/BackendUtils', () => ({ __esModule: true, default: {} }));

import * as bitcoin from 'bitcoinjs-lib';
import ReactNativeBlobUtil from 'react-native-blob-util';
import BackendUtils from '../utils/BackendUtils';
import Base64Utils from '../utils/Base64Utils';
import UrlUtils from '../utils/UrlUtils';
import { alertStore } from './Stores';
import TransactionsStore from './TransactionsStore';

const mockedFetch = jest.mocked(ReactNativeBlobUtil.fetch);
const mockedUrl = jest.mocked(UrlUtils.getMempoolApiUrl);
const mockedAlert = alertStore as jest.Mocked<typeof alertStore>;

const newStore = () => {
    const stub = {
        onReconnect: jest.fn(),
        nodeInfo: {},
        settings: {},
        implementation: 'embedded-lnd'
    };
    return new TransactionsStore(
        { ...stub, onReconnect: jest.fn() } as any,
        { ...stub, onReconnect: jest.fn() } as any,
        { ...stub, onReconnect: jest.fn() } as any,
        { ...stub, onReconnect: jest.fn() } as any,
        { ...stub, onReconnect: jest.fn() } as any
    );
};

describe('TransactionsStore.broadcastRawTxToMempoolSpace alert wiring', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedUrl.mockReturnValue('https://mempool.space/api');
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('clears the alert on a 200 response', async () => {
        mockedFetch.mockResolvedValueOnce({
            info: () => ({ status: 200 }),
            data: 'txid-abc'
        } as any);
        const store = newStore();

        const result = await store.broadcastRawTxToMempoolSpace('deadbeef');

        expect(result).toBe('txid-abc');
        expect(store.broadcast_txid).toBe('txid-abc');
        expect(mockedAlert.clearMempoolError).toHaveBeenCalled();
        expect(mockedAlert.setMempoolErrorFromUrl).not.toHaveBeenCalled();
    });

    it('raises the alert on a 5xx response', async () => {
        mockedFetch.mockResolvedValueOnce({
            info: () => ({ status: 503 }),
            data: 'Service unavailable'
        } as any);
        const store = newStore();

        await store.broadcastRawTxToMempoolSpace('deadbeef');

        expect(store.broadcast_err).toBe('Service unavailable');
        expect(mockedAlert.setMempoolErrorFromUrl).toHaveBeenCalledWith(
            'https://mempool.space/api/tx',
            'HTTP 503'
        );
        expect(mockedAlert.clearMempoolError).not.toHaveBeenCalled();
    });

    it('does not raise the alert on a 400 response (tx was rejected, server is up)', async () => {
        mockedFetch.mockResolvedValueOnce({
            info: () => ({ status: 400 }),
            data: 'Invalid tx'
        } as any);
        const store = newStore();

        await store.broadcastRawTxToMempoolSpace('deadbeef');

        expect(store.broadcast_err).toBe('Invalid tx');
        expect(mockedAlert.setMempoolErrorFromUrl).not.toHaveBeenCalled();
        // 400 means the server is reachable and rejected the tx, so clear the alert
        expect(mockedAlert.clearMempoolError).toHaveBeenCalled();
    });

    it('does not raise or clear on a 404 response', async () => {
        mockedFetch.mockResolvedValueOnce({
            info: () => ({ status: 404 }),
            data: 'Not found'
        } as any);
        const store = newStore();

        await store.broadcastRawTxToMempoolSpace('deadbeef');

        expect(store.broadcast_err).toBe('Not found');
        expect(mockedAlert.setMempoolErrorFromUrl).not.toHaveBeenCalled();
        expect(mockedAlert.clearMempoolError).not.toHaveBeenCalled();
    });

    it('clears a 5xx alert when a later broadcast returns 400', async () => {
        const store = newStore();

        // First: 5xx raises the alert
        mockedFetch.mockResolvedValueOnce({
            info: () => ({ status: 503 }),
            data: 'Service unavailable'
        } as any);
        await store.broadcastRawTxToMempoolSpace('deadbeef');
        expect(mockedAlert.setMempoolErrorFromUrl).toHaveBeenCalledTimes(1);

        mockedAlert.setMempoolErrorFromUrl.mockClear();
        mockedAlert.clearMempoolError.mockClear();

        // Then: 4xx means the server is up again — clear the prior alert
        mockedFetch.mockResolvedValueOnce({
            info: () => ({ status: 400 }),
            data: 'Invalid tx'
        } as any);
        await store.broadcastRawTxToMempoolSpace('deadbeef');

        expect(mockedAlert.setMempoolErrorFromUrl).not.toHaveBeenCalled();
        expect(mockedAlert.clearMempoolError).toHaveBeenCalled();
    });

    it('raises the alert on a thrown network error', async () => {
        mockedFetch.mockRejectedValueOnce(new Error('Network error'));
        const store = newStore();

        await store.broadcastRawTxToMempoolSpace('deadbeef');

        expect(mockedAlert.setMempoolErrorFromUrl).toHaveBeenCalledWith(
            'https://mempool.space/api/tx',
            'Network error'
        );
    });
});

describe('TransactionsStore.broadcast through publishTransaction', () => {
    let published: any[];

    beforeEach(() => {
        published = [];
        Object.assign(BackendUtils as any, {
            getClass: () => ({ publishTransaction: true }),
            // as LND, EmbeddedLND and LightningNodeConnect convert it
            publishTransaction: async (data: any) => {
                published.push(Base64Utils.hexToBase64(data.tx_hex));
                return { publish_error: '' };
            }
        });
    });

    afterEach(() => {
        delete (BackendUtils as any).getClass;
        delete (BackendUtils as any).publishTransaction;
    });

    const newBroadcastStore = () => {
        const stub = {
            onReconnect: jest.fn(),
            resetOpenChannel: jest.fn(),
            nodeInfo: {},
            settings: {},
            implementation: 'lnd'
        };
        return new TransactionsStore(
            { ...stub } as any,
            { ...stub } as any,
            { ...stub } as any,
            { ...stub } as any,
            { ...stub } as any
        );
    };

    // a signed segwit tx whose length in bytes has the given remainder
    // mod 3, which decides whether its base64 ends in '=' padding
    const txOfLengthMod3 = (remainder: number) => {
        for (let n = 1; n < 10; n++) {
            const tx = new bitcoin.Transaction();
            tx.version = 2;
            tx.addInput(Buffer.alloc(32, 7), 0);
            tx.setWitness(0, [Buffer.alloc(71, 1), Buffer.alloc(33, 2)]);
            tx.addOutput(
                Buffer.concat([Buffer.from([0x6a, n]), Buffer.alloc(n, 9)]),
                1000
            );
            if (tx.byteLength() % 3 === remainder) return tx;
        }
        throw new Error(`no tx of length ${remainder} mod 3`);
    };

    const expectPublished = async (
        raw_final_tx: any,
        tx: bitcoin.Transaction
    ) => {
        const store = newBroadcastStore();
        await store.broadcast(raw_final_tx);

        expect(published).toEqual([tx.toBuffer().toString('base64')]);
        expect(store.txid).toBe(tx.getId());
        expect(store.publishSuccess).toBe(true);
    };

    // lnd's finalizePsbt over REST or LNC returns raw_final_tx as base64,
    // which has no padding when the length is a multiple of 3
    it('publishes an unpadded base64 tx', async () => {
        const tx = txOfLengthMod3(0);
        const base64 = tx.toBuffer().toString('base64');
        expect(base64).not.toContain('=');

        await expectPublished(base64, tx);
    });

    it.each([1, 2])(
        'publishes a padded base64 tx (length %i mod 3)',
        async (remainder) => {
            const tx = txOfLengthMod3(remainder);
            const base64 = tx.toBuffer().toString('base64');
            expect(base64).toContain('=');

            await expectPublished(base64, tx);
        }
    );

    // PSBT.tsx and TxHex.tsx pass a hex tx
    it('publishes a hex tx', async () => {
        const tx = txOfLengthMod3(0);
        await expectPublished(tx.toHex(), tx);
    });

    // embedded lnd's finalizePsbt returns raw_final_tx as bytes
    it('publishes a tx given as bytes', async () => {
        const tx = txOfLengthMod3(0);
        await expectPublished(Uint8Array.from(tx.toBuffer()), tx);
    });
});
