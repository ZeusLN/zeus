// Session reuse in LightningNodeConnect.initLNC and connect(). The native LNC client dials
// with grpc.WithBlock on a background context: a dial keeps retrying until
// it connects and nothing can cancel it (Disconnect only closes an
// established connection, InitLNC swaps the namespace's client without
// stopping it). Re-initializing while a dial is in progress put a second
// client on the same mailbox session, and the two evicted each other until
// the app was restarted. These tests pin that initLNC never re-initializes a
// namespace with a dial in flight.

jest.mock('../stores/Stores', () => ({
    settingsStore: {
        pairingPhrase: 'phrase-a',
        mailboxServer: 'mailbox.example.com:443',
        customMailboxServer: ''
    },
    nodeInfoStore: { nodeInfo: {} }
}));

jest.mock('../zeus_modules/@lightninglabs/lnc-core', () => ({
    lnrpc: {},
    walletrpc: {}
}));

jest.mock('../utils/LocaleUtils');

jest.mock('./LNC/credentialStore', () => {
    class MockCredentialStore {
        pairingPhrase = '';
        serverHost = '';
        initialize = async () => this;
        load = async () => undefined;
        flushWrites = async () => undefined;
    }
    return {
        __esModule: true,
        default: MockCredentialStore,
        hash: (value: string) => `ns-${value}`
    };
});

// Stand-in for lnc-rn's LNC: tests drive dialing/connected/status directly.
const mockInstances: any[] = [];
jest.mock('../zeus_modules/@lightninglabs/lnc-rn', () => {
    class MockLNC {
        _namespace: string;
        credentials: any;
        dialing = false;
        connected = false;
        mailboxStatus = 'Connected';
        disconnectCalls = 0;
        disposed = false;
        lnd = {
            lightning: {
                getInfo: jest.fn(() => Promise.reject(new Error('gbn exited'))),
                // lnc-rn's subscribe returns the RPC method as event name
                closeChannel: jest.fn(() => 'lnrpc.Lightning.CloseChannel')
            }
        };
        constructor(config: any) {
            this._namespace = config.namespace;
            this.credentials = config.credentialStore;
            mockInstances.push(this);
        }
        // mirrors lnc-rn: a dial is over once it has connected
        isDialing = jest.fn(async () => {
            if (this.connected) this.dialing = false;
            return this.dialing;
        });
        isConnected = jest.fn(async () => this.connected);
        status = jest.fn(async () => this.mailboxStatus);
        connect = jest.fn(async () => {
            if (!this.connected) this.dialing = true;
        });
        disconnect = jest.fn(async () => {
            if (await this.isDialing()) return;
            this.disconnectCalls++;
            this.connected = false;
        });
        dispose = jest.fn(() => {
            this.disposed = true;
            this.dialing = false;
        });
    }
    return { __esModule: true, default: MockLNC };
});

import { NativeEventEmitter, NativeModules } from 'react-native';

import LightningNodeConnect from './LightningNodeConnect';
import { settingsStore } from '../stores/Stores';

const mockSettings = settingsStore as any;

const openWallet = async (backend: any, phrase: string, mailbox?: string) => {
    mockSettings.pairingPhrase = phrase;
    if (mailbox) mockSettings.mailboxServer = mailbox;
    await backend.initLNC();
    await backend.connect();
    return backend.lnc;
};

describe('LightningNodeConnect', () => {
    beforeEach(() => {
        mockInstances.length = 0;
        mockSettings.pairingPhrase = 'phrase-a';
        mockSettings.implementation = 'lightning-node-connect';
        mockSettings.mailboxServer = 'mailbox.example.com:443';
        mockSettings.customMailboxServer = '';
    });

    describe('initLNC', () => {
        it('gives each wallet its own namespace', async () => {
            const backend = new LightningNodeConnect();
            const a = await openWallet(backend, 'phrase-a');
            a.connected = true;
            const b = await openWallet(backend, 'phrase-b');

            expect(a._namespace).toBe('ns-phrase-a');
            expect(b._namespace).toBe('ns-phrase-b');
        });

        it('keeps a dial in progress instead of re-initializing', async () => {
            const backend = new LightningNodeConnect();
            const first = await openWallet(backend, 'phrase-a');

            // the connect budget ran out; the user retries
            await backend.initLNC();

            expect(mockInstances).toHaveLength(1);
            expect(backend.lnc).toBe(first);
        });

        it('keeps a connected session on the same mailbox', async () => {
            const backend = new LightningNodeConnect();
            const first = await openWallet(backend, 'phrase-a');
            first.connected = true;

            await backend.initLNC();

            expect(mockInstances).toHaveLength(1);
            expect(first.disconnectCalls).toBe(0);
        });

        it('re-initializes after the session was disconnected', async () => {
            // wallet configuration save: disconnect, then the Wallet view
            // reinitializes from the saved settings
            const backend = new LightningNodeConnect();
            const first = await openWallet(backend, 'phrase-a');
            first.connected = true;

            await backend.disconnect();
            await backend.initLNC();

            expect(mockInstances).toHaveLength(2);
            expect(backend.lnc).not.toBe(first);
        });

        it('re-initializes when the mailbox changed', async () => {
            const backend = new LightningNodeConnect();
            const first = await openWallet(backend, 'phrase-a');

            await openWallet(backend, 'phrase-a', 'other.example.com:443');

            expect(mockInstances).toHaveLength(2);
            expect(backend.lnc.credentials.serverHost).toBe(
                'other.example.com:443'
            );
            // the old dial cannot be stopped, but its events must no longer
            // be routed to a store the new client owns
            expect(first.disposed).toBe(true);
        });

        it('resumes a parked dial when its wallet is opened again', async () => {
            const backend = new LightningNodeConnect();
            const a = await openWallet(backend, 'phrase-a');
            const b = await openWallet(backend, 'phrase-b');
            b.connected = true;

            await openWallet(backend, 'phrase-a');

            expect(backend.lnc).toBe(a);
            expect(a.disposed).toBe(false);
            expect(mockInstances).toHaveLength(2);
        });

        it('closes a parked dial that landed while another wallet was open', async () => {
            const backend = new LightningNodeConnect();
            const a = await openWallet(backend, 'phrase-a');
            const b = await openWallet(backend, 'phrase-b');
            b.connected = true;

            // A's dial completes in the background
            a.connected = true;
            await openWallet(backend, 'phrase-c');

            expect(a.disconnectCalls).toBe(1);
        });

        it('leaves a parked dial alone while it is still dialing', async () => {
            const backend = new LightningNodeConnect();
            const a = await openWallet(backend, 'phrase-a');
            const b = await openWallet(backend, 'phrase-b');
            b.connected = true;

            await openWallet(backend, 'phrase-c');

            expect(a.disconnectCalls).toBe(0);
            expect(a.disposed).toBe(false);
        });
    });

    describe('isConnected', () => {
        it.each(['phrase', 'mailbox', 'implementation'])(
            'rejects a connected client after the selected %s changes',
            async (changed) => {
                const backend = new LightningNodeConnect();
                const lnc = await openWallet(backend, 'phrase-a');
                lnc.connected = true;
                if (changed === 'phrase')
                    mockSettings.pairingPhrase = 'phrase-b';
                if (changed === 'mailbox')
                    mockSettings.mailboxServer = 'other:443';
                if (changed === 'implementation')
                    mockSettings.implementation = 'lnd';

                expect(await backend.isConnected()).toBe(false);
                await expect(backend.getMyNodeInfo()).rejects.toThrow(
                    'stores.SettingsStore.lncConnectError'
                );
                expect(lnc.lnd.lightning.getInfo).not.toHaveBeenCalled();
            }
        );

        it('is false without a client', async () => {
            expect(await new LightningNodeConnect().isConnected()).toBe(false);
        });

        it('is false when the native client has no connection', async () => {
            const backend = new LightningNodeConnect();
            await openWallet(backend, 'phrase-a');

            expect(await backend.isConnected()).toBe(false);
        });

        it('is true for a connected session', async () => {
            const backend = new LightningNodeConnect();
            const lnc = await openWallet(backend, 'phrase-a');
            lnc.connected = true;

            expect(await backend.isConnected()).toBe(true);
        });

        it.each([true, false])(
            'rechecks ownership after a status probe (rejects: %s)',
            async (rejects) => {
                const backend = new LightningNodeConnect();
                const lnc = await openWallet(backend, 'phrase-a');
                lnc.connected = true;
                lnc.status.mockImplementation(async () => {
                    mockSettings.pairingPhrase = 'phrase-b';
                    if (rejects) throw new Error('bridge error');
                    return 'Connected';
                });
                expect(await backend.isConnected()).toBe(false);
            }
        );

        it('is false when the mailbox session has died', async () => {
            // native IsConnected is lndConn != nil and stays true after the
            // session dies (#1483)
            const backend = new LightningNodeConnect();
            const lnc = await openWallet(backend, 'phrase-a');
            lnc.connected = true;
            lnc.mailboxStatus = 'Not Connected';

            expect(await backend.isConnected()).toBe(false);
        });

        it('trusts the connection when the status call fails', async () => {
            const backend = new LightningNodeConnect();
            const lnc = await openWallet(backend, 'phrase-a');
            lnc.connected = true;
            lnc.status.mockRejectedValueOnce(new Error('bridge error'));

            expect(await backend.isConnected()).toBe(true);
        });

        it('is false when the native check rejects', async () => {
            const backend = new LightningNodeConnect();
            const lnc = await openWallet(backend, 'phrase-a');
            lnc.isConnected.mockRejectedValueOnce(
                new Error('unknown namespace')
            );

            expect(await backend.isConnected()).toBe(false);
        });
    });

    describe('connect', () => {
        // grpc-go only redials an idle channel when an RPC is made, and
        // lnc-rn's connect() returns early while native IsConnected is true
        it('makes an RPC to redial a dead session', async () => {
            const backend = new LightningNodeConnect();
            const lnc = await openWallet(backend, 'phrase-a');
            lnc.connected = true;
            lnc.mailboxStatus = 'Session Not Found';

            await backend.connect();

            expect(lnc.lnd.lightning.getInfo).toHaveBeenCalledTimes(1);
        });

        it('makes no RPC for a live session', async () => {
            const backend = new LightningNodeConnect();
            const lnc = await openWallet(backend, 'phrase-a');
            lnc.connected = true;

            await backend.connect();

            expect(lnc.lnd.lightning.getInfo).not.toHaveBeenCalled();
        });

        it('makes no RPC while the first dial is in progress', async () => {
            const backend = new LightningNodeConnect();
            const lnc = await openWallet(backend, 'phrase-a');
            lnc.mailboxStatus = 'Not Connected';

            await backend.connect();

            expect(lnc.dialing).toBe(true);
            expect(lnc.lnd.lightning.getInfo).not.toHaveBeenCalled();
        });

        it('still connects when the liveness check fails', async () => {
            const backend = new LightningNodeConnect();
            const lnc = await openWallet(backend, 'phrase-a');
            lnc.connected = true;
            lnc.status.mockRejectedValueOnce(new Error('bridge error'));
            lnc.connect.mockClear();

            await backend.connect();

            expect(lnc.lnd.lightning.getInfo).not.toHaveBeenCalled();
            expect(lnc.connect).toHaveBeenCalledTimes(1);
        });
    });

    describe('closeChannel', () => {
        const EVENT = 'lnrpc.Lightning.CloseChannel';
        let listeners: Array<{
            name: string;
            handler: (event: any) => void;
            removed: boolean;
        }>;

        // the native module reports every update as a JSON string, and
        // errors as plain text
        const emit = (result: string) =>
            listeners
                .filter((l) => l.name === EVENT && !l.removed)
                .forEach((l) => l.handler({ result }));
        const listening = () =>
            listeners.some((l) => l.name === EVENT && !l.removed);

        // Tracks the close without awaiting it, so tests can check that it
        // is still waiting
        const track = (close: Promise<any>) => {
            const state: { settled: boolean; error?: any } = {
                settled: false
            };
            close.then(
                () => (state.settled = true),
                (error) => {
                    state.settled = true;
                    state.error = error;
                }
            );
            return state;
        };
        const flush = () => jest.advanceTimersByTimeAsync(0);

        let backend: LightningNodeConnect;
        let lnc: any;

        beforeEach(async () => {
            listeners = [];
            NativeModules.LncModule = {
                addListener: jest.fn(),
                removeListeners: jest.fn()
            };
            jest.spyOn(
                NativeEventEmitter.prototype,
                'addListener'
            ).mockImplementation((name: string, handler: any) => {
                const listener = { name, handler, removed: false };
                listeners.push(listener);
                return {
                    remove: () => {
                        listener.removed = true;
                    }
                } as any;
            });
            backend = new LightningNodeConnect();
            lnc = await openWallet(backend, 'phrase-a');
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
            jest.restoreAllMocks();
        });

        it('resolves once the stream reports close_pending', async () => {
            const close = track(backend.closeChannel(['txid', '1', '']));

            emit(JSON.stringify({ close_pending: { txid: 'closing-txid' } }));
            await flush();

            expect(close.settled).toBe(true);
            expect(close.error).toBeUndefined();
            expect(listening()).toBe(false);
        });

        it('rejects with the error text the stream reports', async () => {
            const close = track(backend.closeChannel(['txid', '1', '']));

            emit(
                'rpc error: code = Unknown desc = unable to gracefully close channel while peer is offline'
            );
            await flush();

            expect(close.error?.message).toContain(
                'unable to gracefully close channel while peer is offline'
            );
            expect(listening()).toBe(false);
        });

        it('keeps waiting on EOF and on chan_close from an earlier close', async () => {
            const close = track(backend.closeChannel(['txid', '1', '']));

            emit('EOF');
            emit(
                JSON.stringify({
                    chan_close: { closing_txid: 'earlier-close', success: true }
                })
            );
            await flush();

            expect(close.settled).toBe(false);
            expect(listening()).toBe(true);
        });

        it('resolves after a minute without a reply', async () => {
            const close = track(backend.closeChannel(['txid', '1', '']));

            await jest.advanceTimersByTimeAsync(59_999);
            expect(close.settled).toBe(false);

            await jest.advanceTimersByTimeAsync(1);
            expect(close.settled).toBe(true);
            expect(close.error).toBeUndefined();
            expect(listening()).toBe(false);
        });

        it('passes the fee rate and delivery address for a cooperative close', async () => {
            track(backend.closeChannel(['txid', '1', '', '10', 'bcrt1qdest']));

            expect(lnc.lnd.lightning.closeChannel).toHaveBeenCalledWith({
                channel_point: { funding_txid_str: 'txid', output_index: 1 },
                force: '',
                sat_per_vbyte: 10,
                delivery_address: 'bcrt1qdest'
            });
        });

        it('drops the fee rate for a force close', async () => {
            track(backend.closeChannel(['txid', '1', 'true', '10']));

            expect(lnc.lnd.lightning.closeChannel).toHaveBeenCalledWith({
                channel_point: { funding_txid_str: 'txid', output_index: 1 },
                force: 'true'
            });
        });
    });

    describe('payLightningInvoice', () => {
        const EVENT = 'routerrpc.Router.SendPaymentV2';
        let backend: LightningNodeConnect;

        beforeEach(async () => {
            NativeModules.LncModule = {
                addListener: jest.fn(),
                removeListeners: jest.fn()
            };
            jest.spyOn(
                NativeEventEmitter.prototype,
                'addListener'
            ).mockImplementation(() => ({ remove: jest.fn() } as any));
            backend = new LightningNodeConnect();
            const lnc = await openWallet(backend, 'phrase-a');
            lnc.lnd.router = { sendPaymentV2: jest.fn(() => EVENT) };
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
            jest.restoreAllMocks();
        });

        it('resolves an outcome-unknown result when the stream goes quiet', async () => {
            let result: any;
            backend
                .payLightningInvoice({
                    payment_hash: 'ab'.repeat(32),
                    timeout_seconds: 60
                })
                .then((r: any) => (result = r));

            await jest.advanceTimersByTimeAsync(119_999);
            expect(result).toBeUndefined();

            await jest.advanceTimersByTimeAsync(1);
            // without payment_timed_out the store reports a failure and
            // releases the send guard while the payment may still settle
            expect(result.payment_timed_out).toBe(true);
            // the stream is never cancelled, so the request can still reach
            // the node: no deadline after which a missing record is proof
            expect(result).not.toHaveProperty('dispatch_deadline_ms');
        });
    });

    describe('getPayments', () => {
        it('passes creation_date_start through to ListPayments', async () => {
            const backend = new LightningNodeConnect();
            const lnc = await openWallet(backend, 'phrase-a');
            lnc.lnd.lightning.listPayments = jest.fn(async () => ({
                payments: []
            }));

            await backend.lookupPayment({
                payment_hash: 'ab'.repeat(32),
                creation_date_start: 1700000000
            });

            expect(lnc.lnd.lightning.listPayments).toHaveBeenCalledWith({
                include_incomplete: true,
                max_payments: 50,
                reversed: false,
                creation_date_start: 1700000000
            });
        });

        it('omits creation_date_start without a bound', async () => {
            const backend = new LightningNodeConnect();
            const lnc = await openWallet(backend, 'phrase-a');
            lnc.lnd.lightning.listPayments = jest.fn(async () => ({
                payments: []
            }));

            await backend.lookupPayment({ payment_hash: 'ab'.repeat(32) });

            expect(lnc.lnd.lightning.listPayments).toHaveBeenCalledWith({
                include_incomplete: true,
                max_payments: 50,
                reversed: true
            });
        });
    });
});

describe('LightningNodeConnect on-chain sends', () => {
    // RPCs read the selected session through the lnc getter, so open a
    // wallet the normal way and stub the on-chain calls on its client
    const makeBackend = async () => {
        mockSettings.implementation = 'lightning-node-connect';
        mockSettings.mailboxServer = 'mailbox.example.com:443';
        const backend = new LightningNodeConnect();
        const lnc = await openWallet(backend, 'phrase-a');
        lnc.lnd.lightning.sendCoins = jest.fn(async () => ({ txid: 'abc' }));
        lnc.lnd.lightning.getTransactions = jest.fn(async () => ({
            transactions: [{ txHash: 'abc' }]
        }));
        return backend;
    };

    it('passes the send label to lnd', async () => {
        const backend = await makeBackend();
        await backend.sendCoins({
            addr: 'bc1qrecipient',
            amount: '100000',
            label: 'ZEUS send 0011223344556677'
        });

        expect(backend.lnc.lnd.lightning.sendCoins).toHaveBeenCalledWith(
            expect.objectContaining({
                addr: 'bc1qrecipient',
                label: 'ZEUS send 0011223344556677'
            })
        );
    });

    it('asks for transactions from a start height', async () => {
        const backend = await makeBackend();
        await backend.getTransactions({ start_height: 799994 });

        expect(backend.lnc.lnd.lightning.getTransactions).toHaveBeenCalledWith({
            maxTransactions: 500,
            startHeight: 799994
        });
    });

    it('asks for all transactions without a start height', async () => {
        const backend = await makeBackend();
        await backend.getTransactions(undefined);

        expect(backend.lnc.lnd.lightning.getTransactions).toHaveBeenCalledWith({
            maxTransactions: 500
        });
    });
});

describe('LightningNodeConnect channel opens', () => {
    it('passes the channel memo to lnd', async () => {
        mockSettings.implementation = 'lightning-node-connect';
        mockSettings.mailboxServer = 'mailbox.example.com:443';
        const backend = new LightningNodeConnect();
        const lnc = await openWallet(backend, 'phrase-a');
        lnc.lnd.lightning.openChannelSync = jest.fn(async () => ({}));

        await backend.openChannelSync({
            node_pubkey_string: '02peer',
            local_funding_amount: '100000',
            memo: 'ZEUS open 0011223344556677'
        } as any);

        expect(backend.lnc.lnd.lightning.openChannelSync).toHaveBeenCalledWith(
            expect.objectContaining({
                node_pubkey_string: '02peer',
                memo: 'ZEUS open 0011223344556677'
            })
        );
    });
});
