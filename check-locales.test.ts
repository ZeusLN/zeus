import * as fs from 'fs';
import * as path from 'path';

const enLocale: { [key: string]: string } = require('./locales/en.json');

describe('locale keys', () => {
    it('every localeString() literal key must exist in locales/en.json', () => {
        // anchor the scan to the repo root (where this test lives) so
        // results don't depend on the working directory jest runs from
        const root = __dirname;
        const dirs = fs
            .readdirSync(root, { withFileTypes: true })
            .filter(
                (e) =>
                    e.isDirectory() &&
                    e.name !== 'node_modules' &&
                    e.name !== 'zeus_modules' &&
                    !e.name.startsWith('.')
            )
            .map((e) => e.name);
        dirs.push('.');
        const sourceFiles = dirs.flatMap((dir) =>
            fs
                .readdirSync(path.join(root, dir), { recursive: dir !== '.' })
                // @ts-ignore:next-line
                .filter(
                    (file: any) =>
                        typeof file === 'string' &&
                        !file.includes('node_modules') &&
                        (file.endsWith('.ts') || file.endsWith('.tsx')) &&
                        !file.endsWith('.d.ts') &&
                        !file.endsWith('.test.ts') &&
                        !file.endsWith('.test.tsx')
                )
                .map((file: any) => path.join(dir, file as string))
        );

        const keyRegExp = new RegExp(/localeString\(\s*['"]([^'"]+)['"]/, 'gs');
        const missing: { [key: string]: string[] } = {};
        sourceFiles.forEach((file) => {
            const source = fs
                .readFileSync(path.join(root, file))
                .toString('utf8');
            for (const match of source.matchAll(keyRegExp)) {
                const key = match[1];
                // keys ending in '.' are dynamic concatenation prefixes,
                // e.g. localeString('views.Channel.Total.' + kind)
                if (key.endsWith('.')) continue;
                if (!(key in enLocale)) {
                    if (!missing[key]) missing[key] = [];
                    if (!missing[key].includes(file)) missing[key].push(file);
                }
            }
        });

        const missingKeys = Object.keys(missing).sort();
        if (missingKeys.length > 0) {
            throw new Error(
                'The following locale keys are referenced via localeString() ' +
                    'but do not exist in locales/en.json, so they render as ' +
                    'undefined at runtime:\n' +
                    missingKeys
                        .map((key) => `${key} (${missing[key].join(', ')})`)
                        .join('\n')
            );
        }
    });
});
