import { nip05, nip19 } from 'nostr-tools';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';

/**
 * Validates an npub string format using regex.
 * This is a quick check and does not verify bech32 checksum.
 */
const npubRegex = /^npub1[0-9a-z]{58}$/;
const nsecRegex = /^nsec1[0-9a-z]{58}$/;

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

    /**
     * Validates an nsec string by checking format and bech32 checksum.
     * @param nsec - The nsec string to validate
     * @returns true if the nsec is valid, false otherwise
     */
    isValidNsec = (nsec: string): boolean => {
        if (!nsec || typeof nsec !== 'string') {
            return false;
        }

        const trimmed = nsec.trim().toLowerCase();

        // Quick regex check first
        if (!nsecRegex.test(trimmed)) {
            return false;
        }

        // Verify bech32 checksum by attempting to decode
        try {
            const decoded = nip19.decode(trimmed);
            return decoded.type === 'nsec';
        } catch {
            return false;
        }
    };

    /**
     * Decodes an nsec to its hex private key representation.
     * @param nsec - The nsec string to decode
     * @returns The hex private key if valid, null otherwise
     */
    nsecToHex = (nsec: string): string | null => {
        if (!nsec || typeof nsec !== 'string') {
            return null;
        }

        try {
            const decoded = nip19.decode(nsec.trim());
            if (decoded.type !== 'nsec') {
                return null;
            }
            return bytesToHex(decoded.data as Uint8Array);
        } catch {
            return null;
        }
    };

    /**
     * Encodes a hex private key to nsec format.
     * @param hexPrivkey - The hex private key to encode
     * @returns The nsec string if valid, null otherwise
     */
    hexToNsec = (hexPrivkey: string): string | null => {
        if (!hexPrivkey || typeof hexPrivkey !== 'string') {
            return null;
        }

        // Hex private key should be 64 characters
        const trimmed = hexPrivkey.trim().toLowerCase();
        if (!/^[0-9a-f]{64}$/.test(trimmed)) {
            return null;
        }

        try {
            return nip19.nsecEncode(hexToBytes(trimmed));
        } catch {
            return null;
        }
    };

    /**
     * Looks up a NIP-05 identifier (name@domain).
     * NIP-05 names are case-insensitive, but nostr-tools looks them up
     * case-sensitively in nostr.json, whose keys are lowercase, so the
     * identifier is lowercased first.
     * With Tor enabled the request goes through doTorRequest. Otherwise
     * nostr-tools sends it through the OS HTTP stack, which cannot reach an
     * onion service and would only send the onion address to the system's
     * DNS resolver, so .onion identifiers are not looked up.
     * @param identifier - The NIP-05 identifier to look up
     * @param enableTor - Whether to send the request over Tor
     * @returns The profile pointer, or null if the lookup found nothing
     */
    queryNip05Profile = async (
        identifier: string,
        enableTor: boolean = false
    ): Promise<nip19.ProfilePointer | null> => {
        const normalized = identifier.toLowerCase();
        if (/\.onion\.?$/.test(normalized)) {
            return null;
        }
        if (!enableTor) {
            return nip05.queryProfile(normalized);
        }

        // Same lookup as nostr-tools' nip05.queryProfile, over Tor. TorUtils
        // is loaded here so that importing NostrUtils (via AddressUtils)
        // does not load the native Tor module.
        const { doTorRequest, RequestMethod } = require('./TorUtils');
        const match = normalized.match(nip05.NIP05_REGEX);
        if (!match) return null;
        const [, name = '_', domain] = match;
        try {
            const json = await doTorRequest(
                `https://${domain}/.well-known/nostr.json?name=${encodeURIComponent(
                    name
                )}`,
                RequestMethod.GET
            );
            return this.parseNip05Response(json, name);
        } catch {
            return null;
        }
    };

    /**
     * Reads the pubkey and relays for a name from a nostr.json response.
     * @returns The profile pointer, or null if the response has no valid
     * pubkey for the name
     */
    parseNip05Response = (
        json: any,
        name: string
    ): nip19.ProfilePointer | null => {
        const names = json?.names;
        if (!names || typeof names !== 'object') return null;
        const pubkey = Object.prototype.hasOwnProperty.call(names, name)
            ? names[name]
            : undefined;
        if (typeof pubkey !== 'string' || !/^[0-9a-f]{64}$/.test(pubkey)) {
            return null;
        }
        const relays = json.relays?.[pubkey];
        return {
            pubkey,
            relays: Array.isArray(relays)
                ? relays.filter((r: unknown) => typeof r === 'string')
                : undefined
        };
    };
}

const nostrUtils = new NostrUtils();
export default nostrUtils;
