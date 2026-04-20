interface BuildNostrWalletConnectUrlParams {
    walletServicePubkey: string;
    relayUrl: string;
    secret: string;
    lud16?: string;
}

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
        queryParams.push(`lud16=${encodeURIComponent(normalizedLud16)}`);
    }

    return `nostr+walletconnect://${walletServicePubkey}?${queryParams.join('&')}`;
};
