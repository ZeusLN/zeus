import * as fs from 'fs';
import * as path from 'path';

// React Native resolves a custom fontFamily by file name on Android and by
// PostScript name on iOS. A name with no matching bundled file is not an
// error: the text silently renders in the system font. These checks keep
// the names used in code, the font files and the native registrations in
// step.
const FONT_DIRS = ['assets/fonts', 'android/app/src/main/assets/fonts'];
const BODY_FONTS = ['Roboto-Regular', 'Roboto-Medium', 'Roboto-Bold'];
const SOURCE_DIRS = ['components', 'views', 'utils', 'stores', 'models'];
const SOURCE_FILE = /\.tsx?$/;

const sourceFiles = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const entryPath = path.join(dir, entry.name);
        if (entry.isDirectory()) return sourceFiles(entryPath);
        return SOURCE_FILE.test(entry.name) ? [entryPath] : [];
    });

const read = (file: string) => fs.readFileSync(file, 'utf8');

describe('font assets', () => {
    it.each(BODY_FONTS)('bundles %s for both platforms', (font) => {
        for (const dir of FONT_DIRS) {
            expect(fs.existsSync(path.join(dir, `${font}.ttf`))).toBe(true);
        }
    });

    it.each(BODY_FONTS)('registers %s with iOS', (font) => {
        expect(read('ios/zeus/Info.plist')).toContain(
            `<string>${font}.ttf</string>`
        );
        expect(read('ios/zeus.xcodeproj/project.pbxproj')).toContain(
            `${font}.ttf in Resources`
        );
    });

    it.each(BODY_FONTS)('lists %s in the asset manifests', (font) => {
        for (const platform of ['ios', 'android']) {
            const manifest = JSON.parse(
                read(`${platform}/link-assets-manifest.json`)
            );
            const paths = manifest.data.map((e: { path: string }) => e.path);
            expect(paths).toContain(`assets/fonts/${font}.ttf`);
        }
    });

    it('ships the Roboto licence next to the font files', () => {
        for (const dir of FONT_DIRS) {
            expect(
                read(path.join(dir, 'Roboto Open Font License.txt'))
            ).toContain('SIL Open Font License');
        }
    });

    it('only uses Roboto weights that are bundled', () => {
        const unknown: string[] = [];
        for (const file of SOURCE_DIRS.flatMap(sourceFiles)) {
            for (const match of read(file).matchAll(/Roboto-[A-Za-z]+/g)) {
                if (!BODY_FONTS.includes(match[0])) {
                    unknown.push(`${file}: ${match[0]}`);
                }
            }
        }
        expect(unknown).toEqual([]);
    });

    it('has no references left to PP Neue Montreal', () => {
        const stale = [...SOURCE_DIRS.flatMap(sourceFiles), 'App.tsx'].filter(
            (file) => /PPNeueMontreal/.test(read(file))
        );
        expect(stale).toEqual([]);
    });
});
