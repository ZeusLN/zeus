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

        // every string literal inside a localeString(...) call is a
        // candidate key, so keys that don't sit directly after the paren
        // are covered too, e.g. localeString(condition ? 'a' : 'b');
        // filtering on en.json's top-level namespaces keeps substitution
        // values from being mistaken for keys
        const namespaces = new Set(
            Object.keys(enLocale).map((key) => key.split('.')[0])
        );
        const literalRegExp = new RegExp(/(['"`])([^'"`\n]+)\1/, 'g');
        const call = 'localeString(';
        const keysIn = (source: string): string[] => {
            const keys: string[] = [];
            for (
                let i = source.indexOf(call);
                i !== -1;
                i = source.indexOf(call, i + call.length)
            ) {
                let j = i + call.length;
                for (let depth = 1; j < source.length && depth > 0; j++) {
                    const c = source[j];
                    if (c === "'" || c === '"' || c === '`') {
                        for (j++; j < source.length && source[j] !== c; j++)
                            if (source[j] === '\\') j++;
                    } else if (c === '(') depth++;
                    else if (c === ')') depth--;
                }
                const span = source.slice(i + call.length, j - 1);
                const lead = span.trimStart().match(/^(['"`])([^'"`\n]+)\1/);
                if (lead) keys.push(lead[2]);
                for (const match of span.matchAll(literalRegExp)) {
                    if (namespaces.has(match[2].split('.')[0]))
                        keys.push(match[2]);
                }
            }
            return keys;
        };

        const missing: { [key: string]: string[] } = {};
        sourceFiles.forEach((file) => {
            const source = fs
                .readFileSync(path.join(root, file))
                .toString('utf8');
            for (const key of keysIn(source)) {
                // keys ending in '.' are dynamic concatenation prefixes,
                // e.g. localeString('views.Channel.Total.' + kind)
                if (key.endsWith('.')) continue;
                // interpolated template keys are dynamic too,
                // e.g. localeString(`views.Tools.${action}`)
                if (key.includes('${')) continue;
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
