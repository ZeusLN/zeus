import { expect } from 'chai';
import Module from 'module';

import { CredentialStore } from '../lib/types/lnc';

// lnc.ts reaches for react-native at import time (NativeModules and
// NativeEventEmitter), which cannot load outside a Metro bundle. Seed
// require.cache with a stub before the module is first required.

type Listener = (event: { result: string }) => void;

const nativeCalls: Array<{ method: string; args: any[] }> = [];
const listeners = new Map<string, Set<Listener>>();

const LncModule: any = {
    initLNC: (...args: any[]) => {
        nativeCalls.push({ method: 'initLNC', args });
        return Promise.resolve(null);
    },
    isConnected: (...args: any[]) => {
        nativeCalls.push({ method: 'isConnected', args });
        return Promise.resolve(false);
    },
    connectServer: (...args: any[]) => {
        nativeCalls.push({ method: 'connectServer', args });
        return Promise.resolve('');
    },
    disconnect: (...args: any[]) => {
        nativeCalls.push({ method: 'disconnect', args });
        return Promise.resolve(null);
    },
    invokeRPC: (...args: any[]) => {
        nativeCalls.push({ method: 'invokeRPC', args });
    },
    initListener: (...args: any[]) => {
        nativeCalls.push({ method: 'initListener', args });
    },
    registerLocalPrivCreateCallback: () => void 0,
    registerRemoteKeyReceiveCallback: () => void 0,
    registerAuthDataCallback: () => void 0
};

class StubNativeEventEmitter {
    addListener(event: string, handler: Listener) {
        if (!listeners.has(event)) listeners.set(event, new Set());
        listeners.get(event)!.add(handler);
        return {
            remove: () => listeners.get(event)!.delete(handler)
        };
    }
}

const reactNativeId = require.resolve('react-native');
const stubModule: any = new (Module as any)(reactNativeId, null);
stubModule.filename = reactNativeId;
stubModule.loaded = true;
stubModule.exports = {
    NativeModules: { LncModule },
    NativeEventEmitter: StubNativeEventEmitter
};
require.cache[reactNativeId] = stubModule;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const LNC = require('../lib/lnc').default;

const makeCredentials = (
    overrides: Partial<CredentialStore> = {}
): CredentialStore =>
    ({
        pairingPhrase: 'pairing phrase',
        serverHost: 'mailbox.example.com:443',
        localKey: 'local-key',
        remoteKey: 'remote-key',
        isPaired: true,
        clear: () => void 0,
        ...overrides
    } as CredentialStore);

const newLnc = (config: any = {}) =>
    new LNC({
        namespace: 'test-namespace',
        credentialStore: makeCredentials(),
        ...config
    });

const lastCall = (method: string) =>
    [...nativeCalls].reverse().find((c) => c.method === method);

describe('lnc', () => {
    beforeEach(() => {
        nativeCalls.length = 0;
        listeners.clear();
        LncModule.initLNC = (...args: any[]) => {
            nativeCalls.push({ method: 'initLNC', args });
            return Promise.resolve(null);
        };
        LncModule.isConnected = (...args: any[]) => {
            nativeCalls.push({ method: 'isConnected', args });
            return Promise.resolve(false);
        };
        LncModule.disconnect = (...args: any[]) => {
            nativeCalls.push({ method: 'disconnect', args });
            return Promise.resolve(null);
        };
    });

    describe('namespace', () => {
        it('initializes the namespace it was configured with', async () => {
            const lnc = newLnc();
            await lnc.disconnect();

            expect(lastCall('initLNC')!.args).to.deep.equal(['test-namespace']);
        });
    });

    describe('request', () => {
        it('resolves with the parsed response', async () => {
            LncModule.invokeRPC = (
                _ns: string,
                _route: string,
                _req: string,
                cb: (r: string) => void
            ) => cb(JSON.stringify({ identity_pubkey: 'abc' }));

            const lnc = newLnc();
            const res: any = await lnc.request('lnrpc.Lightning.GetInfo', {});

            expect(res.identityPubkey).to.equal('abc');
        });

        it('rejects when the native layer returns a raw error string', async () => {
            // InvokeRPC fails synchronously for 'unknown namespace' and 'RPC
            // connection not ready'; the module has no separate error channel,
            // so the message arrives on the result callback
            LncModule.invokeRPC = (
                _ns: string,
                _route: string,
                _req: string,
                cb: (r: string) => void
            ) => cb('RPC connection not ready');

            const lnc = newLnc();

            try {
                await lnc.request('lnrpc.Lightning.GetInfo', {});
                expect.fail('expected request to reject');
            } catch (e: any) {
                expect(e.message).to.equal('RPC connection not ready');
            }
        });

        it('rejects rather than hanging when the callback never fires', async () => {
            LncModule.invokeRPC = () => void 0;

            const lnc = newLnc({ requestTimeoutMs: 20 });

            try {
                await lnc.request('lnrpc.Lightning.GetInfo', {});
                expect.fail('expected request to reject');
            } catch (e: any) {
                expect(e.message).to.contain('timed out');
            }
        });

        it('ignores a callback that arrives after the timeout', async () => {
            let fire: (r: string) => void = () => void 0;
            LncModule.invokeRPC = (
                _ns: string,
                _route: string,
                _req: string,
                cb: (r: string) => void
            ) => {
                fire = cb;
            };

            const lnc = newLnc({ requestTimeoutMs: 20 });
            const request = lnc.request('lnrpc.Lightning.GetInfo', {});

            let rejection: Error | undefined;
            let resolved = false;
            await request.then(
                () => (resolved = true),
                (e: Error) => (rejection = e)
            );
            expect(rejection!.message).to.contain('timed out');

            // a late invocation must not throw out of the callback, nor
            // resolve the already-rejected promise
            expect(() =>
                fire(JSON.stringify({ identity_pubkey: 'abc' }))
            ).to.not.throw();
            await new Promise((resolve) => setTimeout(resolve, 5));
            expect(resolved).to.equal(false);
        });

        it('waits indefinitely when the timeout is disabled', async () => {
            let fire: (r: string) => void = () => void 0;
            LncModule.invokeRPC = (
                _ns: string,
                _route: string,
                _req: string,
                cb: (r: string) => void
            ) => {
                fire = cb;
            };

            const lnc = newLnc({ requestTimeoutMs: 0 });
            const request = lnc.request('lnrpc.Lightning.GetInfo', {});

            await new Promise((resolve) => setTimeout(resolve, 30));
            fire(JSON.stringify({ identity_pubkey: 'abc' }));

            expect((await request).identityPubkey).to.equal('abc');
        });
    });

    describe('connect', () => {
        it('surfaces an initLNC failure', async () => {
            LncModule.initLNC = () =>
                Promise.reject(new Error('namespace unavailable'));

            const lnc = newLnc();

            try {
                await lnc.connect();
                expect.fail('expected connect to reject');
            } catch (e: any) {
                expect(e.message).to.equal('namespace unavailable');
            }
            expect(lastCall('connectServer')).to.equal(undefined);
        });

        it('does not dial again when already connected', async () => {
            LncModule.isConnected = () => Promise.resolve(true);

            const lnc = newLnc();
            await lnc.connect();

            expect(lastCall('connectServer')).to.equal(undefined);
        });

        it('dials with the persisted credentials', async () => {
            const lnc = newLnc();
            await lnc.connect();

            expect(lastCall('connectServer')!.args).to.deep.equal([
                'test-namespace',
                'mailbox.example.com:443',
                false,
                'pairing phrase',
                'local-key',
                'remote-key'
            ]);
        });
    });

    describe('disconnect', () => {
        it('awaits the native call and drops the key listeners', async () => {
            let released = false;
            LncModule.disconnect = (...args: any[]) => {
                nativeCalls.push({ method: 'disconnect', args });
                return new Promise((resolve) =>
                    setTimeout(() => {
                        released = true;
                        resolve(null);
                    }, 10)
                );
            };

            const lnc = newLnc();
            await lnc.connect();
            expect(listeners.get('lnc.localPrivCreate')!.size).to.equal(1);

            await lnc.disconnect();

            expect(released).to.equal(true);
            expect(listeners.get('lnc.localPrivCreate')!.size).to.equal(0);
        });
    });
});
