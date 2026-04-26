interface BuildNostrWalletConnectUrlParams {
    walletServicePubkey: string;
    relayUrl: string;
    secret: string;
    lud16?: string;
}

export class InvalidLightningAddressError extends Error {
    constructor() {
        super('INVALID_LIGHTNING_ADDRESS');
        this.name = 'InvalidLightningAddressError';
    }
}

export const isValidLightningAddress = (address?: string | null): boolean => {
    if (!address) return true; // empty is ok (optional feature)
    if (address.length > 256) return false; // max length per LUD-16
    
    // LUD-16 format: localpart@domain (DNS-compliant, RFC 5321)
    // Local part: alphanumeric, dots, hyphens, underscores, plus sign
    // - Cannot start or end with dots
    // - Cannot have consecutive dots
    // Domain: DNS-compliant labels separated by dots
    // - Each label: alphanumeric with hyphens in middle only (supports punycode)
    // - At least 2 labels (e.g., example.com)
    // - Each label 1-63 chars, TLD (final label) 2+ chars per DNS spec
    
    // Regex for ASCII-only Lightning Addresses (punycode supported for IDN)
    // Local part: letter/digit, then optional alphanumerics/dots/hyphens/underscores/plus
    // Domain: standard DNS format (alphanumeric + hyphens per label, allowing punycode xn--)
    // TLD: 2+ alphanumeric or hyphens (allows punycode like xn--p1ai)
    const regex = /^[a-zA-Z0-9]([a-zA-Z0-9._+\-]{0,62}[a-zA-Z0-9_+\-])?@[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$/;

    // Additional validation: reject consecutive dots in local part
    const [localPart] = address.split('@');
    if (!localPart || localPart.includes('..') || localPart.startsWith('.') || localPart.endsWith('.')) {
        return false;
    }

    return regex.test(address);
};

export const buildNostrWalletConnectUrl = ({
    walletServicePubkey,
    relayUrl,
    secret,
    lud16
}: BuildNostrWalletConnectUrlParams): string => {
    const queryParams = [
        `relay=${encodeURIComponent(relayUrl)}`,
        `secret=${encodeURIComponent(secret)}`
    ];

    const normalizedLud16 = lud16?.trim();
    if (normalizedLud16) {
        if (!isValidLightningAddress(normalizedLud16)) {
            throw new InvalidLightningAddressError();
        }
        queryParams.push(`lud16=${encodeURIComponent(normalizedLud16)}`);
    }

    return `nostr+walletconnect://${walletServicePubkey}?${queryParams.join(
        '&'
    )}`;
};
