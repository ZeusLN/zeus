// Session-only startup phase timing. Imported first from index.js so t0
// approximates JS engine start; nothing here is persisted and collection
// stops once the first connect completes (sealStartupTiming), so steady-state
// operation records nothing. Kept dependency-free: this module is evaluated
// before shims and polyfills.

export interface StartupMark {
    name: string;
    atMs: number;
    wallClock: number;
}

export interface StorageOpStats {
    count: number;
    totalMs: number;
    maxMs: number;
}

export interface SlowStorageOp {
    op: string;
    key: string;
    durationMs: number;
}

const SLOWEST_OPS_KEPT = 10;
// Key names can embed payment hashes and node pubkeys; reports are meant to
// be copy-pasted into support channels, so anything longer is truncated.
const KEY_REDACT_LENGTH = 24;

let t0 = Date.now();
let sealed = false;
let marks: StartupMark[] = [];
let markedNames = new Set<string>();
let statsByOp: { [op: string]: StorageOpStats } = {};
let slowestOps: SlowStorageOp[] = [];

const redactKey = (key: string): string =>
    key.length > KEY_REDACT_LENGTH
        ? `${key.slice(0, KEY_REDACT_LENGTH)}…(len ${key.length})`
        : key;

export const markStartupPhase = (name: string): void => {
    if (sealed || markedNames.has(name)) return;
    markedNames.add(name);
    const now = Date.now();
    marks.push({ name, atMs: now - t0, wallClock: now });
    // Surfaced in adb logcat (ReactNativeJS) so device bug reports carry
    // phase timestamps even if the in-app report is never opened
    console.log(`[StartupTiming] ${name} +${now - t0}ms`);
};

export const sealStartupTiming = (): void => {
    sealed = true;
};

export const recordStorageOp = (
    op: string,
    key: string,
    durationMs: number
): void => {
    if (sealed) return;
    const stats =
        statsByOp[op] || (statsByOp[op] = { count: 0, totalMs: 0, maxMs: 0 });
    stats.count++;
    stats.totalMs += durationMs;
    if (durationMs > stats.maxMs) stats.maxMs = durationMs;

    slowestOps.push({ op, key: redactKey(key), durationMs });
    slowestOps.sort((a, b) => b.durationMs - a.durationMs);
    if (slowestOps.length > SLOWEST_OPS_KEPT) {
        slowestOps = slowestOps.slice(0, SLOWEST_OPS_KEPT);
    }
};

export const getStartupMarks = (): StartupMark[] => [...marks];

export const getStorageOpStats = (): { [op: string]: StorageOpStats } => ({
    ...statsByOp
});

export const getSlowestStorageOps = (): SlowStorageOp[] => [...slowestOps];

export const getStartupTimingReport = (): string => {
    const lines: string[] = [
        `Startup timing (t0 = ${new Date(t0).toISOString()})`
    ];
    let previousAtMs = 0;
    marks.forEach((mark) => {
        lines.push(
            `+${mark.atMs}ms ${mark.name} (Δ ${mark.atMs - previousAtMs}ms)`
        );
        previousAtMs = mark.atMs;
    });
    const opNames = Object.keys(statsByOp);
    if (opNames.length > 0) {
        lines.push('Keychain ops before connect:');
        opNames.forEach((op) => {
            const s = statsByOp[op];
            lines.push(
                `  ${op}: n=${s.count} total=${s.totalMs}ms max=${s.maxMs}ms`
            );
        });
    }
    if (slowestOps.length > 0) {
        lines.push('Slowest keychain ops:');
        slowestOps.forEach((s) => {
            lines.push(`  ${s.durationMs}ms ${s.op} ${s.key}`);
        });
    }
    return lines.join('\n');
};

// Test hook: collection state is module-level so real usage needs no wiring
export const __resetStartupTimingForTests = (): void => {
    t0 = Date.now();
    sealed = false;
    marks = [];
    markedNames = new Set<string>();
    statsByOp = {};
    slowestOps = [];
};

markStartupPhase('jsStart');
