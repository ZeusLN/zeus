"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.log = exports.grpcLog = exports.actionLog = exports.Logger = exports.LogLevel = void 0;
var _debug = _interopRequireDefault(require("debug"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
function _defineProperty(obj, key, value) { key = _toPropertyKey(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == typeof i ? i : String(i); }
function _toPrimitive(t, r) { if ("object" != typeof t || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != typeof i) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
let LogLevel = exports.LogLevel = /*#__PURE__*/function (LogLevel) {
  LogLevel[LogLevel["debug"] = 1] = "debug";
  LogLevel[LogLevel["info"] = 2] = "info";
  LogLevel[LogLevel["warn"] = 3] = "warn";
  LogLevel[LogLevel["error"] = 4] = "error";
  LogLevel[LogLevel["none"] = 5] = "none";
  return LogLevel;
}({});
/**
 * A logger class with support for multiple namespaces and log levels.
 */
class Logger {
  constructor(levelToOutput, namespace) {
    _defineProperty(this, "_levelToOutput", void 0);
    _defineProperty(this, "_logger", void 0);
    /**
     * log a debug message
     */
    _defineProperty(this, "debug", (message, ...args) => this._log(LogLevel.debug, message, args));
    /**
     * log an info message
     */
    _defineProperty(this, "info", (message, ...args) => this._log(LogLevel.info, message, args));
    /**
     * log a warn message
     */
    _defineProperty(this, "warn", (message, ...args) => this._log(LogLevel.warn, message, args));
    /**
     * log an error message
     */
    _defineProperty(this, "error", (message, ...args) => this._log(LogLevel.error, message, args));
    this._levelToOutput = levelToOutput;
    this._logger = (0, _debug.default)(namespace);
  }

  /**
   * creates a new Logger instance by inspecting the executing environment
   */
  static fromEnv(namespace) {
    // by default, log nothing (assuming prod)
    const level = LogLevel.none;
    return new Logger(level, namespace);
  }
  /**
   * A shared logging function which will only output logs based on the level of this Logger instance
   * @param level the level of the message being logged
   * @param message the message to log
   * @param args optional additional arguments to log
   */
  _log(level, message, args) {
    // don't log if the level to output is greater than the level of this message
    if (this._levelToOutput > level) return;

    // convert the provided log level number to the string name
    const prefix = Object.keys(LogLevel).reduce((prev, curr) => level === LogLevel[curr] ? curr : prev, '??');
    this._logger(`[${prefix}] ${message}`, ...args);
  }
}

/**
 * the main logger for the app
 */
exports.Logger = Logger;
const log = exports.log = Logger.fromEnv('main');

/**
 * the logger for GRPC requests and responses
 */
const grpcLog = exports.grpcLog = Logger.fromEnv('grpc');

/**
 * the logger for state updates via mobx actions
 */
const actionLog = exports.actionLog = Logger.fromEnv('action');
//# sourceMappingURL=log.js.map