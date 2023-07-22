function _defineProperty(obj, key, value) { key = _toPropertyKey(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
function _toPropertyKey(arg) { var key = _toPrimitive(arg, "string"); return typeof key === "symbol" ? key : String(key); }
function _toPrimitive(input, hint) { if (typeof input !== "object" || input === null) return input; var prim = input[Symbol.toPrimitive]; if (prim !== undefined) { var res = prim.call(input, hint || "default"); if (typeof res !== "object") return res; throw new TypeError("@@toPrimitive must return a primitive value."); } return (hint === "string" ? String : Number)(input); }
export default class LncCredentialStore {
  /**
   * Constructs a new `LncCredentialStore` instance
   */
  constructor(pairingPhrase) {
    _defineProperty(this, "_serverHost", '');
    _defineProperty(this, "_localKey", '');
    _defineProperty(this, "_remoteKey", '');
    _defineProperty(this, "_pairingPhrase", '');
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
//# sourceMappingURL=credentialStore.js.map