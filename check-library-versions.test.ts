import * as fs from 'fs';

// fetch-libraries.sh downloads the version pinned in
// fetch-libraries-versions.json, but the iOS pods that vendor those
// frameworks carry their own version in a podspec and in Podfile.lock.
// Bumping only the pin leaves the pod metadata on the old version, as
// happened with the CDK 0.18.0 bump.
const versions = JSON.parse(
    fs.readFileSync('fetch-libraries-versions.json', 'utf8')
);
const podfileLock = fs.readFileSync('ios/Podfile.lock', 'utf8');

const PODS = [
    { pin: 'cdk', pod: 'CashuDevKit' },
    { pin: 'zeus-cashu-restore', pod: 'ZeusCashuRestore' }
];

describe('vendored library versions', () => {
    it.each(PODS)('$pod podspec matches the $pin pin', ({ pin, pod }) => {
        const podspec = fs.readFileSync(`ios/${pod}.podspec`, 'utf8');
        const match = podspec.match(/s\.version\s*=\s*'([^']+)'/);
        expect(match?.[1]).toBe(versions[pin].version);
    });

    it.each(PODS)(
        '$pod Podfile.lock entry matches the $pin pin',
        ({ pin, pod }) => {
            const match = podfileLock.match(
                new RegExp(`^  - ${pod} \\(([^)]+)\\)$`, 'm')
            );
            expect(match?.[1]).toBe(versions[pin].version);
        }
    );
});
