import * as fs from 'fs';
import * as path from 'path';

// On iOS an RNRestart reload keeps the process, so Linking.getInitialURL()
// still returns the URL that launched the app. LinkingUtils skips it when
// RNRestart.getReason() is set (startedByInAppRestart), so every RNRestart
// call that can run on iOS must pass IN_APP_RESTART. A call without it
// clears the reason, and the next JS runtime handles the launch URL again,
// even after a data wipe.
const SOURCE_DIRS = [
    'App.tsx',
    'backends',
    'components',
    'stores',
    'utils',
    'views'
];

// Calls that only run on Android, where the reason is never read
const ANDROID_ONLY = ['views/Wallet/Wallet.tsx: RNRestart.Restart()'];

const RESTART_CALL = /RNRestart\.(?:Restart|restart)\(([^)]*)\)/g;
const RESTART_IMPORT = /import\s+(\S+)\s+from\s+'react-native-restart'/;

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

const sourceLines = () =>
    SOURCE_DIRS.flatMap(sourceFiles).flatMap((file) =>
        fs
            .readFileSync(file)
            .toString('utf8')
            .split('\n')
            .map((line, index) => ({ file, line, number: index + 1 }))
            .filter(({ line }) => {
                const trimmed = line.trim();
                return !trimmed.startsWith('//') && !trimmed.startsWith('*');
            })
    );

describe('in-app restarts', () => {
    it('import react-native-restart as RNRestart', () => {
        const offenders = sourceLines()
            .filter(({ line }) => {
                const match = line.match(RESTART_IMPORT);
                return match && match[1] !== 'RNRestart';
            })
            .map(
                ({ file, line, number }) => `${file}:${number}: ${line.trim()}`
            );

        if (offenders.length > 0) {
            throw new Error(
                'Import react-native-restart as RNRestart so the restart ' +
                    'reason check below sees every call.\n' +
                    offenders.join('\n')
            );
        }
    });

    it('pass IN_APP_RESTART to RNRestart', () => {
        const offenders = sourceLines().flatMap(({ file, line, number }) =>
            Array.from(line.matchAll(RESTART_CALL))
                .filter(
                    (match) =>
                        match[1].trim() !== 'IN_APP_RESTART' &&
                        !ANDROID_ONLY.includes(`${file}: ${match[0]}`)
                )
                .map((match) => `${file}:${number}: ${match[0]}`)
        );

        if (offenders.length > 0) {
            throw new Error(
                'These RNRestart calls do not pass IN_APP_RESTART. On iOS ' +
                    'the next JS runtime would handle the launch URL again. ' +
                    'Use restartApp() or pass IN_APP_RESTART.\n' +
                    offenders.join('\n')
            );
        }
    });
});
