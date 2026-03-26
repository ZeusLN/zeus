"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
class LncCredentialStore {
  _serverHost = '';
  _localKey = '';
  _remoteKey = '';
  _pairingPhrase = '';

  /**
   * Constructs a new `LncCredentialStore` instance
   */
  constructor(pairingPhrase) {
    if (pairingPhrase) this.pairingPhrase = pairingPhrase;
  }

  //
  // Public fields which implement the `CredentialStore` interface
  //

  /** Stores the host:port of the Lightning Node Connect proxy server to connect to */
  get serverHost() {
    return this._serverHost;
  }

  /** Stores the host:port of the Lightning Node Connect proxy server to connect to */
  set serverHost(host) {
    this._serverHost = host;
  }

  /** Stores the LNC pairing phrase used to initialize the connection to the LNC proxy */
  get pairingPhrase() {
    return this._pairingPhrase;
  }

  /** Stores the LNC pairing phrase used to initialize the connection to the LNC proxy */
  set pairingPhrase(phrase) {
    this._pairingPhrase = phrase;
  }

  /** Stores the local private key which LNC uses to reestablish a connection */
  get localKey() {
    return this._localKey;
  }

  /** Stores the local private key which LNC uses to reestablish a connection */
  set localKey(key) {
    this._localKey = key;
  }

  /** Stores the remote static key which LNC uses to reestablish a connection */
  get remoteKey() {
    return this._remoteKey;
  }

  /** Stores the remote static key which LNC uses to reestablish a connection */
  set remoteKey(key) {
    this._remoteKey = key;
  }

  /**
   * Read-only field which should return `true` if the client app has prior
   * credentials persisted in teh store
   */
  get isPaired() {
    return !!this._remoteKey || !!this._pairingPhrase;
  }

  /** Clears any persisted data in the store */
  clear() {
    this._serverHost = '';
    this._localKey = '';
    this._remoteKey = '';
    this._pairingPhrase = '';
  }
}
exports.default = LncCredentialStore;
//# sourceMappingURL=credentialStore.js.map