import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';

// The check is plain ESM run by node at postinstall, so drive it through a
// node child process instead of Jest's transform. Each run works on a copy of
// the 11.0.0 excerpt laid out where the check expects node_modules.

const FIXTURE = path.join(
    __dirname,
    'fixtures',
    'RNKeychainManager-11.0.0-excerpt.mm'
);
const MANAGER = 'node_modules/react-native-keychain/ios/RNKeychainManager';

// cloudSyncValue() as shipped in react-native-keychain 10.0.0, which treated
// a present cloudSync: false as true (oblador/react-native-keychain#800)
const PRESENCE_CHECK = `CFBooleanRef cloudSyncValue(NSDictionary *options)
{
  if (options && options[@"cloudSync"]) {
    return kCFBooleanTrue;
  }
  return kCFBooleanFalse;
}`;

const FIXED_SNIPPET = `CFBooleanRef cloudSyncValue(NSDictionary *options)
{
  id cloudSync = options[@"cloudSync"];
  if ([cloudSync isKindOfClass:[NSNumber class]] && [cloudSync boolValue]) {
    return kCFBooleanTrue;
  }
  return kCFBooleanFalse;
}`;

const verify = (root: string) =>
    execFileSync(
        process.execPath,
        [
            '--input-type=module',
            '-e',
            `const m = await import(${JSON.stringify(
                pathToFileURL(
                    path.join(__dirname, 'verify-keychain-cloudsync.mjs')
                ).href
            )}); m.verifyKeychainCloudSync();`
        ],
        { cwd: root, encoding: 'utf8', stdio: 'pipe' }
    );

describe('verify-keychain-cloudsync', () => {
    const roots: string[] = [];
    const tree = (
        source = fs.readFileSync(FIXTURE, 'utf8'),
        file = 'RNKeychainManager.mm'
    ) => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'keychain-check-'));
        roots.push(root);
        fs.mkdirSync(path.join(root, MANAGER), { recursive: true });
        fs.writeFileSync(path.join(root, MANAGER, file), source);
        return root;
    };

    afterAll(() => {
        roots.forEach((root) =>
            fs.rmSync(root, { recursive: true, force: true })
        );
    });

    it('the fixture carries the 11.0.0 cloudSyncValue()', () => {
        expect(fs.readFileSync(FIXTURE, 'utf8')).toContain(FIXED_SNIPPET);
    });

    it('passes on react-native-keychain 11.0.0 and leaves it unchanged', () => {
        const root = tree();
        const before = fs.readFileSync(
            path.join(root, MANAGER, 'RNKeychainManager.mm'),
            'utf8'
        );

        expect(verify(root)).toContain(
            'cloudSyncValue() respects cloudSync: false'
        );
        expect(
            fs.readFileSync(
                path.join(root, MANAGER, 'RNKeychainManager.mm'),
                'utf8'
            )
        ).toBe(before);
    });

    it('fails postinstall on the 10.0.0 presence check', () => {
        const root = tree(
            fs
                .readFileSync(FIXTURE, 'utf8')
                .replace(FIXED_SNIPPET, PRESENCE_CHECK)
        );

        expect(() => verify(root)).toThrow(/cloudSyncValue\(\) does not match/);
    });

    it.each([
        [
            'the NSNumber type check',
            '[cloudSync isKindOfClass:[NSNumber class]] && [cloudSync boolValue]',
            '[cloudSync boolValue]'
        ],
        [
            'the boolValue check',
            '[cloudSync isKindOfClass:[NSNumber class]] && [cloudSync boolValue]',
            '[cloudSync isKindOfClass:[NSNumber class]]'
        ],
        [
            'the false default',
            '  }\n  return kCFBooleanFalse;',
            '  }\n  return kCFBooleanTrue;'
        ]
    ])('fails postinstall when %s changes', (_name, original, changed) => {
        const source = fs.readFileSync(FIXTURE, 'utf8');
        expect(source).toContain(original);
        const root = tree(source.replace(original, changed));

        expect(() => verify(root)).toThrow(/cloudSyncValue\(\) does not match/);
    });

    it('fails postinstall when cloudSyncValue() appears twice', () => {
        const source = fs.readFileSync(FIXTURE, 'utf8');
        const root = tree(`${source}\n${FIXED_SNIPPET}\n`);

        expect(() => verify(root)).toThrow(/cloudSyncValue\(\) does not match/);
    });

    it('fails postinstall when only the pre-11.0.0 RNKeychainManager.m exists', () => {
        const root = tree(undefined, 'RNKeychainManager.m');

        expect(() => verify(root)).toThrow(/RNKeychainManager\.mm not found/);
    });
});
