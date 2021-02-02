class VersionUtils {
    parseVersion = (text: string) => {
        const [version, suffix] = text.split('-');
        const releaseVersion = suffix ? text.replace(`${version}-`, '') : null;

        const noPrefix = version.replace('v', '').replace('V', '');
        const [coreVersion, mainVersion, minorVersion] = noPrefix.split('.');

        return {
            coreVersion: coreVersion ? Number(coreVersion) : null,
            mainVersion: mainVersion ? Number(mainVersion) : null,
            minorVersion: minorVersion ? Number(minorVersion) : null,
            releaseVersion
        };
    };

    isSupportedVersion = (userVersion: string, targetVersion: string) => {
        const user = this.parseVersion(userVersion);
        const target = this.parseVersion(targetVersion);

        if (
            (user.coreVersion || target.coreVersion) &&
            user.coreVersion > target.coreVersion
        ) {
            return true;
        } else if (
            (user.mainVersion || target.mainVersion) &&
            user.coreVersion === target.coreVersion &&
            user.mainVersion > target.mainVersion
        ) {
            return true;
        } else if (
            (user.minorVersion || target.minorVersion) &&
            user.coreVersion === target.coreVersion &&
            user.mainVersion === target.mainVersion &&
            user.minorVersion >= target.minorVersion
        ) {
            return true;
        }

        return false;
    };
}

const versionUtils = new VersionUtils();
export default versionUtils;
