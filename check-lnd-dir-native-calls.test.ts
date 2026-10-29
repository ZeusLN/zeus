import * as fs from 'fs';
import * as path from 'path';

// These native methods join lndDir onto app storage paths without checking
// it. The functions in utils/LndMobileUtils.ts call assertValidNodeDir
// before reaching them, so every other caller has to go through those
// functions. tailLog and observeLndLogFile are left out: they only read
// logs/bitcoin/<network>/lnd.log under the dir.
const ALLOWED_FILES = ['utils/LndMobileUtils.ts', 'lndmobile/index.ts'];

const SOURCE_DIRS = [
    'App.tsx',
    'backends',
    'components',
    'lndmobile',
    'stores',
    'utils',
    'views'
];

// `NativeModules.LndMobileTools.writeConfig(`, `LndMobile.startLnd(`.
// Methods taken by destructuring (`const { writeConfig } =
// NativeModules.LndMobileTools`) are not caught.
const LND_DIR_NATIVE_CALL =
    /\bLndMobile(?:Tools)?\??\.(?:writeConfig|repairGraphDb|resetGraphDb|deleteLndDirectory|DEBUG_deleteNeutrinoFiles|checkLndFolderExists|createIOSApplicationSupportAndLndDirectories|excludeLndICloudBackup|startLnd|gossipSync)\b/;

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
                    !/\.test\.tsx?$/.test(file) &&
                    !/\.d\.ts$/.test(file)
            )
            .map((file: any) => path.join(entry, file as string))
    );
};

describe('native calls that take lndDir', () => {
    it('only happen in utils/LndMobileUtils.ts and lndmobile/index.ts', () => {
        const offenders = SOURCE_DIRS.flatMap(sourceFiles)
            .filter((file) => !ALLOWED_FILES.includes(file))
            .flatMap((file) =>
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
                            LND_DIR_NATIVE_CALL.test(line)
                        );
                    })
                    .map(
                        ({ line, number }) =>
                            `${file}:${number}: ${line.trim()}`
                    )
            );

        if (offenders.length > 0) {
            throw new Error(
                'These lines call a native method that takes lndDir directly. ' +
                    'Call the helper in utils/LndMobileUtils.ts instead, so ' +
                    'assertValidNodeDir runs first.\n' +
                    offenders.join('\n')
            );
        }
    });
});
