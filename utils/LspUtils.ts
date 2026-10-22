import BigNumber from 'bignumber.js';

import Bolt11Utils from './Bolt11Utils';

export type WrappedInvoiceError =
    | 'decode_failure'
    | 'network_mismatch'
    | 'payment_hash_mismatch'
    | 'amount_missing'
    | 'amount_mismatch';

export interface WrappedInvoiceCheck {
    valid: boolean;
    error?: WrappedInvoiceError;
}

const fail = (error: WrappedInvoiceError): WrappedInvoiceCheck => ({
    valid: false,
    error
});

/**
 * Verifies a Flow 2.0 wrapped invoice (jit_bolt11) against the inner
 * invoice it is supposed to wrap. The wrap is only trust-minimized when
 * it commits to the same payment hash: the LSP cannot settle the payer's
 * HTLC without forwarding to us, because only our node holds the
 * preimage. The amount bound stops the LSP from charging the payer more
 * than the fee it quoted.
 */
export function verifyWrappedInvoice(
    innerBolt11: string,
    wrappedBolt11: string,
    maxFeeSats: number
): WrappedInvoiceCheck {
    let inner, wrapped;
    try {
        inner = Bolt11Utils.decode(innerBolt11);
        wrapped = Bolt11Utils.decode(wrappedBolt11);
    } catch (e) {
        return fail('decode_failure');
    }

    if (
        !inner.network?.bech32 ||
        wrapped.network?.bech32 !== inner.network.bech32
    ) {
        return fail('network_mismatch');
    }

    if (
        !inner.payment_hash ||
        !wrapped.payment_hash ||
        wrapped.payment_hash.toLowerCase() !== inner.payment_hash.toLowerCase()
    ) {
        return fail('payment_hash_mismatch');
    }

    // millisatoshis is null exactly when the invoice carries no amount;
    // fail closed rather than treating a missing amount as zero
    if (inner.millisatoshis == null || wrapped.millisatoshis == null) {
        return fail('amount_missing');
    }

    const innerMsat = new BigNumber(inner.millisatoshis);
    const wrappedMsat = new BigNumber(wrapped.millisatoshis);
    // zeroConfFee is truncated to whole sats from the LSP's msat quote,
    // so when a fee was quoted allow up to 999 msat of rounding on top;
    // with no quote the wrapped amount must match the inner exactly
    const fee = new BigNumber(maxFeeSats || 0);
    const maxWrappedMsat = innerMsat
        .plus(fee.times(1000))
        .plus(fee.gt(0) ? 999 : 0);
    if (wrappedMsat.lt(innerMsat) || wrappedMsat.gt(maxWrappedMsat)) {
        return fail('amount_mismatch');
    }

    return { valid: true };
}

export interface RenewalInfo {
    scid?: string;
    // blocks until the lease expires, negative once it has expired;
    // undefined while the block height is unknown or there is no lease
    expiresInBlocks?: number;
    maxExtensionInBlocks?: number;
    // 0 when the LSP keeps the channel open at its discretion
    expirationBlock?: number;
}

// Looks up a channel's LSPS7 get_extendable_channels entry by any of its
// short channel ids.
export function getRenewalInfo(
    extendableChannels: any[] | undefined,
    channel: {
        shortChannelId?: string;
        peerScidAlias?: string;
        zeroConfConfirmedScid?: string;
    },
    currentBlockHeight?: number
): RenewalInfo {
    const ids = [
        channel.shortChannelId,
        channel.peerScidAlias,
        channel.zeroConfConfirmedScid
    ].filter(Boolean);
    const entry = extendableChannels?.find(
        (extendableChannel: any) =>
            !!extendableChannel?.short_channel_id &&
            ids.includes(extendableChannel.short_channel_id)
    );
    if (!entry) return {};

    const expirationBlock = entry.expiration_block;
    let expiresInBlocks;
    if (currentBlockHeight && expirationBlock) {
        expiresInBlocks = new BigNumber(expirationBlock)
            .minus(currentBlockHeight)
            .toNumber();
    }

    return {
        scid: entry.short_channel_id,
        expiresInBlocks,
        maxExtensionInBlocks: entry.max_channel_extension_expiry_blocks,
        expirationBlock
    };
}

export interface LeaseDisplay {
    // the LSP couldn't be asked about this channel's lease
    showFetchError: boolean;
    // the lease section, with the expiry when it is known
    showLease: boolean;
    // the extend or purchase lease button
    showExtendButton: boolean;
    // the channel has a lease with an expiry, as opposed to being kept open
    // at the LSP's discretion
    hasLease: boolean;
}

// What the channel view shows for a channel's LSPS7 lease. scid is set when
// the LSP listed the channel in get_extendable_channels. A channel at the
// LSP's max lifetime has no extension left but still shows its expiry, and a
// negative max extension is treated as none.
export function getLeaseDisplay({
    scid,
    maxExtensionInBlocks,
    expirationBlock,
    fetchError,
    isLspChannel
}: {
    scid?: string;
    maxExtensionInBlocks?: number;
    expirationBlock?: number;
    fetchError: boolean;
    isLspChannel: boolean;
}): LeaseDisplay {
    const canExtend = Number(maxExtensionInBlocks) > 0;
    const hasLease = Number(expirationBlock) > 0;
    return {
        showFetchError: fetchError && isLspChannel && !scid,
        showLease: canExtend || hasLease,
        showExtendButton: canExtend,
        hasLease
    };
}
