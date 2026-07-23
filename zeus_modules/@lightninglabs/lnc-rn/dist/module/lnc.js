"use strict";

import { NativeEventEmitter, NativeModules } from 'react-native';
import { LndApi, snakeKeysToCamel } from '@lightninglabs/lnc-core';
import { createRpc } from './api/createRpc';
import LncCredentialStore from './util/credentialStore';
import { log } from './util/log';

/** The default values for the LncConfig options */
const DEFAULT_CONFIG = {
  namespace: 'default',
  serverHost: 'mailbox.terminal.lightning.today:443'
};
const EVENT_LOCAL_PRIV_CREATE = 'lnc.localPrivCreate';
const EVENT_REMOTE_KEY_RECEIVE = 'lnc.remoteKeyReceive';
const EVENT_AUTH_DATA = 'lnc.authData';
export default class LNC {
  _subscriptions = [];
  constructor(lncConfig) {
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
    this._emitter = new NativeEventEmitter(NativeModules.LncModule);
    NativeModules.LncModule.initLNC(this._namespace);
  }
  onLocalPrivCreate = keyHex => {
    log.debug('local private key created: ' + keyHex);
    this.credentials.localKey = keyHex;
  };
  onRemoteKeyReceive = keyHex => {
    log.debug('remote key received: ' + keyHex);
    this.credentials.remoteKey = keyHex;
  };
  onAuthData = keyHex => {
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
    NativeModules.LncModule.registerLocalPrivCreateCallback(this._namespace, EVENT_LOCAL_PRIV_CREATE);
    NativeModules.LncModule.registerRemoteKeyReceiveCallback(this._namespace, EVENT_REMOTE_KEY_RECEIVE);
    NativeModules.LncModule.registerAuthDataCallback(this._namespace, EVENT_AUTH_DATA);
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
    this._removeSubscriptions();
    NativeModules.LncModule.disconnect(this._namespace);
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
