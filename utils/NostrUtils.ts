import { nip19 } from 'nostr-tools';

/**
 * Validates an npub string format using regex.
 * This is a quick check and does not verify bech32 checksum.
 */
const npubRegex = /^npub1[0-9a-z]{58}$/;

class NostrUtils {
    /**
     * Validates an npub string by checking format and bech32 checksum.
     * @param npub - The npub string to validate
     * @returns true if the npub is valid, false otherwise
     */
    isValidNpub = (npub: string): boolean => {
        if (!npub || typeof npub !== 'string') {
            return false;
        }

        const trimmed = npub.trim().toLowerCase();

        // Quick regex check first
        if (!npubRegex.test(trimmed)) {
            return false;
        }

        // Verify bech32 checksum by attempting to decode
        try {
            const decoded = nip19.decode(trimmed);
            return decoded.type === 'npub';
        } catch {
            return false;
        }
    };

    /**
     * Decodes an npub to its hex pubkey representation.
     * @param npub - The npub string to decode
     * @returns The hex pubkey if valid, null otherwise
     */
    npubToHex = (npub: string): string | null => {
        if (!npub || typeof npub !== 'string') {
            return null;
        }

        try {
            const decoded = nip19.decode(npub.trim());
            if (decoded.type !== 'npub') {
                return null;
            }
            return decoded.data as string;
        } catch {
            return null;
        }
    };

    /**
     * Encodes a hex pubkey to npub format.
     * @param hexPubkey - The hex pubkey to encode
     * @returns The npub string if valid, null otherwise
     */
    hexToNpub = (hexPubkey: string): string | null => {
        if (!hexPubkey || typeof hexPubkey !== 'string') {
            return null;
        }

        // Hex pubkey should be 64 characters
        const trimmed = hexPubkey.trim().toLowerCase();
        if (!/^[0-9a-f]{64}$/.test(trimmed)) {
            return null;
        }

        try {
            return nip19.npubEncode(trimmed);
        } catch {
            return null;
        }
    };
}

const nostrUtils = new NostrUtils();
export default nostrUtils;
