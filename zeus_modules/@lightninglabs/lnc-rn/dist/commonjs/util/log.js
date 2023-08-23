"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.log = exports.grpcLog = exports.actionLog = exports.Logger = exports.LogLevel = void 0;
var _debug = _interopRequireDefault(require("debug"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
function _defineProperty(obj, key, value) { key = _toPropertyKey(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
function _toPropertyKey(arg) { var key = _toPrimitive(arg, "string"); return typeof key === "symbol" ? key : String(key); }
function _toPrimitive(input, hint) { if (typeof input !== "object" || input === null) return input; var prim = input[Symbol.toPrimitive]; if (prim !== undefined) { var res = prim.call(input, hint || "default"); if (typeof res !== "object") return res; throw new TypeError("@@toPrimitive must return a primitive value."); } return (hint === "string" ? String : Number)(input); }
let LogLevel;
/**
 * A logger class with support for multiple namespaces and log levels.
 */
exports.LogLevel = LogLevel;
(function (LogLevel) {
  LogLevel[LogLevel["debug"] = 1] = "debug";
  LogLevel[LogLevel["info"] = 2] = "info";
  LogLevel[LogLevel["warn"] = 3] = "warn";
  LogLevel[LogLevel["error"] = 4] = "error";
  LogLevel[LogLevel["none"] = 5] = "none";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
class Logger {
  constructor(levelToOutput, namespace) {
    var _this = this;
    _defineProperty(this, "_levelToOutput", void 0);
    _defineProperty(this, "_logger", void 0);
    _defineProperty(this, "debug", function (message) {
      for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
        args[_key - 1] = arguments[_key];
      }
      return _this._log(LogLevel.debug, message, args);
    });
    _defineProperty(this, "info", function (message) {
      for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
        args[_key2 - 1] = arguments[_key2];
      }
      return _this._log(LogLevel.info, message, args);
    });
    _defineProperty(this, "warn", function (message) {
      for (var _len3 = arguments.length, args = new Array(_len3 > 1 ? _len3 - 1 : 0), _key3 = 1; _key3 < _len3; _key3++) {
        args[_key3 - 1] = arguments[_key3];
      }
      return _this._log(LogLevel.warn, message, args);
    });
    _defineProperty(this, "error", function (message) {
      for (var _len4 = arguments.length, args = new Array(_len4 > 1 ? _len4 - 1 : 0), _key4 = 1; _key4 < _len4; _key4++) {
        args[_key4 - 1] = arguments[_key4];
      }
      return _this._log(LogLevel.error, message, args);
    });
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
   * log a debug message
   */

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
const log = Logger.fromEnv('main');

/**
 * the logger for GRPC requests and responses
 */
exports.log = log;
const grpcLog = Logger.fromEnv('grpc');

/**
 * the logger for state updates via mobx actions
 */
exports.grpcLog = grpcLog;
const actionLog = Logger.fromEnv('action');
exports.actionLog = actionLog;
//# sourceMappingURL=log.js.map