import VersionUtils from './VersionUtils';

describe('VersionUtils', () => {
    describe('parseVersion', () => {
        it('Parses versions', () => {
            expect(VersionUtils.parseVersion('v0.3.0-beta-1')).toEqual({
                coreVersion: 0,
                mainVersion: 3,
                minorVersion: 0,
                releaseVersion: 'beta-1'
            });
            expect(VersionUtils.parseVersion('v11.3-beta-2')).toEqual({
                coreVersion: 11,
                mainVersion: 3,
                minorVersion: 0,
                releaseVersion: 'beta-2'
            });
            expect(VersionUtils.parseVersion('V11.4')).toEqual({
                coreVersion: 11,
                mainVersion: 4,
                minorVersion: 0,
                releaseVersion: null
            });
            expect(VersionUtils.parseVersion('v0.0.2')).toEqual({
                coreVersion: 0,
                mainVersion: 0,
                minorVersion: 2,
                releaseVersion: null
            });
        });
    });

    describe('isSupportedVersion', () => {
        it('Determines if users version is supported', () => {
            expect(
                VersionUtils.isSupportedVersion('v0.3.0-beta-1', 'v0.4.1')
            ).toEqual(false);
            expect(
                VersionUtils.isSupportedVersion('v0.3.0-beta-1', 'v0.0.2')
            ).toEqual(true);
            expect(
                VersionUtils.isSupportedVersion('v0.3.0-beta-1', 'V0.2')
            ).toEqual(true);
            expect(VersionUtils.isSupportedVersion('v0.3', 'V0.3.9')).toEqual(
                false
            );
        });

        it('Determines if users version is supported when an end of support version is specified', () => {
            expect(
                VersionUtils.isSupportedVersion(
                    'v2.3.0-beta-1',
                    'v1.0.2',
                    'v3.2.2'
                )
            ).toEqual(true);
            expect(
                VersionUtils.isSupportedVersion(
                    'v0.3.0-beta-1',
                    'v0.0.2',
                    'v0.2.2'
                )
            ).toEqual(false);
            expect(
                VersionUtils.isSupportedVersion(
                    'v0.3.0-beta-1',
                    'v0.0.2',
                    'v0.3.1'
                )
            ).toEqual(true);
            expect(
                VersionUtils.isSupportedVersion('v0.3.0', 'v0.0.2', 'v0.3.0')
            ).toEqual(true);
            expect(
                VersionUtils.isSupportedVersion(
                    'v0.3.0-beta-1',
                    'v0.0.2',
                    'v0.3.0'
                )
            ).toEqual(true);
            expect(
                VersionUtils.isSupportedVersion(
                    'v0.3.0-beta-1',
                    'v0.0.2',
                    'v0.3.1-alpha-2'
                )
            ).toEqual(true);
            expect(
                VersionUtils.isSupportedVersion('v0.3.1', 'v0.0.2', 'v0.3.1')
            ).toEqual(true);
            expect(
                VersionUtils.isSupportedVersion(
                    'v0.3.1-beta-1',
                    'v0.0.2',
                    'v0.3.1'
                )
            ).toEqual(true);
            expect(
                VersionUtils.isSupportedVersion('v0.3.2', 'v0.0.2', 'v0.3.1')
            ).toEqual(false);
        });
    });
});
