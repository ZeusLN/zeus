import { localeString } from './LocaleUtils';

export const SPLICES_KEY = 'zeus-splices';

export type SpliceDirection = 'in' | 'out';

// What a backend reports while following a splice. channelReady fires again
// once a splice locks, so a ready event for a channel with a pending splice
// means that splice is done
export interface SpliceEvent {
    type: 'splicePending' | 'spliceFailed' | 'channelReady' | 'channelClosed';
    userChannelId: string;
    channelId: string;
    // splicePending only: the splice transaction's new funding output
    txid?: string;
    vout?: number;
}

// A splice in progress as a backend that tracks its own splices reports it
// on the channel (Core Lightning). The channel keeps its old funding and
// capacity until the splice locks, as on LDK
export interface ReportedSplice {
    txid: string;
    vout: number;
    initiator: 'local' | 'remote';
    direction?: SpliceDirection;
    // our side's share; unknown for a splice the peer started
    amountSats?: number;
    // the channel's capacity once the splice locks
    capacitySats: number;
}

// A splice transaction's confirmations once it is in the on-chain list.
// total is the depth the channel locks at, when the backend reports it
export interface SpliceConfirmations {
    current: number;
    total?: number;
}

// "2 / 6", stopping at the lock depth while the peer catches up
export const formatSpliceConfirmations = ({
    current,
    total
}: SpliceConfirmations): string =>
    total ? `${Math.min(current, total)} / ${total}` : `${current}`;

// Peers reject outputs below their dust limit while the splice transaction
// is built. 546 sats is the highest standard limit (P2PKH), so a payout of
// at least this much clears every peer's check, whatever the address type
export const SPLICE_OUT_MIN_SATS = 546;

// ldk-node's NodeError messages for a failed splice request. Every refusal
// from LDK itself (peer can't splice, a splice already pending, amount too
// high once the fee is added, channel not usable) arrives as the generic
// splicing failure
const NODE_ERROR_SPLICING_FAILED = 'Failed to splice channel.';
const NODE_ERROR_CONNECTION_FAILED = 'Network connection closed.';
const NODE_ERROR_INVALID_ADDRESS = 'The given address is invalid.';
const NODE_ERROR_INSUFFICIENT_FUNDS =
    'The available funds are insufficient to complete the given operation.';

// Core Lightning's splice errors, as worded in lightningd, its splice plugin
// and wallet funding (v26.04)
const CLN_ERROR_PEER_CANT_SPLICE = 'Peer does not support splicing';
const CLN_ERROR_SPLICE_BUSY =
    'Currently waiting on previous splice command to finish';
const CLN_ERROR_DISCONNECTED = 'Channel is disconnected';
const CLN_ERROR_NOT_CONNECTED = "Channel hasn't finished connecting";
const CLN_ERROR_CANNOT_AFFORD = 'Could not afford';
const CLN_ERROR_SYNCING = 'still syncing with bitcoin network';
const CLN_ERROR_EMERGENCY_RESERVE = 'not enough to meet the emergency minimum';
const CLN_ERROR_FEE_TOO_HIGH = 'Feerate too high';

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

// A splice needs the peer online, and a channel takes one splice at a time
export const getSpliceChannelError = (
    isActive: boolean,
    splicing: boolean
): string | null => {
    if (!isActive) return localeString('views.Splice.error.channelInactive');
    if (splicing) return localeString('views.Splice.error.alreadySplicing');
    return null;
};

export const getSpliceErrorMessage = (message: string): string => {
    if (message.includes(NODE_ERROR_SPLICING_FAILED)) {
        return localeString('views.Splice.error.spliceRefused');
    }
    if (message.includes(NODE_ERROR_CONNECTION_FAILED)) {
        return localeString('views.Splice.error.peerOffline');
    }
    if (message.includes(NODE_ERROR_INVALID_ADDRESS)) {
        return localeString('views.Splice.error.invalidAddress');
    }
    if (
        message.includes(NODE_ERROR_INSUFFICIENT_FUNDS) ||
        message.includes(CLN_ERROR_CANNOT_AFFORD)
    ) {
        return localeString('views.Splice.error.insufficientOnchainFunds');
    }
    if (message.includes(CLN_ERROR_PEER_CANT_SPLICE)) {
        return localeString('views.Splice.error.peerCantSplice');
    }
    if (message.includes(CLN_ERROR_SPLICE_BUSY)) {
        return localeString('views.Splice.error.alreadySplicing');
    }
    if (
        message.includes(CLN_ERROR_DISCONNECTED) ||
        message.includes(CLN_ERROR_NOT_CONNECTED)
    ) {
        return localeString('views.Splice.error.peerOffline');
    }
    if (message.includes(CLN_ERROR_SYNCING)) {
        return localeString('views.Splice.error.nodeSyncing');
    }
    if (message.includes(CLN_ERROR_EMERGENCY_RESERVE)) {
        return localeString('views.Splice.error.emergencyReserve');
    }
    if (message.includes(CLN_ERROR_FEE_TOO_HIGH)) {
        return localeString('views.Splice.error.feeTooHigh');
    }
    return message;
};
