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

    describe('watchInvoicePaid', () => {
        const EVENT = 'invoicesrpc.Invoices.SubscribeSingleInvoice';
        // contains both characters that differ between base64 and base64url
        const WATCHED = Buffer.from('fb'.repeat(16) + 'ff'.repeat(16), 'hex');
        const EARLIER = Buffer.from('aa'.repeat(32), 'hex');

        let listeners: Array<{
            name: string;
            handler: (event: any) => void;
            removed: boolean;
        }>;
        const emit = (event: any) =>
            listeners
                .filter((l) => l.name === EVENT && !l.removed)
                .forEach((l) => l.handler(event));
        const listenerCount = () =>
            listeners.filter((l) => l.name === EVENT && !l.removed).length;
        const update = (hash: Buffer, fields: any) => ({
            result: JSON.stringify({
                r_hash: hash.toString('base64'),
                ...fields
            })
        });

        const watch = async () => {
            const backend = new LightningNodeConnect();
            const lnc = await openWallet(backend, 'phrase-a');
            lnc.lnd.invoices = { subscribeSingleInvoice: jest.fn(() => EVENT) };
            const onPaid = jest.fn();
            const stop = backend.watchInvoicePaid(
                {
                    rHash: WATCHED.toString('base64')
                        .replace(/\+/g, '-')
                        .replace(/\//g, '_')
                },
                onPaid
            );
            return { onPaid, stop };
        };

        beforeEach(() => {
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
            jest.spyOn(console, 'error').mockImplementation(() => undefined);
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        it('reports the settlement of the watched invoice', async () => {
            const { onPaid } = await watch();

            emit(update(WATCHED, { settled: false }));
            expect(onPaid).not.toHaveBeenCalled();

            emit(
                update(WATCHED, {
                    settled: true,
                    amt_paid_sat: '300000',
                    payment_request: 'lnbc3m1watched',
                    r_preimage: 'cHJlaW1hZ2U='
                })
            );

            expect(onPaid).toHaveBeenCalledTimes(1);
            expect(onPaid).toHaveBeenCalledWith({
                amountSat: 300000,
                tx: 'lnbc3m1watched',
                preimage: 'cHJlaW1hZ2U='
            });
            expect(listenerCount()).toBe(0);
        });

        it('skips the settlement of an invoice watched earlier', async () => {
            const { onPaid } = await watch();

            emit(
                update(EARLIER, {
                    settled: true,
                    amt_paid_sat: '100',
                    payment_request: 'lnbc1u1earlier'
                })
            );
            emit({
                result: JSON.stringify({ settled: true, amt_paid_sat: '100' })
            });

            expect(onPaid).not.toHaveBeenCalled();
            expect(listenerCount()).toBe(1);
        });

        it('keeps watching when the stream of an earlier invoice ends', async () => {
            const { onPaid } = await watch();

            emit({ result: 'EOF' });
            emit({
                result: 'rpc error: code = Unknown desc = there are no existing invoices'
            });
            emit(update(WATCHED, { settled: true, amt_paid_sat: '300000' }));

            expect(onPaid).toHaveBeenCalledTimes(1);
        });

        it('stops when the session is closed or the caller unsubscribes', async () => {
            await watch();
            emit({
                result: 'rpc error: code = Canceled desc = context canceled'
            });
            expect(listenerCount()).toBe(0);

            const { stop } = await watch();
            stop();
            expect(listenerCount()).toBe(0);
        });
    });
});
