// Lockstep scan of MainActivity.kt (Kotlin is not exercised by Jest).
//
// Android takes a Recents snapshot of the activity when it leaves the
// foreground. Zeus can be showing credentials at that point (the LndHub
// account QR holds lndhub://user:password@host), and the snapshot is
// visible without the Zeus PIN. setRecentsScreenshotEnabled only exists
// on API 33+, so API 28 to 32 need the hidden setDisablePreviewScreenshots,
// with FLAG_SECURE while paused as the fallback.

import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.join(__dirname, 'MainActivity.kt'), 'utf8');

// Body of `fun <name>(` up to the next member declaration at class level.
const member = (name: string): string => {
    const start = source.search(
        new RegExp(`\\n    (?:private |override )?fun ${name}\\(`)
    );
    expect(start).toBeGreaterThan(-1);
    const rest = source.slice(start + 1);
    const end = rest.search(/\n    (?:\/\/|private |override |companion )/);
    return end === -1 ? rest : rest.slice(0, end);
};

describe('MainActivity Recents snapshot protection', () => {
    it('disables Recents snapshots on API 33+ and on API 28 to 32', () => {
        expect(member('onCreate')).toMatch(
            /if \(Build\.VERSION\.SDK_INT >= Build\.VERSION_CODES\.TIRAMISU\) \{\s*setRecentsScreenshotEnabled\(false\)[^\n]*\n\s*\} else \{\s*useSecureFallback = !disablePreviewScreenshots\(\)\s*\}/
        );
    });

    it('calls the hidden setDisablePreviewScreenshots(true)', () => {
        const body = member('disablePreviewScreenshots');
        expect(body).toMatch(
            /\.getMethod\("setDisablePreviewScreenshots", Boolean::class\.javaPrimitiveType\)\s*\.invoke\(this, true\)\s*true/
        );
        expect(body).toMatch(/catch \(e: Exception\) \{[^}]*false\s*\}/);
    });

    it('sets FLAG_SECURE in onPause only for the fallback, before super', () => {
        const body = member('onPause');
        const add = body.indexOf(
            'window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)'
        );
        expect(add).toBeGreaterThan(-1);
        expect(body).toMatch(
            /if \(useSecureFallback &&\s*\(window\.attributes\.flags and WindowManager\.LayoutParams\.FLAG_SECURE\) == 0\s*\)/
        );
        expect(body.indexOf('secureFallbackApplied = true')).toBeGreaterThan(
            add
        );
        expect(body.indexOf('super.onPause()')).toBeGreaterThan(add);
    });

    it('clears only its own FLAG_SECURE in onResume', () => {
        expect(member('onResume')).toMatch(
            /super\.onResume\(\)\s*if \(secureFallbackApplied\) \{\s*window\.clearFlags\(WindowManager\.LayoutParams\.FLAG_SECURE\)\s*secureFallbackApplied = false\s*\}/
        );
    });
});
