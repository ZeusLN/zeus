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
    // LUD-16 format: localpart@domain (DNS-compliant)
    // Local part: letters, numbers, dots, hyphens, underscores, plus sign
    // - Cannot start or end with dots
    // - Cannot have consecutive dots
    // Domain labels must not start/end with hyphen, can have hyphens in middle
    // TLD must be at least 2 characters (per DNS spec)
    const regex =
        /^[a-zA-Z0-9_+\-]([a-zA-Z0-9._+\-]{0,62}[a-zA-Z0-9_+\-])?@([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z0-9]{2}(?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;

    // Additional validation: reject consecutive dots in local part
    const [localPart] = address.split('@');
    if (!localPart || localPart.includes('..')) {
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
