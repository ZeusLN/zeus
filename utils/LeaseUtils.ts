import BigNumber from 'bignumber.js';

import { ExpirationStatus } from '../models/Status';
import DateTimeUtils from './DateTimeUtils';
import { localeString } from './LocaleUtils';
import { numberWithCommas } from './UnitsUtils';

// Helpers for showing LSPS7 channel leases. Kept out of LspUtils because
// LSPStore imports LspUtils, and LocaleUtils/DateTimeUtils import the stores.

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
    // LSPStore only stores lists, but the views read this on every render,
    // so don't let any other value throw
    if (!Array.isArray(extendableChannels)) return {};
    const entry = extendableChannels.find(
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

// Leases with fewer blocks left than this are shown as expiring.
export const LEASE_EXPIRING_BLOCKS = 2016; // ~2 weeks

// Status shown in the channel list for a channel with the LSP.
export function getLeaseExpirationStatus({
    expiresInBlocks,
    expirationBlock
}: RenewalInfo): ExpirationStatus | undefined {
    if (expiresInBlocks !== undefined) {
        if (expiresInBlocks <= 0) return ExpirationStatus.Expired;
        if (expiresInBlocks < LEASE_EXPIRING_BLOCKS) {
            return ExpirationStatus.Expiring;
        }
        return undefined;
    }
    if (expirationBlock === 0) return ExpirationStatus.LSPDiscretion;
    // no lease data, or the block height is not loaded yet
    return undefined;
}

// Approximate time until (or since) expiry, e.g. "2 months, 3 days". Empty
// when it rounds to less than a day.
export function formatLeaseDuration(expiresInBlocks?: number): string {
    if (!expiresInBlocks) return '';
    const { months, days } =
        DateTimeUtils.blocksToMonthsAndDays(expiresInBlocks);
    const parts: string[] = [];
    if (months) {
        parts.push(
            `${numberWithCommas(Math.abs(months))} ${localeString(
                Math.abs(months) > 1 ? 'time.months' : 'time.month'
            ).toLowerCase()}`
        );
    }
    if (days) {
        parts.push(
            `${numberWithCommas(Math.abs(days))} ${localeString(
                Math.abs(days) > 1 ? 'time.days' : 'time.day'
            ).toLowerCase()}`
        );
    }
    return parts.join(', ');
}
