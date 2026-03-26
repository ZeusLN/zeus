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
/** The default values for the LncConfig options */
const DEFAULT_CONFIG = {
  namespace: 'default',
  serverHost: 'mailbox.terminal.lightning.today:443'
};
class LNC {
  constructor(lncConfig) {
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
    _reactNative.NativeModules.LncModule.initLNC(this._namespace);
  }
  onLocalPrivCreate = keyHex => {
    _log.log.debug('local private key created: ' + keyHex);
    this.credentials.localKey = keyHex;
  };
  onRemoteKeyReceive = keyHex => {
    _log.log.debug('remote key received: ' + keyHex);
    this.credentials.remoteKey = keyHex;
  };
  onAuthData = keyHex => {
    _log.log.debug('auth data received: ' + keyHex);
  };
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
    // do not attempt to connect multiple times
    const connected = await this.isConnected();
    if (connected) return;
    _reactNative.NativeModules.LncModule.registerLocalPrivCreateCallback(this._namespace, this.onLocalPrivCreate);
    _reactNative.NativeModules.LncModule.registerRemoteKeyReceiveCallback(this._namespace, this.onRemoteKeyReceive);
    _reactNative.NativeModules.LncModule.registerAuthDataCallback(this._namespace, this.onAuthData);
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
   * Disconnects from the proxy server
   */
  disconnect() {
    _reactNative.NativeModules.LncModule.disconnect(this._namespace);
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
      _reactNative.NativeModules.LncModule.invokeRPC(this._namespace, method, reqJSON, response => {
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
    _reactNative.NativeModules.LncModule.initListener(this._namespace, method, reqJSON);
    return method;
  }
}
exports.default = LNC;
//# sourceMappingURL=lnc.js.map