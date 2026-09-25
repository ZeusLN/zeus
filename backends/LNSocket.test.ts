// Mocks must be declared before importing LNSocket, which imports
// lnmessage, react-native-tcp-socket and the stores at module scope.
const mockCommando = jest.fn();
const mockConnect = jest.fn();
const mockDisconnect = jest.fn();

jest.mock('lnmessage', () => {
    return jest.fn().mockImplementation(function (this: any, options: any) {
        (this as any).options = options;
        (this as any).commando = mockCommando;
        (this as any).connect = mockConnect;
        (this as any).disconnect = mockDisconnect;
    });
});

const mockTcpConnect = jest.fn();
jest.mock('react-native-tcp-socket', () => ({
    __esModule: true,
    default: {
        Socket: jest.fn().mockImplementation(() => ({
            connect: mockTcpConnect,
            on: jest.fn(),
            write: jest.fn(),
            end: jest.fn()
        }))
    }
}));

jest.mock('react-native-securerandom', () => ({
    generateSecureRandom: jest.fn(async () => new Uint8Array(32).fill(7))
}));

const mockUpdateSettings = jest.fn(async (fn: any) => fn({ nodes: [{}] }));
jest.mock('../stores/Stores', () => ({
    settingsStore: {
        lnSocketPubkey:
            '02cdfbc50a09e40d0adbe54a275eca9bcf4685bd67d697558bcb22c6c0ebcd0be2',
        lnSocketPrivateKey: 'aa'.repeat(32),
        host: '192.168.1.2',
        port: '9735',
        rune: 'test-rune',
        updateSettings: (fn: any) => mockUpdateSettings(fn)
    }
}));

import LNSocket from './LNSocket';
import { settingsStore } from '../stores/Stores';

const Lnmessage = require('lnmessage');

describe('LNSocket', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (settingsStore as any).lnSocketPubkey =
            '02cdfbc50a09e40d0adbe54a275eca9bcf4685bd67d697558bcb22c6c0ebcd0be2';
        (settingsStore as any).lnSocketPrivateKey = 'aa'.repeat(32);
        (settingsStore as any).host = '192.168.1.2';
        (settingsStore as any).port = '9735';
        (settingsStore as any).rune = 'test-rune';
    });

    describe('init', () => {
        it('throws when the node public key is not set', async () => {
            (settingsStore as any).lnSocketPubkey = '';
            await expect(new LNSocket().init()).rejects.toThrow(
                'Node public key is not set'
            );
        });

        it('throws when the rune is not set', async () => {
            (settingsStore as any).rune = '';
            await expect(new LNSocket().init()).rejects.toThrow(
                'Rune is not set'
            );
        });

        it('builds lnmessage with the node pubkey, host, port and a TCP socket', async () => {
            const backend = new LNSocket();
            await backend.init();
            expect(Lnmessage).toHaveBeenCalledTimes(1);
            const options = Lnmessage.mock.calls[0][0];
            expect(options.remoteNodePublicKey).toBe(
                settingsStore.lnSocketPubkey
            );
            expect(options.ip).toBe('192.168.1.2');
            expect(options.port).toBe(9735);
            expect(options.tcpSocket).toBeDefined();
            expect(options.privateKey).toBe('aa'.repeat(32));
            // no proxy fallback: direct TCP only
            expect(options.wsProxy).toBeUndefined();
        });

        it('parses a port embedded in the host', async () => {
            (settingsStore as any).host = '10.0.0.5:19735';
            (settingsStore as any).port = '';
            const backend = new LNSocket();
            await backend.init();
            const options = Lnmessage.mock.calls[0][0];
            expect(options.ip).toBe('10.0.0.5');
            expect(options.port).toBe(19735);
        });

        it('generates and persists a private key when none is stored', async () => {
            (settingsStore as any).lnSocketPrivateKey = '';
            const backend = new LNSocket();
            await backend.init();
            expect(mockUpdateSettings).toHaveBeenCalledTimes(1);
            const updater = mockUpdateSettings.mock.calls[0][0];
            const result = updater({ nodes: [{}], selectedNode: 0 });
            expect(result.nodes[0].lnSocketPrivateKey).toBe('07'.repeat(32));
            const options = Lnmessage.mock.calls[0][0];
            expect(options.privateKey).toBe('07'.repeat(32));
        });

        it('adapts the TCP socket connect signature for lnmessage', async () => {
            const backend = new LNSocket();
            await backend.init();
            const options = Lnmessage.mock.calls[0][0];
            // lnmessage's SocketWrapper calls socket.connect(port, host)
            // positionally; the adapter must translate to object form
            options.tcpSocket.connect(9735, '192.168.1.2');
            expect(mockTcpConnect).toHaveBeenCalledWith({
                port: 9735,
                host: '192.168.1.2'
            });
        });
    });

    describe('connect / disconnect', () => {
        it('initializes on first connect and delegates to ln.connect', async () => {
            mockConnect.mockResolvedValue(true);
            const backend = new LNSocket();
            const connected = await backend.connect();
            expect(connected).toBe(true);
            expect(Lnmessage).toHaveBeenCalledTimes(1);
            expect(mockConnect).toHaveBeenCalledTimes(1);
        });

        it('disconnect delegates to ln.disconnect', async () => {
            const backend = new LNSocket();
            await backend.init();
            backend.disconnect();
            expect(mockDisconnect).toHaveBeenCalledTimes(1);
        });

        it('disconnect is a no-op before init', () => {
            expect(() => new LNSocket().disconnect()).not.toThrow();
        });
    });

    describe('rpc', () => {
        it('issues commando calls with method, params and rune', async () => {
            mockCommando.mockResolvedValue({ id: 'node-id' });
            const backend = new LNSocket();
            const res = await backend.rpc('getinfo', { foo: 'bar' });
            expect(mockCommando).toHaveBeenCalledWith({
                method: 'getinfo',
                params: { foo: 'bar' },
                rune: 'test-rune'
            });
            expect(res).toEqual({ id: 'node-id' });
        });

        it('defaults params to an empty object', async () => {
            mockCommando.mockResolvedValue({});
            const backend = new LNSocket();
            await backend.rpc('listfunds');
            expect(mockCommando).toHaveBeenCalledWith({
                method: 'listfunds',
                params: {},
                rune: 'test-rune'
            });
        });
    });

    describe('response mapping', () => {
        it('maps listpeerchannels to channel objects', async () => {
            mockCommando.mockResolvedValue({
                channels: [
                    {
                        state: 'CHANNELD_NORMAL',
                        peer_connected: true,
                        peer_id: 'peer-pubkey',
                        funding_txid: 'txid',
                        channel_id: 'chan-id',
                        total_msat: 1000000,
                        to_us_msat: 600000,
                        out_fulfilled_msat: 10000,
                        in_fulfilled_msat: 20000,
                        in_payments_offered: 1,
                        out_payments_offered: 2,
                        our_to_self_delay: 144,
                        private: false,
                        our_reserve_msat: 1000000,
                        their_reserve_msat: 1000000,
                        close_to_addr: 'bc1q...'
                    }
                ]
            });
            const backend = new LNSocket();
            const { channels } = await backend.getChannels();
            expect(mockCommando).toHaveBeenCalledWith({
                method: 'listpeerchannels',
                params: {},
                rune: 'test-rune'
            });
            expect(channels).toHaveLength(1);
            expect(channels[0]).toMatchObject({
                active: true,
                remote_pubkey: 'peer-pubkey',
                channel_point: 'txid',
                chan_id: 'chan-id',
                capacity: '1000',
                local_balance: '600',
                remote_balance: '400'
            });
        });

        it('maps listfunds to confirmed/unconfirmed balances', async () => {
            mockCommando.mockResolvedValue({
                outputs: [
                    { status: 'confirmed', amount_msat: 50000000 },
                    { status: 'unconfirmed', amount_msat: 10000000 }
                ]
            });
            const backend = new LNSocket();
            const balance = await backend.getBlockchainBalance();
            expect(balance).toEqual({
                total_balance: 60000,
                confirmed_balance: 50000,
                unconfirmed_balance: 10000
            });
        });

        it('maps listinvoices to invoice objects', async () => {
            mockCommando.mockResolvedValue({
                invoices: [
                    {
                        description: 'test',
                        payment_preimage: 'preimage',
                        payment_hash: 'hash',
                        amount_msat: 5000,
                        status: 'paid',
                        expires_at: 123,
                        paid_at: 456,
                        bolt11: 'lnbc...',
                        amount_received_msat: 5000
                    }
                ]
            });
            const backend = new LNSocket();
            const { invoices } = await backend.getInvoices();
            expect(invoices[0]).toMatchObject({
                memo: 'test',
                value: 5,
                settled: true,
                payment_request: 'lnbc...'
            });
        });

        it('sends withdraw with the destination param name', async () => {
            mockCommando.mockResolvedValue({});
            const backend = new LNSocket();
            await backend.sendCoins({
                addr: 'bc1q...',
                sat_per_byte: '2',
                amount: '1000'
            } as any);
            expect(mockCommando).toHaveBeenCalledWith({
                method: 'withdraw',
                params: {
                    destination: 'bc1q...',
                    feerate: '2000perkb',
                    satoshi: '1000'
                },
                rune: 'test-rune'
            });
        });

        it('sends invoice with amount_msat (modern CLN param)', async () => {
            mockCommando.mockResolvedValue({});
            const backend = new LNSocket();
            await backend.createInvoice({
                memo: 'test',
                value: '100',
                expiry: '3600'
            } as any);
            expect(mockCommando).toHaveBeenCalledWith({
                method: 'invoice',
                params: expect.objectContaining({
                    description: 'test',
                    amount_msat: 100000
                }),
                rune: 'test-rune'
            });
        });

        it('pays via xpay without amount_msat when the invoice has an amount', async () => {
            mockCommando.mockImplementation(({ method }: any) => {
                if (method === 'decode') return { amount_msat: 50000000 };
                if (method === 'xpay')
                    return {
                        status: 'complete',
                        payment_preimage: 'ab'.repeat(32)
                    };
                throw new Error('unexpected method ' + method);
            });
            const backend = new LNSocket();
            const res = await backend.payLightningInvoice({
                payment_request: 'lnbc...',
                amt: 50
            } as any);
            expect(mockCommando).toHaveBeenCalledWith({
                method: 'xpay',
                params: { invstring: 'lnbc...' },
                rune: 'test-rune'
            });
            expect(res.status).toBe('complete');
        });

        it('pays via xpay with amount_msat for amountless invoices', async () => {
            mockCommando.mockImplementation(({ method }: any) => {
                if (method === 'decode') return { type: 'bolt11 invoice' };
                if (method === 'xpay')
                    return {
                        status: 'complete',
                        payment_preimage: 'ab'.repeat(32)
                    };
                throw new Error('unexpected method ' + method);
            });
            const backend = new LNSocket();
            await backend.payLightningInvoice({
                payment_request: 'lnbc...',
                amt: 50
            } as any);
            expect(mockCommando).toHaveBeenCalledWith({
                method: 'xpay',
                params: { invstring: 'lnbc...', amount_msat: 50000 },
                rune: 'test-rune'
            });
        });

        it('falls back to pay when xpay is unknown (old CLN)', async () => {
            mockCommando.mockImplementation(({ method }: any) => {
                if (method === 'decode')
                    throw { code: -32601, message: "Unknown command 'decode'" };
                if (method === 'decodepay') return { amount_msat: 50000000 };
                if (method === 'xpay')
                    throw { code: -32601, message: "Unknown command 'xpay'" };
                if (method === 'pay')
                    return {
                        status: 'complete',
                        payment_preimage: 'ab'.repeat(32)
                    };
                throw new Error('unexpected method ' + method);
            });
            const backend = new LNSocket();
            const res = await backend.payLightningInvoice({
                payment_request: 'lnbc...',
                amt: 50
            } as any);
            expect(mockCommando).toHaveBeenCalledWith({
                method: 'pay',
                params: { bolt11: 'lnbc...', amount_msat: undefined },
                rune: 'test-rune'
            });
            expect(res.status).toBe('complete');
        });

        it('sends getroute with amount_msat (modern CLN param)', async () => {
            mockCommando.mockResolvedValue({
                route: [{ amount_msat: 51000, channel: '1x2x3' }]
            });
            const backend = new LNSocket();
            const res = await backend.getRoutes(['node-pubkey', '50'] as any);
            expect(mockCommando).toHaveBeenCalledWith({
                method: 'getroute',
                params: {
                    id: 'node-pubkey',
                    amount_msat: 50000,
                    riskfactor: 2
                },
                rune: 'test-rune'
            });
            expect(res.routes[0].total_fees).toBe(1);
        });
    });

    describe('capability flags', () => {
        it('reports the commando-supported feature set', () => {
            const backend = new LNSocket();
            expect(backend.supportsOnchainSends()).toBe(true);
            expect(backend.supportsChannelManagement()).toBe(true);
            expect(backend.supportsRouting()).toBe(true);
            expect(backend.supportsMessageSigning()).toBe(false);
            expect(backend.supportsKeysend()).toBe(false);
            expect(backend.isLNDBased()).toBe(false);
        });
    });
});
