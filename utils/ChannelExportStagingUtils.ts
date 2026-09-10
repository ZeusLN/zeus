import { Platform } from 'react-native';
import RNFS from 'react-native-fs';

// Staging for the channel backup export, kept in a module of its own so the
// sweeps can be reached from MigrationUtils and DataClearUtils without
// pulling in ChannelMigrationUtils, which imports ChannelBackupStore ->
// SettingsStore (a cycle, since SettingsStore reaches MigrationUtils) along
// with the react-native-share and react-native-restart native modules.

export const CHANNEL_EXPORT_STAGING_DIR = 'channel-export-staging';

export const channelExportStagingPath = (): string =>
    `${RNFS.CachesDirectoryPath}/${CHANNEL_EXPORT_STAGING_DIR}`;

// Removes the staging directory. The staged zip cannot be unlinked as soon
// as Share.open settles: on iOS the completion handler can fire while an
// activity extension is still loading the NSItemProvider, so an immediate
// unlink hands the receiver a dead file while the export reports success -
// for a channel database, where a silently empty backup means channels that
// cannot be recovered. Instead each export sweeps the previous attempt,
// export failures sweep immediately (nothing was handed off at that point,
// which also covers a partially written zip), app launch sweeps whatever
// the post-export restart left behind, and clearAllData sweeps it on wipe.
export const purgeChannelExportStaging = async (): Promise<void> => {
    try {
        const dir = channelExportStagingPath();
        if (await RNFS.exists(dir)) await RNFS.unlink(dir);
    } catch (e) {
        console.warn('Error purging channel export staging:', e);
    }
};

// exportChannelDb names its zip `zeus-lnd-<network>-<Date.now()>.zip`, and
// only mainnet and testnet reach it (embedded LND has no other networks).
// Anchored to exactly that shape so a user file that merely starts with the
// same prefix - a renamed copy of an old export, say - is not swept up.
export const LEGACY_CHANNEL_EXPORT_REGEX =
    /^zeus-lnd-(mainnet|testnet)-\d+\.zip$/;

// Best-effort removal of channel backups older builds left in shared
// storage. Those staged the zip in the Files-visible iOS Documents
// directory and only unlinked it once the share settled, so an export
// interrupted before then (app killed, crash) left the backup there
// indefinitely, swept into iCloud/iTunes backups, with nothing to clean it
// up. Android is not affected: it has always staged in Caches, and its copy
// in Downloads is deliberate and user-visible.
export const purgeLegacyChannelExports = async (): Promise<void> => {
    if (Platform.OS !== 'ios') return;
    try {
        const entries = await RNFS.readDir(RNFS.DocumentDirectoryPath);
        for (const entry of entries) {
            if (
                entry.isFile() &&
                LEGACY_CHANNEL_EXPORT_REGEX.test(entry.name)
            ) {
                try {
                    await RNFS.unlink(entry.path);
                    console.log('Legacy channel export deleted:', entry.path);
                } catch (e) {
                    console.warn('Error deleting legacy channel export:', e);
                }
            }
        }
    } catch (e) {
        console.warn('Error purging legacy channel exports:', e);
    }
};
