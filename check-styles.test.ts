import * as fs from 'fs';
import * as path from 'path';

describe('static style sheets', () => {
    it('must not contain themeColor() calls', () => {
        const dirs = fs
            .readdirSync('.', { withFileTypes: true })
            .filter((e) => e.isDirectory() && e.name !== 'node_modules')
            .map((e) => e.name);
        dirs.push('.');
        const tsxFiles = dirs.flatMap((dir) =>
            fs
                .readdirSync(dir, { recursive: dir !== '.' })
                .filter(
                    (file) =>
                        typeof file === 'string' &&
                        !file.startsWith('node_modules/') &&
                        file.toLowerCase().endsWith('.tsx')
                )
                .map((file) => path.join(dir, file as string))
        );
        const regExp = new RegExp(
            /\n[^\s][^\n]+StyleSheet\.create\(\{.*themeColor\(/,
            's'
        );
        const invalidFiles = tsxFiles.filter((file) =>
            fs.readFileSync(file).toString('utf8').match(regExp)
        );

        if (invalidFiles.length > 0) {
            throw new Error(
                'The following files contain static StyleSheets with themeColor() calls. ' +
                    'This is not allowed because the color then will not be updated when theme is changed.\n' +
                    invalidFiles.join('\n')
            );
        }
    });
});
