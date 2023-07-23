export declare enum LogLevel {
    debug = 1,
    info = 2,
    warn = 3,
    error = 4,
    none = 5
}
/**
 * A logger class with support for multiple namespaces and log levels.
 */
export declare class Logger {
    private _levelToOutput;
    private _logger;
    constructor(levelToOutput: LogLevel, namespace: string);
    /**
     * creates a new Logger instance by inspecting the executing environment
     */
    static fromEnv(namespace: string): Logger;
    /**
     * log a debug message
     */
    debug: (message: string, ...args: any[]) => void;
    /**
     * log an info message
     */
    info: (message: string, ...args: any[]) => void;
    /**
     * log a warn message
     */
    warn: (message: string, ...args: any[]) => void;
    /**
     * log an error message
     */
    error: (message: string, ...args: any[]) => void;
    /**
     * A shared logging function which will only output logs based on the level of this Logger instance
     * @param level the level of the message being logged
     * @param message the message to log
     * @param args optional additional arguments to log
     */
    private _log;
}
/**
 * the main logger for the app
 */
export declare const log: Logger;
/**
 * the logger for GRPC requests and responses
 */
export declare const grpcLog: Logger;
/**
 * the logger for state updates via mobx actions
 */
export declare const actionLog: Logger;
//# sourceMappingURL=log.d.ts.map