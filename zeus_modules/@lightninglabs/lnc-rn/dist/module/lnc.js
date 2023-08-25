function _defineProperty(obj, key, value) { key = _toPropertyKey(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
function _toPropertyKey(arg) { var key = _toPrimitive(arg, "string"); return typeof key === "symbol" ? key : String(key); }
function _toPrimitive(input, hint) { if (typeof input !== "object" || input === null) return input; var prim = input[Symbol.toPrimitive]; if (prim !== undefined) { var res = prim.call(input, hint || "default"); if (typeof res !== "object") return res; throw new TypeError("@@toPrimitive must return a primitive value."); } return (hint === "string" ? String : Number)(input); }
import { NativeModules } from 'react-native';
import { FaradayApi, LitApi, LndApi, LoopApi, PoolApi, snakeKeysToCamel } from '@lightninglabs/lnc-core';
import { createRpc } from './api/createRpc';
import LncCredentialStore from './util/credentialStore';
import { log } from './util/log';

/** The default values for the LncConfig options */
const DEFAULT_CONFIG = {
  namespace: 'default',
  serverHost: 'mailbox.terminal.lightning.today:443'
};
export default class LNC {
  constructor(lncConfig) {
    _defineProperty(this, "_namespace", void 0);
    _defineProperty(this, "credentials", void 0);
    _defineProperty(this, "lnd", void 0);
    _defineProperty(this, "loop", void 0);
    _defineProperty(this, "pool", void 0);
    _defineProperty(this, "faraday", void 0);
    _defineProperty(this, "lit", void 0);
    _defineProperty(this, "onLocalPrivCreate", keyHex => {
      log.debug('local private key created: ' + keyHex);
      this.credentials.localKey = keyHex;
    });
    _defineProperty(this, "onRemoteKeyReceive", keyHex => {
      log.debug('remote key received: ' + keyHex);
      this.credentials.remoteKey = keyHex;
    });
    _defineProperty(this, "onAuthData", keyHex => {
      log.debug('auth data received: ' + keyHex);
    });
    // merge the passed in config with the defaults
    const config = Object.assign({}, DEFAULT_CONFIG, lncConfig);
    this._namespace = config.namespace;
    if (config.credentialStore) {
      this.credentials = config.credentialStore;
    } else {
      this.credentials = new LncCredentialStore(config.pairingPhrase);
      // don't overwrite an existing serverHost if we're already paired
      if (!this.credentials.isPaired) this.credentials.serverHost = config.serverHost;
      if (config.pairingPhrase) this.credentials.pairingPhrase = config.pairingPhrase;
    }
    this.lnd = new LndApi(createRpc, this);
    this.loop = new LoopApi(createRpc, this);
    this.pool = new PoolApi(createRpc, this);
    this.faraday = new FaradayApi(createRpc, this);
    this.lit = new LitApi(createRpc, this);
    NativeModules.LncModule.initLNC(this._namespace);
  }
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
  async hasPerms(permission) {
    return await NativeModules.LncModule.hasPerms(this._namespace, permission);
  }

  /**
   * Connects to the LNC proxy server
   * @returns a promise that resolves when the connection is established
   */
  async connect() {
    // do not attempt to connect multiple times
    const connected = await this.isConnected();
    if (connected) return;
    NativeModules.LncModule.registerLocalPrivCreateCallback(this._namespace, this.onLocalPrivCreate);
    NativeModules.LncModule.registerRemoteKeyReceiveCallback(this._namespace, this.onRemoteKeyReceive);
    NativeModules.LncModule.registerAuthDataCallback(this._namespace, this.onAuthData);
    const {
      pairingPhrase,
      localKey,
      remoteKey,
      serverHost
    } = this.credentials;

    // connect to the server
    const error = await NativeModules.LncModule.connectServer(this._namespace, serverHost, false, pairingPhrase, localKey, remoteKey);
    return error;
  }

  /**
   * Disconnects from the proxy server
   */
  disconnect() {
    NativeModules.LncModule.disconnect(this._namespace);
  }

  /**
   * Emulates a GRPC request but uses the mobile client instead to communicate with the LND node
   * @param method the GRPC method to call on the service
   * @param request The GRPC request message to send
   */
  request(method, request) {
    return new Promise((resolve, reject) => {
      log.debug(`${method} request`, request);
      const reqJSON = JSON.stringify(request || {});
      NativeModules.LncModule.invokeRPC(this._namespace, method, reqJSON, response => {
        try {
          const rawRes = JSON.parse(response);
          const res = snakeKeysToCamel(rawRes);
          log.debug(`${method} response`, res);
          resolve(res);
        } catch (error) {
          log.debug(`${method} raw response`, response);
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
    log.debug(`${method} request`, request);
    const reqJSON = JSON.stringify(request || {});
    NativeModules.LncModule.initListener(this._namespace, method, reqJSON);
    return method;
  }
}
//# sourceMappingURL=lnc.js.map