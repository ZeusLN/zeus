import type { Settings } from '../stores/SettingsStore';

type RecoverySettings = Pick<Settings, 'recovery' | 'recoveryWalletDirs'>;

/**
 * Whether the wallet with the given data directory (lndDir or ldkNodeDir)
 * still has a recovery from seed pending. Settings written by versions that
 * kept only the install-wide flag hold no list; see bindLegacyRecovery.
 */
export const isRecoveryPending = (
    settings: Partial<RecoverySettings> | undefined,
    walletDir?: string
): boolean => {
    if (!settings?.recovery) return false;
    if (!Array.isArray(settings.recoveryWalletDirs)) return true;
    return !!walletDir && settings.recoveryWalletDirs.includes(walletDir);
};

/**
 * Settings update that marks a restored wallet as pending recovery, next
 * to any earlier restore that has not completed yet. Entries left behind
 * while the flag is off (an older version cleared it) are dropped.
 */
export const addRecoveryWallet = (
    current: Partial<RecoverySettings>,
    walletDir: string
): RecoverySettings => {
    const dirs =
        current.recovery && Array.isArray(current.recoveryWalletDirs)
            ? current.recoveryWalletDirs
            : [];
    return {
        recovery: true,
        recoveryWalletDirs: dirs.includes(walletDir)
            ? dirs
            : [...dirs, walletDir]
    };
};

/**
 * Settings update that ends the pending recovery of one wallet only. A
 * flag without a list (see bindLegacyRecovery) is cleared as before. The
 * list is removed once empty, so that a flag an older version sets later
 * (it does not know the list) is read as a flag without a list.
 */
export const clearRecoveryWallet = (
    current: Partial<RecoverySettings>,
    walletDir?: string
): RecoverySettings => {
    const dirs = (
        Array.isArray(current.recoveryWalletDirs)
            ? current.recoveryWalletDirs
            : []
    ).filter((dir) => dir !== walletDir);
    return dirs.length > 0
        ? { recovery: true, recoveryWalletDirs: dirs }
        : { recovery: false, recoveryWalletDirs: undefined };
};

/**
 * Versions that kept only the install-wide flag gave it to whichever
 * on-device wallet connected next. A flag still set from such a version is
 * bound to the first on-device wallet that connects after the upgrade (the
 * wallet that version would have given it to), so that no other wallet acts
 * on it or clears it afterwards. Returns null when there is nothing to bind.
 */
export const bindLegacyRecovery = (
    current: Partial<RecoverySettings>,
    walletDir?: string
): RecoverySettings | null => {
    if (!current.recovery || Array.isArray(current.recoveryWalletDirs)) {
        return null;
    }
    if (!walletDir) return null;
    return { recovery: true, recoveryWalletDirs: [walletDir] };
};
