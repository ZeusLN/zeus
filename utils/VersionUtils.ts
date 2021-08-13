class VersionUtils {
    parseVersion = (text: string) => {
        const [version, suffix] = text.split('-');
        const releaseVersion = suffix ? text.replace(`${version}-`, '') : null;

        const noPrefix = version.replace('v', '').replace('V', '');
        const [coreVersion, mainVersion, minorVersion] = noPrefix.split('.');

        return {
            coreVersion: coreVersion ? Number(coreVersion) : 0,
            mainVersion: mainVersion ? Number(mainVersion) : 0,
            minorVersion: minorVersion ? Number(minorVersion) : 0,
            releaseVersion
        };
    };

    isSupportedVersion = (
        userVersion: string,
        minVersion: string,
        eosVersion?: string
    ) => {
        const user = this.parseVersion(userVersion);
        const min = this.parseVersion(minVersion);

        if (user.coreVersion < min.coreVersion) {
            return false;
        }
        if (
            user.coreVersion == min.coreVersion &&
            user.mainVersion < min.mainVersion
        ) {
            return false;
        }
        if (
            user.coreVersion == min.coreVersion &&
            user.mainVersion == min.mainVersion &&
            user.minorVersion < min.minorVersion
        ) {
            return false;
        }

        // end of support version
        if (eosVersion) {
            const eos = this.parseVersion(eosVersion);

            if (eos.coreVersion < user.coreVersion) {
                return false;
            } else if (
                eos.coreVersion == user.coreVersion &&
                eos.mainVersion < user.mainVersion
            ) {
                return false;
            } else if (
                eos.coreVersion == user.coreVersion &&
                eos.mainVersion == user.mainVersion &&
                eos.minorVersion < user.minorVersion
            ) {
                return false;
            }
        }

        return true;
    };
}

const versionUtils = new VersionUtils();
export default versionUtils;
