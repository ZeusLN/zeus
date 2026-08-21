import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import {
    getPublicKey,
    getEventHash,
    getSignature,
    relayInit,
    verifySignature
} from 'nostr-tools';
import * as nip44 from '@nostr/tools/nip44';

import Base64Utils from './Base64Utils';

const DOMAIN_SEPARATOR = 'cashu-mint-backup';

interface MintBackupData {
    mints: string[];
    timestamp: number;
}

export interface MintBackupResult {
    mints: string[];
    timestamp: number;
}

function isValidMintBackupData(data: any): data is MintBackupData {
    return (
        !!data &&
        typeof data === 'object' &&
        Array.isArray(data.mints) &&
        data.mints.every((m: any) => typeof m === 'string') &&
        typeof data.timestamp === 'number' &&
        Number.isFinite(data.timestamp)
    );
}

/**
 * Derives a Nostr keypair deterministically from a Cashu seed.
 * Cross-compatible with cashu.me — uses the same domain separator
 * and derivation method so the same seed produces the same keys
 * in both wallets.
 *
 * Derivation: SHA-256(seed || "cashu-mint-backup") → private key
 */
export function deriveMintBackupKeypair(seed: Uint8Array): {
    privateKey: Uint8Array;
    privateKeyHex: string;
    publicKeyHex: string;
} {
    const domainSeparator = Base64Utils.utf8ToBytes(DOMAIN_SEPARATOR);
    const combined = new Uint8Array(seed.length + domainSeparator.length);
    combined.set(seed);
    combined.set(domainSeparator, seed.length);

    const privateKey = sha256(combined);
    const privateKeyHex = bytesToHex(privateKey);
    const publicKeyHex = getPublicKey(privateKeyHex);

    return { privateKey, privateKeyHex, publicKeyHex };
}

/**
 * Backs up a list of mint URLs to Nostr relays as a NIP-78
 * (kind 30078) parameterized replaceable event, encrypted with NIP-44.
 */
export async function backupMintsToNostr(
    privateKeyHex: string,
    publicKeyHex: string,
    mintUrls: string[],
    relays: string[]
): Promise<number> {
    const timestamp = Math.floor(Date.now() / 1000);

    const payload: MintBackupData = {
        mints: mintUrls,
        timestamp
    };

    // NIP-44 encrypt to self
    const conversationKey = nip44.getConversationKey(
        hexToBytes(privateKeyHex),
        publicKeyHex
    );
    const encryptedContent = nip44.encrypt(
        JSON.stringify(payload),
        conversationKey
    );

    const unsignedEvent = {
        kind: 30078,
        content: encryptedContent,
        tags: [
            ['d', 'mint-list'],
            ['client', 'zeus']
        ],
        created_at: timestamp,
        pubkey: publicKeyHex
    };

    const signedEvent = {
        ...unsignedEvent,
        id: getEventHash(unsignedEvent),
        sig: getSignature(unsignedEvent, privateKeyHex)
    };

    const publishPromises = relays.map(async (relayUrl) => {
        try {
            const relay = relayInit(relayUrl);
            await relay.connect();
            await relay.publish(signedEvent);
            relay.close();
            return true;
        } catch (e) {
            console.warn(
                `Nostr mint backup: failed to publish to ${relayUrl}:`,
                e
            );
            return false;
        }
    });

    const results = await Promise.all(publishPromises);
    const successCount = results.filter(Boolean).length;

    if (successCount === 0) {
        throw new Error('Failed to publish mint backup to any relay');
    }

    return timestamp;
}

/**
 * Restores mint URLs from Nostr relays by fetching the kind 30078
 * event and decrypting with NIP-44.
 *
 * Queries every relay and returns the freshest backup by the
 * encrypted payload's timestamp (relays can withhold or replay old
 * events, but cannot forge the AEAD-protected payload; the outer
 * created_at is not authenticated by decryption, so it is ignored).
 * Backups older than minTimestamp are dropped, so a restore can
 * never roll back behind a backup this device has already seen.
 * The freshest result is returned even if its mint list is empty:
 * a newer empty backup must beat an older non-empty one.
 */
export async function restoreMintsFromNostr(
    privateKeyHex: string,
    publicKeyHex: string,
    relays: string[],
    minTimestamp: number = 0
): Promise<MintBackupResult | null> {
    const conversationKey = nip44.getConversationKey(
        hexToBytes(privateKeyHex),
        publicKeyHex
    );

    const results = await Promise.all(
        relays.map((relayUrl) =>
            fetchFromRelay(relayUrl, publicKeyHex, conversationKey).catch(
                (e) => {
                    console.warn(
                        `Nostr mint restore: failed to fetch from ${relayUrl}:`,
                        e
                    );
                    return null;
                }
            )
        )
    );

    let best: MintBackupResult | null = null;
    for (const result of results) {
        if (!result) continue;
        if (result.timestamp < minTimestamp) continue;
        if (!best || result.timestamp > best.timestamp) best = result;
    }

    return best;
}

function fetchFromRelay(
    relayUrl: string,
    publicKeyHex: string,
    conversationKey: Uint8Array
): Promise<MintBackupResult | null> {
    return new Promise((resolve) => {
        const relay = relayInit(relayUrl);

        const timeout = setTimeout(() => {
            try {
                relay.close();
            } catch {}
            resolve(null);
        }, 10000);

        relay
            .connect()
            .then(() => {
                const sub = relay.sub([
                    {
                        kinds: [30078],
                        authors: [publicKeyHex],
                        '#d': ['mint-list'],
                        limit: 1
                    }
                ]);

                sub.on('event', (event: any) => {
                    try {
                        if (event.pubkey !== publicKeyHex) {
                            console.warn(
                                `Nostr mint restore: event from unexpected pubkey on ${relayUrl}`
                            );
                            return;
                        }
                        if (!verifySignature(event)) {
                            console.warn(
                                `Nostr mint restore: invalid event signature on ${relayUrl}`
                            );
                            return;
                        }
                        const decrypted = nip44.decrypt(
                            event.content,
                            conversationKey
                        );
                        const data = JSON.parse(decrypted);
                        if (!isValidMintBackupData(data)) {
                            console.warn(
                                `Nostr mint restore: malformed backup payload on ${relayUrl}`
                            );
                            return;
                        }
                        clearTimeout(timeout);
                        sub.unsub();
                        relay.close();
                        resolve(data);
                    } catch (e) {
                        console.warn('Failed to decrypt mint backup event:', e);
                    }
                });

                sub.on('eose', () => {
                    clearTimeout(timeout);
                    sub.unsub();
                    relay.close();
                    resolve(null);
                });
            })
            .catch(() => {
                clearTimeout(timeout);
                resolve(null);
            });
    });
}
