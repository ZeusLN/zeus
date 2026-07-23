import Storage from '../storage';

/**
 * Per-wallet registry of display metadata for imported watch-only accounts
 * (LDK backend). The Rust node's account list is the source of truth for
 * WHICH accounts exist; this registry only carries the import metadata the
 * Accounts UI displays (xpub, fingerprint, address type, derivation path),
 * which the ldk-node FFI does not store. Readers must degrade gracefully when
 * an entry is missing — e.g. after a VSS recovery on a fresh install, where
 * the Rust wallets are restored but local storage is empty.
 */

export interface WatchonlyAccountMeta {
    extended_public_key: string;
    // base64, as carried in the import request (Account.XFP decodes this form)
    master_key_fingerprint?: string;
    address_type: number;
    derivation_path: string;
}

export interface WatchonlyRegistry {
    [name: string]: WatchonlyAccountMeta;
}

const registryKey = (nodeDir: string) => `${nodeDir}-watchonly-accounts`;

export const loadWatchonlyRegistry = async (
    nodeDir: string
): Promise<WatchonlyRegistry> => {
    try {
        const stored = await Storage.getItem(registryKey(nodeDir));
        return stored ? JSON.parse(stored) : {};
    } catch (e) {
        console.log('Error loading watch-only account registry:', e);
        return {};
    }
};

export const saveWatchonlyAccountMeta = async (
    nodeDir: string,
    name: string,
    meta: WatchonlyAccountMeta
): Promise<void> => {
    const registry = await loadWatchonlyRegistry(nodeDir);
    registry[name] = meta;
    await Storage.setItem(registryKey(nodeDir), registry);
};
