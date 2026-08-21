import SyncUtils from './SyncUtils';

const { estimateBestBlockHeight } = SyncUtils;

describe('SyncUtils', () => {
    describe('estimateBestBlockHeight', () => {
        const NOW_MS = 1_770_000_000_000; // fixed clock
        const NOW_SECONDS = NOW_MS / 1000;

        it('returns the current height when headers are at the tip', () => {
            expect(
                estimateBestBlockHeight(962218, NOW_SECONDS, NOW_MS)
            ).toEqual(962218);
        });

        it('adds one block per ten minutes of header lag', () => {
            expect(
                estimateBestBlockHeight(962000, NOW_SECONDS - 3600, NOW_MS)
            ).toEqual(962006);
            expect(
                estimateBestBlockHeight(900000, NOW_SECONDS - 86400, NOW_MS)
            ).toEqual(900144);
        });

        it('accepts string timestamps as returned by GetInfo', () => {
            expect(
                estimateBestBlockHeight(
                    962000,
                    String(NOW_SECONDS - 1200),
                    NOW_MS
                )
            ).toEqual(962002);
        });

        it('ignores partial-interval lag', () => {
            expect(
                estimateBestBlockHeight(962218, NOW_SECONDS - 599, NOW_MS)
            ).toEqual(962218);
        });

        it('never subtracts when the header timestamp is in the future', () => {
            expect(
                estimateBestBlockHeight(962218, NOW_SECONDS + 7200, NOW_MS)
            ).toEqual(962218);
        });

        it('falls back to the current height without a usable timestamp', () => {
            expect(estimateBestBlockHeight(962218, undefined, NOW_MS)).toEqual(
                962218
            );
            expect(estimateBestBlockHeight(962218, 'garbage', NOW_MS)).toEqual(
                962218
            );
            expect(estimateBestBlockHeight(962218, 0, NOW_MS)).toEqual(962218);
        });

        it('returns 0 when the node has not reported a height yet', () => {
            expect(
                estimateBestBlockHeight(0, NOW_SECONDS - 3600, NOW_MS)
            ).toEqual(0);
        });
    });
});
