import * as fs from 'fs';
import * as path from 'path';

// A settings write built by spreading a group (or the nodes array) out of
// SettingsStore.settings copies whatever the store held when the handler
// ran. If an earlier write is still queued, the copy carries that write's
// old values and reverts them (#4903). Use
// SettingsStore.updateSettingsGroup, or the functional updateSettings
// form, so the merge happens inside the queue.
const SOURCE_DIRS = [
    'App.tsx',
    'backends',
    'components',
    'stores',
    'utils',
    'views'
];

// `...settings.invoices`, `...SettingsStore.settings.nodes`,
// `...this.settingsStore.settings?.ecash`
const SETTINGS_SPREAD =
    /\.\.\.(?:[A-Za-z_$][\w$]*\??\.)*settings\??\.[A-Za-z_$][\w$]*/;

const sourceFiles = (entry: string): string[] => {
    if (!fs.statSync(entry).isDirectory()) return [entry];
    return (
        fs
            .readdirSync(entry, { recursive: true })
            // @ts-ignore:next-line
            .filter(
                (file: any) =>
                    typeof file === 'string' &&
                    /\.tsx?$/.test(file) &&
                    !/\.test\.tsx?$/.test(file)
            )
            .map((file: any) => path.join(entry, file as string))
    );
};

describe('settings writes', () => {
    it('do not spread settings groups from SettingsStore.settings', () => {
        const offenders = SOURCE_DIRS.flatMap(sourceFiles).flatMap((file) =>
            fs
                .readFileSync(file)
                .toString('utf8')
                .split('\n')
                .map((line, index) => ({ line, number: index + 1 }))
                .filter(({ line }) => {
                    const trimmed = line.trim();
                    return (
                        !trimmed.startsWith('//') &&
                        !trimmed.startsWith('*') &&
                        SETTINGS_SPREAD.test(line)
                    );
                })
                .map(({ line, number }) => `${file}:${number}: ${line.trim()}`)
        );

        if (offenders.length > 0) {
            throw new Error(
                'These lines spread a settings group out of SettingsStore.settings. ' +
                    'A write built this way reverts any earlier write still in the queue. ' +
                    'Use updateSettingsGroup or the functional updateSettings form instead.\n' +
                    offenders.join('\n')
            );
        }
    });
});
