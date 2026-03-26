"use strict";

import debug from 'debug';
export let LogLevel = /*#__PURE__*/function (LogLevel) {
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
export class Logger {
  constructor(levelToOutput, namespace) {
    this._levelToOutput = levelToOutput;
    this._logger = debug(namespace);
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
  debug = (message, ...args) => this._log(LogLevel.debug, message, args);

  /**
   * log an info message
   */
  info = (message, ...args) => this._log(LogLevel.info, message, args);

  /**
   * log a warn message
   */
  warn = (message, ...args) => this._log(LogLevel.warn, message, args);

  /**
   * log an error message
   */
  error = (message, ...args) => this._log(LogLevel.error, message, args);

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
export const log = Logger.fromEnv('main');

/**
 * the logger for GRPC requests and responses
 */
export const grpcLog = Logger.fromEnv('grpc');

/**
 * the logger for state updates via mobx actions
 */
export const actionLog = Logger.fromEnv('action');
//# sourceMappingURL=log.js.map