import { sleep } from './SleepUtils';

/**
 * LND error codes - use for consistent error handling across the app
 */
export enum LndErrorCode {
    /** LND data folder does not exist */
    LND_FOLDER_MISSING = 'LND_FOLDER_MISSING',
    /** LND unlocked too quickly during wallet creation */
    WALLET_CREATION_UNLOCKED_TOO_QUICKLY = 'WALLET_CREATION_UNLOCKED_TOO_QUICKLY',
    /** RPC connection was closed */
    RPC_CONNECTION_CLOSED = 'RPC_CONNECTION_CLOSED',
    /** RPC did not become ready within timeout */
    RPC_READY_TIMEOUT = 'RPC_READY_TIMEOUT',
    /** LND failed to stop after max retries */
    LND_FAILED_TO_STOP = 'LND_FAILED_TO_STOP',
    /** LND failed to start after max retries */
    LND_START_FAILED = 'LND_START_FAILED',
    /** Failed to generate seed */
    GEN_SEED_FAILED = 'GEN_SEED_FAILED',
    /** Timeout waiting for LND to become ready */
    LND_READY_TIMEOUT = 'LND_READY_TIMEOUT',
    /** LND is already running (informational) */
    LND_ALREADY_RUNNING = 'LND_ALREADY_RUNNING',
    /** Wallet is locked - unlock required */
    WALLET_LOCKED = 'WALLET_LOCKED',
    /** Macaroon store is locked */
    MACAROON_STORE_LOCKED = 'MACAROON_STORE_LOCKED',
    /** Wallet/Unlocker already unlocked (genSeed race) */
    GEN_SEED_UNLOCKED = 'GEN_SEED_UNLOCKED',
    /** RPC not ready yet (transient) */
    RPC_NOT_READY = 'RPC_NOT_READY',
    /** Expected state when stopping LND  */
    STOP_LND_EXPECTED = 'STOP_LND_EXPECTED',
    /** Invalid response from LND stream */
    STREAM_INVALID_RESPONSE = 'STREAM_INVALID_RESPONSE',
    /** Stream ended normally (EOF) - not an error */
    STREAM_EOF = 'STREAM_EOF'
}

/**  messages for display in UI */
export const LND_ERROR_MESSAGES: Record<LndErrorCode, string> = {
    [LndErrorCode.LND_FOLDER_MISSING]:
        'LND wallet folder not found. The wallet may have been deleted.',
    [LndErrorCode.WALLET_CREATION_UNLOCKED_TOO_QUICKLY]:
        'Wallet creation failed: LND unlocked too quickly. Please try again.',
    [LndErrorCode.RPC_CONNECTION_CLOSED]: 'RPC connection closed.',
    [LndErrorCode.RPC_READY_TIMEOUT]:
        'RPC did not become ready in time. Please try again.',
    [LndErrorCode.LND_FAILED_TO_STOP]:
        'LND failed to stop. Please restart the app.',
    [LndErrorCode.LND_START_FAILED]:
        'LND failed to start. Please restart the app.',
    [LndErrorCode.GEN_SEED_FAILED]: 'Failed to generate wallet seed.',
    [LndErrorCode.LND_READY_TIMEOUT]:
        'LND did not become ready in time. Please try again.',
    [LndErrorCode.LND_ALREADY_RUNNING]: 'LND is already running.',
    [LndErrorCode.WALLET_LOCKED]: 'Wallet is locked. Unlock required.',
    [LndErrorCode.MACAROON_STORE_LOCKED]:
        'Macaroon store is locked. Please try again.',
    [LndErrorCode.GEN_SEED_UNLOCKED]:
        'Wallet already unlocked. Please try wallet creation again.',
    [LndErrorCode.RPC_NOT_READY]: 'RPC not ready yet. Please wait.',
    [LndErrorCode.STOP_LND_EXPECTED]: 'LND stopped (expected state).',
    [LndErrorCode.STREAM_INVALID_RESPONSE]:
        'Invalid response from LND. Please try again.',
    [LndErrorCode.STREAM_EOF]: 'Stream ended (expected).'
};

/** Raw message patterns that map to each error code (for matching native/stream errors) */
export const LND_ERROR_PATTERNS: Record<LndErrorCode, readonly string[]> = {
    [LndErrorCode.LND_FOLDER_MISSING]: [
        "doesn't exist",
        'does not exist',
        'no such file or directory',
        'wallet directory not found',
        'wallet may have been deleted'
    ],
    [LndErrorCode.WALLET_CREATION_UNLOCKED_TOO_QUICKLY]: [],
    [LndErrorCode.RPC_CONNECTION_CLOSED]: ['connection closed'],
    [LndErrorCode.RPC_READY_TIMEOUT]: [],
    [LndErrorCode.LND_FAILED_TO_STOP]: [],
    [LndErrorCode.LND_START_FAILED]: [],
    [LndErrorCode.GEN_SEED_FAILED]: [],
    [LndErrorCode.LND_READY_TIMEOUT]: [],
    [LndErrorCode.LND_ALREADY_RUNNING]: ['already started', 'already running'],
    [LndErrorCode.WALLET_LOCKED]: ['wallet locked'],
    [LndErrorCode.MACAROON_STORE_LOCKED]: [
        'macaroon store is locked',
        'cannot retrieve macaroon',
        'cannot get macaroon'
    ],
    [LndErrorCode.GEN_SEED_UNLOCKED]: [
        'wallet already unlocked',
        'WalletUnlocker service is no longer available'
    ],
    [LndErrorCode.RPC_NOT_READY]: [
        'starting up',
        'not yet ready to accept calls',
        'not yet ready',
        'uninitialized'
    ],
    [LndErrorCode.STOP_LND_EXPECTED]: [
        'unable to read TLS cert',
        'connection refused',
        'connection reset'
    ],
    [LndErrorCode.STREAM_INVALID_RESPONSE]: [],
    [LndErrorCode.STREAM_EOF]: [
        'EOF',
        'error reading from server: EOF',
        'channel event store shutting down'
    ]
};

/** Match a raw error message to an LndErrorCode (returns first match) */
export function matchRawErrorToCode(msg: string): LndErrorCode | null {
    const normalized = msg.toLowerCase();
    for (const [code, patterns] of Object.entries(LND_ERROR_PATTERNS)) {
        if (
            patterns.length > 0 &&
            patterns.some((p) => normalized.includes(p.toLowerCase()))
        ) {
            return code as LndErrorCode;
        }
    }
    return null;
}

/** Check if message matches a specific error code */
export function matchesLndErrorCode(msg: string, code: LndErrorCode): boolean {
    const patterns = LND_ERROR_PATTERNS[code];
    if (!patterns.length) return false;
    const normalized = msg.toLowerCase();
    return patterns.some((p) => normalized.includes(p.toLowerCase()));
}

/** Codes that indicate expected state when stopping LND  */
const STOP_LND_EXPECTED_CODES: LndErrorCode[] = [
    LndErrorCode.STOP_LND_EXPECTED,
    LndErrorCode.WALLET_LOCKED,
    LndErrorCode.RPC_CONNECTION_CLOSED,
    LndErrorCode.LND_FOLDER_MISSING,
    LndErrorCode.RPC_NOT_READY
];

/** Check if error is expected when stopping LND  */
export function isStopLndExpectedError(msg: string): boolean {
    return STOP_LND_EXPECTED_CODES.some((code) =>
        matchesLndErrorCode(msg, code)
    );
}

/** Transient RPC errors that may resolve with retry (node switch, startup, etc.) */
const TRANSIENT_RPC_ERROR_CODES: LndErrorCode[] = [
    LndErrorCode.RPC_CONNECTION_CLOSED,
    LndErrorCode.RPC_NOT_READY,
    LndErrorCode.MACAROON_STORE_LOCKED
];

/** Check if error message is a transient RPC error (retryable) */
export function isTransientRpcError(msg: string): boolean {
    return TRANSIENT_RPC_ERROR_CODES.some((code) =>
        matchesLndErrorCode(msg, code)
    );
}

export const MAX_TRANSIENT_RPC_RETRIES = 5;
export const TRANSIENT_RPC_RETRY_BASE_MS = 2000;

/**
 * Handles a transient RPC error with exponential backoff and a retry cap.
 * Calls `onRetry` after the delay, or throws if max retries is exceeded.
 *
 * @param error         - The original error to re-throw on give-up
 * @param errorMessage  - Human-readable error message for logging
 * @param context       - Short label used in log messages (e.g. 'startLnd error')
 * @param retryCount    - How many retries have already been attempted
 * @param setConnecting - Callback to toggle the connecting UI state
 * @param onRetry       - Callback invoked after the delay to schedule the next attempt
 */
export async function retryOnTransientError(
    error: unknown,
    errorMessage: string,
    context: string,
    retryCount: number,
    setConnecting: (v: boolean) => void,
    onRetry: () => void | Promise<void>
): Promise<void> {
    if (retryCount >= MAX_TRANSIENT_RPC_RETRIES) {
        console.error(
            `Transient ${context} persisted after max retries:`,
            errorMessage
        );
        setConnecting(false);
        throw error;
    }
    const delayMs = TRANSIENT_RPC_RETRY_BASE_MS * Math.pow(2, retryCount);
    console.log(
        `Transient ${context} - retry ${
            retryCount + 1
        }/${MAX_TRANSIENT_RPC_RETRIES} in ${delayMs}ms:`,
        errorMessage
    );
    setConnecting(false);
    await sleep(delayMs);
    setConnecting(true);
    await onRetry();
}

export function getErrorMessage(error: unknown): string {
    if (isLndError(error)) {
        const code = (error as { code?: LndErrorCode })?.code;
        if (code && LND_ERROR_MESSAGES[code]) {
            return LND_ERROR_MESSAGES[code];
        }
    }
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    if (error && typeof error === 'object' && 'message' in error) {
        return String((error as { message: unknown }).message);
    }
    return String(error ?? '');
}

export function createLndError(code: LndErrorCode, detail?: string): Error {
    const baseMessage = LND_ERROR_MESSAGES[code];
    const message = detail ? `${baseMessage} ${detail}`.trim() : baseMessage;
    const err = new Error(message) as Error & { code: LndErrorCode };
    err.code = code;
    return err;
}

export function isLndError(error: unknown, code?: LndErrorCode): boolean {
    const msg = error instanceof Error ? error.message : String(error ?? '');
    const errCode = (error as { code?: LndErrorCode })?.code;
    if (code) {
        return errCode === code || msg.includes(code);
    }
    return Object.values(LndErrorCode).some((c) => msg.includes(c));
}
