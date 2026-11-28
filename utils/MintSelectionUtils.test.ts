import { resolveSelectedMintUrls } from './MintSelectionUtils';

describe('MintSelectionUtils', () => {
    const recommended = [
        'https://mint-a.example',
        'https://mint-b.example',
        'https://mint-c.example'
    ];

    describe('resolveSelectedMintUrls', () => {
        it('selects every recommended mint when the user has not touched the selection', () => {
            expect(resolveSelectedMintUrls(null, recommended)).toEqual(
                recommended
            );
        });

        it('returns a copy, not the same array reference, for the default case', () => {
            const result = resolveSelectedMintUrls(null, recommended);
            expect(result).not.toBe(recommended);
        });

        it('honors an explicit subset selection', () => {
            expect(
                resolveSelectedMintUrls(
                    ['https://mint-a.example', 'https://mint-c.example'],
                    recommended
                )
            ).toEqual(['https://mint-a.example', 'https://mint-c.example']);
        });

        it('honors an explicit empty selection (user deselected every mint)', () => {
            // This is the security-relevant case: recommended mints must not be
            // trusted with funds when the user has deselected them all.
            expect(resolveSelectedMintUrls([], recommended)).toEqual([]);
        });

        it('drops stale selections that are no longer recommended', () => {
            expect(
                resolveSelectedMintUrls(
                    ['https://mint-a.example', 'https://mint-gone.example'],
                    recommended
                )
            ).toEqual(['https://mint-a.example']);
        });

        it('returns empty when there are no recommendations to choose from', () => {
            expect(
                resolveSelectedMintUrls(['https://mint-a.example'], [])
            ).toEqual([]);
            expect(resolveSelectedMintUrls(null, [])).toEqual([]);
        });
    });
});
