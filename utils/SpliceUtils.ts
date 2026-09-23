import { localeString } from './LocaleUtils';

export type SpliceDirection = 'in' | 'out';

// Peers reject outputs below their dust limit while the splice transaction
// is built. 546 sats is the highest standard limit (P2PKH), so a payout of
// at least this much clears every peer's check, whatever the address type
export const SPLICE_OUT_MIN_SATS = 546;

// ldk-node funds a splice-in from confirmed UTXOs only, and its coin
// selection does not hold back the anchor channel reserve, so the reserve
// is kept out of what can be spliced in
export const getSpliceInAvailableSats = (
    confirmedSats: number,
    anchorReserveSats: number
): number => Math.max(0, Math.floor(confirmedSats - anchorReserveSats));

// sendingCapacity is LDK's outbound capacity converted from msat, so it can
// carry a fraction of a sat
export const getSpliceOutAvailableSats = (
    sendingCapacity: string | number
): number => Math.max(0, Math.floor(Number(sendingCapacity) || 0));

export const getSpliceAmountError = (
    direction: SpliceDirection,
    amountSats: number,
    availableSats: number
): string | null => {
    if (!(amountSats > 0)) {
        return localeString('views.Splice.error.amountNotPositive');
    }

    if (amountSats > availableSats) {
        return direction === 'in'
            ? localeString('views.Splice.error.insufficientOnchainFunds')
            : localeString('views.Splice.error.insufficientChannelBalance');
    }

    if (direction === 'out' && amountSats < SPLICE_OUT_MIN_SATS) {
        return localeString('views.Splice.error.belowDustLimit', {
            minSats: SPLICE_OUT_MIN_SATS
        });
    }

    return null;
};
