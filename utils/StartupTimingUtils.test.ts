import {
    __resetStartupTimingForTests,
    getSlowestStorageOps,
    getStartupMarks,
    getStartupTimingReport,
    getStorageOpStats,
    markStartupPhase,
    recordStorageOp,
    sealStartupTiming
} from './StartupTimingUtils';

describe('StartupTimingUtils', () => {
    beforeEach(() => {
        __resetStartupTimingForTests();
    });

    it('records marks in order with non-decreasing offsets', () => {
        markStartupPhase('bundleEvaluated');
        markStartupPhase('settingsLoaded');
        const marks = getStartupMarks();
        expect(marks.map((m) => m.name)).toEqual([
            'bundleEvaluated',
            'settingsLoaded'
        ]);
        expect(marks[1].atMs).toBeGreaterThanOrEqual(marks[0].atMs);
    });

    it('ignores duplicate marks', () => {
        markStartupPhase('settingsLoaded');
        markStartupPhase('settingsLoaded');
        expect(getStartupMarks().length).toBe(1);
    });

    it('stops recording after sealing', () => {
        markStartupPhase('connectComplete');
        sealStartupTiming();
        markStartupPhase('afterSeal');
        recordStorageOp('get', 'zeus-settings-v2', 5);
        expect(getStartupMarks().map((m) => m.name)).toEqual([
            'connectComplete'
        ]);
        expect(getStorageOpStats()).toEqual({});
    });

    it('aggregates storage op stats and keeps the slowest ops', () => {
        for (let i = 1; i <= 12; i++) {
            recordStorageOp('get', `key-${i}`, i * 10);
        }
        recordStorageOp('set', 'zeus-settings-v2', 40);

        const stats = getStorageOpStats();
        expect(stats.get.count).toBe(12);
        expect(stats.get.maxMs).toBe(120);
        expect(stats.get.totalMs).toBe(780);
        expect(stats.set.count).toBe(1);

        const slowest = getSlowestStorageOps();
        expect(slowest.length).toBe(10);
        expect(slowest[0].durationMs).toBe(120);
        expect(slowest[slowest.length - 1].durationMs).toBeLessThanOrEqual(
            slowest[0].durationMs
        );
    });

    it('redacts long keys that may embed hashes or pubkeys', () => {
        const hashKey =
            'lnurlpay:2f9d1c4e8b7a6f5d4c3b2a190817263544536271809f8e7d6c5b4a3928171605';
        recordStorageOp('get', hashKey, 7);
        const slowest = getSlowestStorageOps();
        expect(slowest[0].key).not.toContain(hashKey.slice(24));
        expect(slowest[0].key).toContain(`len ${hashKey.length}`);
    });

    it('renders a report with deltas and stats', () => {
        markStartupPhase('bundleEvaluated');
        recordStorageOp('get', 'zeus-settings-v2', 25);
        const report = getStartupTimingReport();
        expect(report).toContain('bundleEvaluated');
        expect(report).toContain('Keychain ops before connect:');
        expect(report).toContain('get: n=1 total=25ms max=25ms');
        expect(report).toContain('25ms get zeus-settings-v2');
    });
});
