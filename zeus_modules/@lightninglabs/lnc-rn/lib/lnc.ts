import {
    EmitterSubscription,
    NativeEventEmitter,
    NativeModules
} from 'react-native';
import { LndApi, snakeKeysToCamel } from '@lightninglabs/lnc-core';
import { createRpc } from './api/createRpc';
import { CredentialStore, LncConfig } from './types/lnc';
import LncCredentialStore from './util/credentialStore';
import { log } from './util/log';

/** The default values for the LncConfig options */
const DEFAULT_CONFIG = {
    namespace: 'default',
    serverHost: 'mailbox.terminal.lightning.today:443',
    requestTimeoutMs: 60000
} as Required<LncConfig>;

// Native event names emitted by LncModule for the persistent register callbacks.
// Kept in sync with ios/LncMobile/LncModule.mm and android/.../LncModule.kt.
const EVENT_LOCAL_PRIV_CREATE = 'lnc.localPrivCreate';
const EVENT_REMOTE_KEY_RECEIVE = 'lnc.remoteKeyReceive';
const EVENT_AUTH_DATA = 'lnc.authData';

export default class LNC {
    _namespace: string;
    credentials: CredentialStore;

    lnd: LndApi;

    private _emitter: NativeEventEmitter;
    private _subscriptions: EmitterSubscription[] = [];
    private _requestTimeoutMs: number;
    // InitLNC is fired from the constructor, which cannot await. Its outcome
    // is parked here and rethrown from connect(), so a failed init surfaces
    // as a connection error instead of a stream of 'unknown namespace'
    // failures from every subsequent call.
    private _initPromise: Promise<void>;
    private _initError: Error | null = null;

    constructor(lncConfig?: LncConfig) {
        // merge the passed in config with the defaults
        const config = Object.assign({}, DEFAULT_CONFIG, lncConfig);

        this._namespace = config.namespace;
        this._requestTimeoutMs = config.requestTimeoutMs;

        if (config.credentialStore) {
            this.credentials = config.credentialStore;
        } else {
            this.credentials = new LncCredentialStore(config.pairingPhrase);
            // don't overwrite an existing serverHost if we're already paired
            if (!this.credentials.isPaired)
                this.credentials.serverHost = config.serverHost;
            if (config.pairingPhrase)
                this.credentials.pairingPhrase = config.pairingPhrase;
        }

        this.lnd = new LndApi(createRpc, this);
        this._emitter = new NativeEventEmitter(NativeModules.LncModule);
        this._initPromise = Promise.resolve(
            NativeModules.LncModule.initLNC(this._namespace)
        )
            .then(() => undefined)
            .catch((e: any) => {
                this._initError =
                    e instanceof Error ? e : new Error(String(e?.message ?? e));
            });
    }

    onLocalPrivCreate = (keyHex: string) => {
        log.debug('local private key created: ' + keyHex);
        this.credentials.localKey = keyHex;
    };

    onRemoteKeyReceive = (keyHex: string) => {
        log.debug('remote key received: ' + keyHex);
        this.credentials.remoteKey = keyHex;
    };

    onAuthData = (keyHex: string) => {
        log.debug('auth data received: ' + keyHex);
    };

    async isConnected() {
        return await NativeModules.LncModule.isConnected(this._namespace);
    }

    async status() {
        return await NativeModules.LncModule.status(this._namespace);
    }

    async expiry() {
        const expiry = await NativeModules.LncModule.expiry(this._namespace);
        return new Date(expiry * 1000);
    }

    async isReadOnly() {
        return await NativeModules.LncModule.isReadOnly(this._namespace);
    }

    async hasPerms(permission: string) {
        return await NativeModules.LncModule.hasPerms(
            this._namespace,
            permission
        );
    }

    /**
     * Connects to the LNC proxy server
     * @returns a promise that resolves when the connection is established
     */
    async connect() {
        await this._initPromise;
        if (this._initError) throw this._initError;

        // do not attempt to connect multiple times
        const connected = await this.isConnected();
        if (connected) return;

        // Under React Native's new architecture, RCTResponseSenderBlock /
        // com.facebook.react.bridge.Callback may only be invoked once. The Go
        // LNC bridge fires these callbacks repeatedly over the session
        // lifetime, so we route them through RCTEventEmitter instead.
        this._removeSubscriptions();
        this._subscriptions = [
            this._emitter.addListener(
                EVENT_LOCAL_PRIV_CREATE,
                ({ result }: { result: string }) =>
                    this.onLocalPrivCreate(result)
            ),
            this._emitter.addListener(
                EVENT_REMOTE_KEY_RECEIVE,
                ({ result }: { result: string }) =>
                    this.onRemoteKeyReceive(result)
            ),
            this._emitter.addListener(
                EVENT_AUTH_DATA,
                ({ result }: { result: string }) => this.onAuthData(result)
            )
        ];

        NativeModules.LncModule.registerLocalPrivCreateCallback(
            this._namespace,
            EVENT_LOCAL_PRIV_CREATE
        );
        NativeModules.LncModule.registerRemoteKeyReceiveCallback(
            this._namespace,
            EVENT_REMOTE_KEY_RECEIVE
        );
        NativeModules.LncModule.registerAuthDataCallback(
            this._namespace,
            EVENT_AUTH_DATA
        );

        const { pairingPhrase, localKey, remoteKey, serverHost } =
            this.credentials;

        // connect to the server
        const error = await NativeModules.LncModule.connectServer(
            this._namespace,
            serverHost,
            false,
            pairingPhrase,
            localKey,
            remoteKey
        );

        return error;
    }

    /**
     * Disconnects from the proxy server.
     *
     * Awaitable: callers that immediately re-init the same namespace must
     * know the previous connection is closed first, because InitLNC replaces
     * the namespace's mobile client outright without closing what was there.
     */
    async disconnect() {
        this._removeSubscriptions();
        await NativeModules.LncModule.disconnect(this._namespace);
    }

    private _removeSubscriptions() {
        for (const sub of this._subscriptions) {
            sub.remove();
        }
        this._subscriptions = [];
    }

    /**
     * Emulates a GRPC request but uses the mobile client instead to communicate with the LND node
     * @param method the GRPC method to call on the service
     * @param request The GRPC request message to send
     */
    request<TRes>(method: string, request?: object): Promise<TRes> {
        return new Promise((resolve, reject) => {
            log.debug(`${method} request`, request);
            const reqJSON = JSON.stringify(request || {});

            // Backstop: the bridge callback is fire-once and has no error
            // channel of its own, so a dropped invocation would leave this
            // promise pending forever and wedge whatever awaits it. Every
            // unary LND route is fast; a minute is generous.
            let settled = false;
            const timer =
                this._requestTimeoutMs > 0
                    ? setTimeout(() => {
                          if (settled) return;
                          settled = true;
                          reject(
                              new Error(
                                  `${method} timed out after ${this._requestTimeoutMs}ms`
                              )
                          );
                      }, this._requestTimeoutMs)
                    : undefined;

            NativeModules.LncModule.invokeRPC(
                this._namespace,
                method,
                reqJSON,
                (response: string) => {
                    if (settled) return;
                    settled = true;
                    if (timer) clearTimeout(timer);
                    try {
                        const rawRes = JSON.parse(response);
                        const res = snakeKeysToCamel(rawRes);
                        log.debug(`${method} response`, res);
                        resolve(res as TRes);
                    } catch {
                        // Not JSON: the native module has no separate error
                        // channel, so a raw Go error string arrives here.
                        log.debug(`${method} raw response`, response);
                        reject(new Error(response));
                        return;
                    }
                }
            );
        });
    }

    /**
     * Subscribes to a GRPC server-streaming endpoint and executes the `onMessage` handler
     * when a new message is received from the server
     * @param method the GRPC method to call on the service
     * @param request the GRPC request message to send
     * @param onMessage the callback function to execute when a new message is received
     * @param onError the callback function to execute when an error is received
     */
    subscribe(method: string, request?: object): string {
        log.debug(`${method} request`, request);
        const reqJSON = JSON.stringify(request || {});
        NativeModules.LncModule.initListener(this._namespace, method, reqJSON);
        return method;
    }
}
