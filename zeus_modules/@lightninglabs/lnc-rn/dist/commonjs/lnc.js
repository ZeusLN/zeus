"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _reactNative = require("react-native");
var _lncCore = require("@lightninglabs/lnc-core");
var _createRpc = require("./api/createRpc");
var _credentialStore = _interopRequireDefault(require("./util/credentialStore"));
var _log = require("./util/log");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
function _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == typeof i ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != typeof t || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != typeof i) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
/** The default values for the LncConfig options */
const DEFAULT_CONFIG = {
  namespace: 'default',
  serverHost: 'mailbox.terminal.lightning.today:443',
  requestTimeoutMs: 60000
};

// Native event names emitted by LncModule for the persistent register callbacks.
// Kept in sync with ios/LncMobile/LncModule.mm and android/.../LncModule.kt.
const EVENT_LOCAL_PRIV_CREATE = 'lnc.localPrivCreate';
const EVENT_REMOTE_KEY_RECEIVE = 'lnc.remoteKeyReceive';
const EVENT_AUTH_DATA = 'lnc.authData';
class LNC {
  constructor(lncConfig) {
    _defineProperty(this, "_namespace", void 0);
    _defineProperty(this, "credentials", void 0);
    _defineProperty(this, "lnd", void 0);
    _defineProperty(this, "_emitter", void 0);
    _defineProperty(this, "_subscriptions", []);
    _defineProperty(this, "_requestTimeoutMs", void 0);
    // InitLNC is fired from the constructor, which cannot await. Its outcome
    // is parked here and rethrown from connect(), so a failed init surfaces
    // as a connection error instead of a stream of 'unknown namespace'
    // failures from every subsequent call.
    _defineProperty(this, "_initPromise", void 0);
    _defineProperty(this, "_initError", null);
    _defineProperty(this, "onLocalPrivCreate", keyHex => {
      _log.log.debug('local private key created: ' + keyHex);
      this.credentials.localKey = keyHex;
    });
    _defineProperty(this, "onRemoteKeyReceive", keyHex => {
      _log.log.debug('remote key received: ' + keyHex);
      this.credentials.remoteKey = keyHex;
    });
    _defineProperty(this, "onAuthData", keyHex => {
      _log.log.debug('auth data received: ' + keyHex);
    });
    // merge the passed in config with the defaults
    const config = Object.assign({}, DEFAULT_CONFIG, lncConfig);
    this._namespace = config.namespace;
    this._requestTimeoutMs = config.requestTimeoutMs;
    if (config.credentialStore) {
      this.credentials = config.credentialStore;
    } else {
      this.credentials = new _credentialStore.default(config.pairingPhrase);
      // don't overwrite an existing serverHost if we're already paired
      if (!this.credentials.isPaired) this.credentials.serverHost = config.serverHost;
      if (config.pairingPhrase) this.credentials.pairingPhrase = config.pairingPhrase;
    }
    this.lnd = new _lncCore.LndApi(_createRpc.createRpc, this);
    this._emitter = new _reactNative.NativeEventEmitter(_reactNative.NativeModules.LncModule);
    this._initPromise = Promise.resolve(_reactNative.NativeModules.LncModule.initLNC(this._namespace)).then(() => undefined).catch(e => {
      this._initError = e instanceof Error ? e : new Error(String((e === null || e === void 0 ? void 0 : e.message) ?? e));
    });
  }
  async isConnected() {
    return await _reactNative.NativeModules.LncModule.isConnected(this._namespace);
  }
  async status() {
    return await _reactNative.NativeModules.LncModule.status(this._namespace);
  }
  async expiry() {
    const expiry = await _reactNative.NativeModules.LncModule.expiry(this._namespace);
    return new Date(expiry * 1000);
  }
  async isReadOnly() {
    return await _reactNative.NativeModules.LncModule.isReadOnly(this._namespace);
  }
  async hasPerms(permission) {
    return await _reactNative.NativeModules.LncModule.hasPerms(this._namespace, permission);
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
    this._subscriptions = [this._emitter.addListener(EVENT_LOCAL_PRIV_CREATE, ({
      result
    }) => this.onLocalPrivCreate(result)), this._emitter.addListener(EVENT_REMOTE_KEY_RECEIVE, ({
      result
    }) => this.onRemoteKeyReceive(result)), this._emitter.addListener(EVENT_AUTH_DATA, ({
      result
    }) => this.onAuthData(result))];
    _reactNative.NativeModules.LncModule.registerLocalPrivCreateCallback(this._namespace, EVENT_LOCAL_PRIV_CREATE);
    _reactNative.NativeModules.LncModule.registerRemoteKeyReceiveCallback(this._namespace, EVENT_REMOTE_KEY_RECEIVE);
    _reactNative.NativeModules.LncModule.registerAuthDataCallback(this._namespace, EVENT_AUTH_DATA);
    const {
      pairingPhrase,
      localKey,
      remoteKey,
      serverHost
    } = this.credentials;

    // connect to the server
    const error = await _reactNative.NativeModules.LncModule.connectServer(this._namespace, serverHost, false, pairingPhrase, localKey, remoteKey);
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
    await _reactNative.NativeModules.LncModule.disconnect(this._namespace);
  }
  _removeSubscriptions() {
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
  request(method, request) {
    return new Promise((resolve, reject) => {
      _log.log.debug(`${method} request`, request);
      const reqJSON = JSON.stringify(request || {});

      // Backstop: the bridge callback is fire-once and has no error
      // channel of its own, so a dropped invocation would leave this
      // promise pending forever and wedge whatever awaits it. Every
      // unary LND route is fast; a minute is generous.
      let settled = false;
      const timer = this._requestTimeoutMs > 0 ? setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error(`${method} timed out after ${this._requestTimeoutMs}ms`));
      }, this._requestTimeoutMs) : undefined;
      _reactNative.NativeModules.LncModule.invokeRPC(this._namespace, method, reqJSON, response => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        try {
          const rawRes = JSON.parse(response);
          const res = (0, _lncCore.snakeKeysToCamel)(rawRes);
          _log.log.debug(`${method} response`, res);
          resolve(res);
        } catch {
          // Not JSON: the native module has no separate error
          // channel, so a raw Go error string arrives here.
          _log.log.debug(`${method} raw response`, response);
          reject(new Error(response));
          return;
        }
      });
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
  subscribe(method, request) {
    _log.log.debug(`${method} request`, request);
    const reqJSON = JSON.stringify(request || {});
    _reactNative.NativeModules.LncModule.initListener(this._namespace, method, reqJSON);
    return method;
  }
}
exports.default = LNC;
//# sourceMappingURL=lnc.js.map