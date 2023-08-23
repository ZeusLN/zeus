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
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
function _defineProperty(obj, key, value) { key = _toPropertyKey(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
function _toPropertyKey(arg) { var key = _toPrimitive(arg, "string"); return typeof key === "symbol" ? key : String(key); }
function _toPrimitive(input, hint) { if (typeof input !== "object" || input === null) return input; var prim = input[Symbol.toPrimitive]; if (prim !== undefined) { var res = prim.call(input, hint || "default"); if (typeof res !== "object") return res; throw new TypeError("@@toPrimitive must return a primitive value."); } return (hint === "string" ? String : Number)(input); }
/** The default values for the LncConfig options */
const DEFAULT_CONFIG = {
  namespace: 'default',
  serverHost: 'mailbox.terminal.lightning.today:443'
};
class LNC {
  constructor(lncConfig) {
    _defineProperty(this, "_namespace", void 0);
    _defineProperty(this, "credentials", void 0);
    _defineProperty(this, "lnd", void 0);
    _defineProperty(this, "loop", void 0);
    _defineProperty(this, "pool", void 0);
    _defineProperty(this, "faraday", void 0);
    _defineProperty(this, "lit", void 0);
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
    if (config.credentialStore) {
      this.credentials = config.credentialStore;
    } else {
      this.credentials = new _credentialStore.default(config.pairingPhrase);
      // don't overwrite an existing serverHost if we're already paired
      if (!this.credentials.isPaired) this.credentials.serverHost = config.serverHost;
      if (config.pairingPhrase) this.credentials.pairingPhrase = config.pairingPhrase;
    }
    this.lnd = new _lncCore.LndApi(_createRpc.createRpc, this);
    this.loop = new _lncCore.LoopApi(_createRpc.createRpc, this);
    this.pool = new _lncCore.PoolApi(_createRpc.createRpc, this);
    this.faraday = new _lncCore.FaradayApi(_createRpc.createRpc, this);
    this.lit = new _lncCore.LitApi(_createRpc.createRpc, this);
    _reactNative.NativeModules.LndModule.initLNC(this._namespace);
  }
  async isConnected() {
    return await _reactNative.NativeModules.LndModule.isConnected(this._namespace);
  }
  async status() {
    return await _reactNative.NativeModules.LndModule.status(this._namespace);
  }
  async expiry() {
    const expiry = await _reactNative.NativeModules.LndModule.expiry(this._namespace);
    return new Date(expiry * 1000);
  }
  async isReadOnly() {
    return await _reactNative.NativeModules.LndModule.isReadOnly(this._namespace);
  }
  async hasPerms(permission) {
    return await _reactNative.NativeModules.LndModule.hasPerms(this._namespace, permission);
  }

  /**
   * Connects to the LNC proxy server
   * @returns a promise that resolves when the connection is established
   */
  async connect() {
    // do not attempt to connect multiple times
    const connected = await this.isConnected();
    if (connected) return;
    _reactNative.NativeModules.LndModule.registerLocalPrivCreateCallback(this._namespace, this.onLocalPrivCreate);
    _reactNative.NativeModules.LndModule.registerRemoteKeyReceiveCallback(this._namespace, this.onRemoteKeyReceive);
    _reactNative.NativeModules.LndModule.registerAuthDataCallback(this._namespace, this.onAuthData);
    const {
      pairingPhrase,
      localKey,
      remoteKey,
      serverHost
    } = this.credentials;

    // connect to the server
    const error = await _reactNative.NativeModules.LndModule.connectServer(this._namespace, serverHost, false, pairingPhrase, localKey, remoteKey);
    return error;
  }

  /**
   * Disconnects from the proxy server
   */
  disconnect() {
    _reactNative.NativeModules.LndModule.disconnect(this._namespace);
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
      _reactNative.NativeModules.LndModule.invokeRPC(this._namespace, method, reqJSON, response => {
        try {
          const rawRes = JSON.parse(response);
          const res = (0, _lncCore.snakeKeysToCamel)(rawRes);
          _log.log.debug(`${method} response`, res);
          resolve(res);
        } catch (error) {
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
    _reactNative.NativeModules.LndModule.initListener(this._namespace, method, reqJSON);
    return method;
  }
}
exports.default = LNC;
//# sourceMappingURL=lnc.js.map