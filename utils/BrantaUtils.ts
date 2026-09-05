import type { BrantaVerification } from '../stores/BrantaStore';

export function onchainSendNavigationParams({
    destination,
    satAmount,
    fee,
    brantaVerification
}: {
    destination?: string;
    satAmount?: number | string;
    fee?: string;
    brantaVerification?: BrantaVerification | null;
}) {
    return {
        destination,
        satAmount,
        fee,
        transactionType: 'On-chain' as const,
        ...(brantaVerification ? { isValid: true, brantaVerification } : {})
    };
}

export function paymentRequestNavigationParams(
    brantaVerification?: BrantaVerification | null
) {
    return { brantaVerification };
}
