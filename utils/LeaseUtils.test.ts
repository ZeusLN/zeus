jest.mock('../stores/Stores', () => ({
    settingsStore: { settings: {} },
    fiatStore: {}
}));
jest.mock('./LocaleUtils');

import { ExpirationStatus } from '../models/Status';
import {
    formatLeaseDuration,
    getLeaseDisplay,
    getLeaseExpirationStatus,
    getRenewalInfo
} from './LeaseUtils';

describe('getLeaseDisplay', () => {
    const base = { fetchError: false, isLspChannel: true };

    it('shows the expiry without a button at the max lifetime', () => {
        expect(
            getLeaseDisplay({
                ...base,
                scid: '800000x1x0',
                maxExtensionInBlocks: 0,
                expirationBlock: 852560
            })
        ).toEqual({
            showFetchError: false,
            showLease: true,
            showExtendButton: false,
            hasLease: true
        });
    });

    it('shows the button when the lease can be extended', () => {
        expect(
            getLeaseDisplay({
                ...base,
                scid: '800000x1x0',
                maxExtensionInBlocks: 26280,
                expirationBlock: 852560
            })
        ).toEqual({
            showFetchError: false,
            showLease: true,
            showExtendButton: true,
            hasLease: true
        });
    });

    it('offers a lease purchase for a channel with no expiry', () => {
        expect(
            getLeaseDisplay({
                ...base,
                scid: '800000x1x0',
                maxExtensionInBlocks: 26280,
                expirationBlock: 0
            })
        ).toEqual({
            showFetchError: false,
            showLease: true,
            showExtendButton: true,
            hasLease: false
        });
    });

    it('treats a negative max extension as none', () => {
        expect(
            getLeaseDisplay({
                ...base,
                scid: '800000x1x0',
                maxExtensionInBlocks: -500,
                expirationBlock: 852560
            })
        ).toEqual({
            showFetchError: false,
            showLease: true,
            showExtendButton: false,
            hasLease: true
        });
    });

    it('warns for an LSP channel with no lease data when the fetch failed', () => {
        expect(getLeaseDisplay({ ...base, fetchError: true })).toEqual({
            showFetchError: true,
            showLease: false,
            showExtendButton: false,
            hasLease: false
        });
    });

    it('does not warn when the fetch succeeded', () => {
        expect(getLeaseDisplay(base).showFetchError).toBe(false);
    });

    it('does not warn for a channel with another peer', () => {
        expect(
            getLeaseDisplay({ fetchError: true, isLspChannel: false })
                .showFetchError
        ).toBe(false);
    });

    it('does not warn for a channel the LSP listed with no lease', () => {
        expect(
            getLeaseDisplay({
                ...base,
                fetchError: true,
                scid: '800000x1x0',
                maxExtensionInBlocks: 0,
                expirationBlock: 0
            })
        ).toEqual({
            showFetchError: false,
            showLease: false,
            showExtendButton: false,
            hasLease: false
        });
    });
});

describe('getRenewalInfo', () => {
    const entry = {
        short_channel_id: '800000x1x0',
        max_channel_extension_expiry_blocks: 26280,
        expiration_block: 852560
    };

    it('matches the short channel id and counts blocks to expiry', () => {
        expect(
            getRenewalInfo([entry], { shortChannelId: '800000x1x0' }, 850000)
        ).toEqual({
            scid: '800000x1x0',
            expiresInBlocks: 2560,
            maxExtensionInBlocks: 26280,
            expirationBlock: 852560
        });
    });

    it('matches the peer scid alias', () => {
        expect(
            getRenewalInfo(
                [entry],
                { shortChannelId: '1x2x3', peerScidAlias: '800000x1x0' },
                850000
            ).scid
        ).toBe('800000x1x0');
    });

    it('matches the confirmed scid of a zero-conf channel', () => {
        expect(
            getRenewalInfo(
                [entry],
                { zeroConfConfirmedScid: '800000x1x0' },
                850000
            ).scid
        ).toBe('800000x1x0');
    });

    it('leaves expiresInBlocks unset until the block height loads', () => {
        expect(
            getRenewalInfo([entry], { shortChannelId: '800000x1x0' }, 0)
        ).toEqual({
            scid: '800000x1x0',
            expiresInBlocks: undefined,
            maxExtensionInBlocks: 26280,
            expirationBlock: 852560
        });
    });

    it('counts an expired lease as negative', () => {
        expect(
            getRenewalInfo([entry], { shortChannelId: '800000x1x0' }, 853000)
                .expiresInBlocks
        ).toBe(-440);
    });

    it('counts a lease expiring at the current height as zero blocks', () => {
        const info = getRenewalInfo(
            [entry],
            { shortChannelId: '800000x1x0' },
            852560
        );
        expect(info.expiresInBlocks).toBe(0);
        // shown as expired, not as kept open at the LSP's discretion
        expect(
            getLeaseDisplay({
                ...info,
                fetchError: false,
                isLspChannel: true
            }).hasLease
        ).toBe(true);
    });

    it('has no expiry for a channel kept open at the LSP discretion', () => {
        expect(
            getRenewalInfo(
                [{ ...entry, expiration_block: 0 }],
                { shortChannelId: '800000x1x0' },
                850000
            )
        ).toEqual({
            scid: '800000x1x0',
            expiresInBlocks: undefined,
            maxExtensionInBlocks: 26280,
            expirationBlock: 0
        });
    });

    it('returns nothing for a channel the LSP did not list', () => {
        expect(
            getRenewalInfo([entry], { shortChannelId: '1x2x3' }, 850000)
        ).toEqual({});
        expect(
            getRenewalInfo(undefined, { shortChannelId: '1x2x3' }, 850000)
        ).toEqual({});
    });

    it('does not match an entry without an scid to a channel without an alias', () => {
        expect(
            getRenewalInfo(
                [{ ...entry, short_channel_id: undefined }],
                { shortChannelId: '1x2x3' },
                850000
            )
        ).toEqual({});
    });
});

describe('getRenewalInfo with a value that is not a list', () => {
    it.each([[{}], [5], ['x'], [true], [null], [undefined]])(
        'returns nothing for %p',
        (extendableChannels) => {
            expect(
                getRenewalInfo(
                    extendableChannels as any,
                    { shortChannelId: '800000x1x0' },
                    850000
                )
            ).toEqual({});
        }
    );
});

describe('getLeaseExpirationStatus', () => {
    const entry = {
        short_channel_id: '800000x1x0',
        max_channel_extension_expiry_blocks: 26280,
        expiration_block: 852560
    };
    // status for a lease with `left` blocks remaining
    const statusWithBlocksLeft = (left: number) =>
        getLeaseExpirationStatus(
            getRenewalInfo(
                [entry],
                { shortChannelId: '800000x1x0' },
                852560 - left
            )
        );

    it.each([
        [-1, ExpirationStatus.Expired],
        [0, ExpirationStatus.Expired],
        [1, ExpirationStatus.Expiring],
        [2015, ExpirationStatus.Expiring],
        [2016, undefined]
    ])('with %i blocks left returns %s', (left, status) => {
        expect(statusWithBlocksLeft(left)).toBe(status);
    });

    it('returns nothing for a lease while the block height is unknown', () => {
        expect(
            getLeaseExpirationStatus(
                getRenewalInfo([entry], { shortChannelId: '800000x1x0' }, 0)
            )
        ).toBeUndefined();
    });

    it('returns LSP discretion for a channel without an expiry', () => {
        const discretion = { ...entry, expiration_block: 0 };
        expect(
            getLeaseExpirationStatus(
                getRenewalInfo(
                    [discretion],
                    { shortChannelId: '800000x1x0' },
                    850000
                )
            )
        ).toBe(ExpirationStatus.LSPDiscretion);
        // also before the block height loads
        expect(
            getLeaseExpirationStatus(
                getRenewalInfo(
                    [discretion],
                    { shortChannelId: '800000x1x0' },
                    0
                )
            )
        ).toBe(ExpirationStatus.LSPDiscretion);
    });

    it('returns nothing for a channel the LSP did not list', () => {
        expect(getLeaseExpirationStatus({})).toBeUndefined();
    });
});

describe('formatLeaseDuration', () => {
    // 144 blocks a day, 30-day months
    it.each([
        [undefined, ''],
        [0, ''],
        [71, ''],
        [-71, ''],
        [72, '1 time.day'],
        [144 * 2, '2 time.days'],
        [144 * 30, '1 time.month'],
        [144 * 31, '1 time.month, 1 time.day'],
        [144 * 65, '2 time.months, 5 time.days'],
        [144 * 60, '2 time.months'],
        [-144 * 3, '3 time.days'],
        [144 * 30 * 1001, '1,001 time.months']
    ])('formats %s blocks as "%s"', (blocks, text) => {
        expect(formatLeaseDuration(blocks)).toBe(text);
    });
});
