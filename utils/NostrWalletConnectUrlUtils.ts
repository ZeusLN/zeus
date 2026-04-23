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

const validateLud16 = (address: string): boolean => {
    if (!address) return true; // empty is ok (optional feature)
    if (address.length > 256) return false; // max length per LUD-16
    // LUD-16 format: localpart@domain (DNS-compliant)
    // Domain labels must not start/end with hyphen, can have hyphens in middle
    const regex =
        /^[a-zA-Z0-9._-]+@([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
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
        if (!validateLud16(normalizedLud16)) {
            throw new InvalidLightningAddressError();
        }
        queryParams.push(`lud16=${encodeURIComponent(normalizedLud16)}`);
    }

    return `nostr+walletconnect://${walletServicePubkey}?${queryParams.join(
        '&'
    )}`;
};
