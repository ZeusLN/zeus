import RNFS from 'react-native-fs';

// The node-config export/import staging paths and their sweep live here, apart
// from NodeConfigUtils, so the sweep can be reached from DataClearUtils and
// SettingsStore without pulling in NodeConfigUtils, which imports SettingsStore
// (a cycle, since SettingsStore is where the launch sweep runs) along with the
// document-picker native module.

export const NODE_CONFIG_EXPORT_SUFFIX = '.zeus-wallet-config-backup';

// Every path the export and import flows stage under app-private cache. The
// plaintext ones hold the full node list, seed phrases included, because the
// native crypto API is file-based and has to be handed a file to encrypt.
// Anything staged here must also be listed in the sweep below, so keep the two
// together: a staging file the sweep does not know about is one nothing
// deletes after a crash.
export const nodeConfigStagingPaths = (): {
    exportPlain: string;
    exportEnc: string;
    importPlain: string;
    importEnc: string;
    legacyExportDir: string;
} => {
    const cacheDir = RNFS.CachesDirectoryPath;
    return {
        exportPlain: `${cacheDir}/zeus-nodeconfig-plain.tmp`,
        exportEnc: `${cacheDir}/zeus-nodeconfig-enc.tmp`,
        importPlain: `${cacheDir}/zeus-nodeconfig-import-plain.tmp`,
        importEnc: `${cacheDir}/zeus-nodeconfig-import-enc.tmp`,
        // share-sheet staging dir used by earlier builds of this flow
        legacyExportDir: `${cacheDir}/nodeconfig-exports`
    };
};

export const safeUnlinkStagingPath = async (path: string): Promise<void> => {
    try {
        if (await RNFS.exists(path)) {
            await RNFS.unlink(path);
        }
    } catch (e) {
        console.warn('Failed to remove temp node-config file:', e);
    }
};

/**
 * Removes whatever the node-config export and import flows left staged in
 * app-private cache.
 *
 * Both flows unlink their own temporary files in a finally block, so a staged
 * file only survives a run that never reached it: a crash, an OS kill, or a
 * force-stop between writing the plaintext and removing it. That remnant is a
 * plaintext copy of every node config, seed phrases included, and nothing else
 * in the app ever deletes it.
 *
 * Called on wipe, where leaving seed material behind would break the promise
 * the wipe makes (the duress wipe exists precisely to destroy it under
 * coercion), and at launch, so a remnant does not sit in cache indefinitely
 * waiting for the next export to sweep it.
 */
export const purgeNodeConfigStagingFiles = async (): Promise<void> => {
    const paths = nodeConfigStagingPaths();
    for (const path of Object.values(paths)) {
        await safeUnlinkStagingPath(path);
    }

    // A completed export also stages the encrypted envelope under its
    // user-facing name before the save dialog copies it to the destination.
    try {
        const entries = await RNFS.readDir(RNFS.CachesDirectoryPath);
        for (const entry of entries) {
            if (
                entry.isFile() &&
                entry.name.endsWith(NODE_CONFIG_EXPORT_SUFFIX)
            ) {
                await safeUnlinkStagingPath(entry.path);
            }
        }
    } catch (e) {
        console.warn('Failed to sweep staged node-config exports:', e);
    }
};
