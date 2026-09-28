// Session reuse in LightningNodeConnect.initLNC. The native LNC client dials
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

        it('is false when the native check rejects', async () => {
            const backend = new LightningNodeConnect();
            const lnc = await openWallet(backend, 'phrase-a');
            lnc.isConnected.mockRejectedValueOnce(
                new Error('unknown namespace')
            );

            expect(await backend.isConnected()).toBe(false);
        });
    });
});
