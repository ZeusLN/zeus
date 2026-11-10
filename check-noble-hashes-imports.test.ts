import * as fs from 'fs';
import * as path from 'path';

// @noble/hashes 2.x exports only `.js` subpaths (`@noble/hashes/sha2.js`,
// `@noble/hashes/utils.js`) and drops `./sha256`. 1.8.0 exports both forms,
// so importing the `.js` paths now keeps the 2.x bump a version-only change.
const SOURCE_DIRS = [
    'App.tsx',
    'backends',
    'components',
    'hooks',
    'models',
    'stores',
    'utils',
    'views',
    'zeus_modules'
];

const NOBLE_HASHES_SUBPATH = /['"]@noble\/hashes\/([^'"]+)['"]/g;
const LEGACY_HASH_IMPORT =
    /(?:from\s+|import\s*\(?\s*|require\(\s*)['"](create-hash|fast-sha256|hash\.js|js-sha256|object-hash|scrypt-js|sha\.js)(?:\/[^'"]*)?['"]/;
const SCRYPT_WRAPPER = path.join('utils', 'HashingUtils.ts');

const sourceFiles = (entry: string): string[] => {
    if (!fs.existsSync(entry)) return [];
    if (!fs.statSync(entry).isDirectory()) return [entry];
    return (
        fs
            .readdirSync(entry, { recursive: true })
            // @ts-ignore:next-line
            .filter(
                (file: any) =>
                    typeof file === 'string' &&
                    !file.split(path.sep).includes('node_modules') &&
                    /\.(t|j)sx?$/.test(file)
            )
            .map((file: any) => path.join(entry, file as string))
    );
};

describe('@noble/hashes imports', () => {
    it('use .js subpaths', () => {
        const offenders = SOURCE_DIRS.flatMap(sourceFiles).flatMap((file) =>
            fs
                .readFileSync(file)
                .toString('utf8')
                .split('\n')
                .map((line, index) => ({ line, number: index + 1 }))
                .filter(({ line }) =>
                    [...line.matchAll(NOBLE_HASHES_SUBPATH)].some(
                        ([, subpath]) => !subpath.endsWith('.js')
                    )
                )
                .map(({ line, number }) => `${file}:${number}: ${line.trim()}`)
        );

        expect(offenders).toEqual([]);
    });

    it('rejects legacy hash package imports', () => {
        const offenders = SOURCE_DIRS.flatMap(sourceFiles).flatMap((file) =>
            fs
                .readFileSync(file)
                .toString('utf8')
                .split('\n')
                .map((line, index) => ({ line, number: index + 1 }))
                .filter(({ line }) => {
                    const match = line.match(LEGACY_HASH_IMPORT);
                    if (!match) return false;
                    return file !== SCRYPT_WRAPPER || match[1] !== 'scrypt-js';
                })
                .map(({ line, number }) => `${file}:${number}: ${line.trim()}`)
        );

        expect(offenders).toEqual([]);
    });
});
