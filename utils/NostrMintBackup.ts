import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import {
    getPublicKey,
    getEventHash,
    getSignature,
    relayInit
} from 'nostr-tools';
import * as nip44 from '@nostr/tools/nip44';

import Base64Utils from './Base64Utils';

const DOMAIN_SEPARATOR = 'cashu-mint-backup';

interface MintBackupData {
    mints: string[];
    timestamp: number;
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
 */
export async function restoreMintsFromNostr(
    privateKeyHex: string,
    publicKeyHex: string,
    relays: string[]
): Promise<{ mints: string[]; timestamp: number } | null> {
    const conversationKey = nip44.getConversationKey(
        hexToBytes(privateKeyHex),
        publicKeyHex
    );

    // Try each relay until we get a result
    for (const relayUrl of relays) {
        try {
            const result = await fetchFromRelay(
                relayUrl,
                publicKeyHex,
                conversationKey
            );
            if (result) return result;
        } catch (e) {
            console.warn(
                `Nostr mint restore: failed to fetch from ${relayUrl}:`,
                e
            );
        }
    }

    return null;
}

function fetchFromRelay(
    relayUrl: string,
    publicKeyHex: string,
    conversationKey: Uint8Array
): Promise<{ mints: string[]; timestamp: number } | null> {
    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            try {
                relay.close();
            } catch {}
            resolve(null);
        }, 10000);

        const relay = relayInit(relayUrl);

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
                        const decrypted = nip44.decrypt(
                            event.content,
                            conversationKey
                        );
                        const data: MintBackupData = JSON.parse(decrypted);
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
