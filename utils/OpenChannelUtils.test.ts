import OpenChannelUtils from './OpenChannelUtils';

const PUBKEY =
    '02bad5a65fb10d2d46bacb2465994a07efe11f21f217d78e5b76e6f4d9f6117dc7';

const additionalChannel = (overrides = {}) => ({
    node_pubkey_string: PUBKEY,
    host: '',
    local_funding_amount: '100000',
    satAmount: 100000,
    ...overrides
});

describe('isValidChannelAmount', () => {
    it('accepts a positive amount', () => {
        expect(OpenChannelUtils.isValidChannelAmount(100000)).toBe(true);
        expect(OpenChannelUtils.isValidChannelAmount('100000')).toBe(true);
    });

    it('rejects an empty or zero amount', () => {
        expect(OpenChannelUtils.isValidChannelAmount('0')).toBe(false);
        expect(OpenChannelUtils.isValidChannelAmount('')).toBe(false);
        expect(OpenChannelUtils.isValidChannelAmount(NaN)).toBe(false);
    });
});

describe('isInvalidMainChannelAmount', () => {
    it('is invalid without an amount', () => {
        expect(
            OpenChannelUtils.isInvalidMainChannelAmount({
                satAmount: '0',
                fundMax: false,
                connectPeerOnly: false
            })
        ).toBe(true);
    });

    it('is valid with an amount', () => {
        expect(
            OpenChannelUtils.isInvalidMainChannelAmount({
                satAmount: 100000,
                fundMax: false,
                connectPeerOnly: false
            })
        ).toBe(false);
    });

    it('is valid without an amount when fund max is on', () => {
        expect(
            OpenChannelUtils.isInvalidMainChannelAmount({
                satAmount: '',
                fundMax: true,
                connectPeerOnly: false
            })
        ).toBe(false);
    });

    it('is valid without an amount in connect-peer-only mode', () => {
        expect(
            OpenChannelUtils.isInvalidMainChannelAmount({
                satAmount: '',
                fundMax: false,
                connectPeerOnly: true
            })
        ).toBe(false);
    });
});

describe('isValidAdditionalChannelPubkey', () => {
    it('accepts a valid pubkey', () => {
        expect(
            OpenChannelUtils.isValidAdditionalChannelPubkey(additionalChannel())
        ).toBe(true);
    });

    it('rejects an invalid pubkey', () => {
        expect(
            OpenChannelUtils.isValidAdditionalChannelPubkey(
                additionalChannel({ node_pubkey_string: PUBKEY.slice(0, 65) })
            )
        ).toBe(false);
        expect(
            OpenChannelUtils.isValidAdditionalChannelPubkey(
                additionalChannel({
                    node_pubkey_string: `${PUBKEY.slice(0, 65)}g`
                })
            )
        ).toBe(false);
        expect(
            OpenChannelUtils.isValidAdditionalChannelPubkey(
                additionalChannel({
                    node_pubkey_string: `${PUBKEY}@172.18.0.7:9735`
                })
            )
        ).toBe(false);
    });
});

describe('isValidAdditionalChannelHost', () => {
    it('accepts an empty host', () => {
        expect(
            OpenChannelUtils.isValidAdditionalChannelHost(
                additionalChannel({ host: '' })
            )
        ).toBe(true);
    });

    it('accepts a valid host', () => {
        expect(
            OpenChannelUtils.isValidAdditionalChannelHost(
                additionalChannel({ host: '172.18.0.7:9735' })
            )
        ).toBe(true);
    });

    it('rejects a host with an invalid port', () => {
        expect(
            OpenChannelUtils.isValidAdditionalChannelHost(
                additionalChannel({ host: 'host:99999' })
            )
        ).toBe(false);
        expect(
            OpenChannelUtils.isValidAdditionalChannelHost(
                additionalChannel({ host: 'host:0' })
            )
        ).toBe(false);
    });
});

describe('hasInvalidAdditionalChannels', () => {
    it('is valid without additional channels', () => {
        expect(OpenChannelUtils.hasInvalidAdditionalChannels([], false)).toBe(
            false
        );
    });

    it('is valid when all additional channels are valid', () => {
        expect(
            OpenChannelUtils.hasInvalidAdditionalChannels(
                [
                    additionalChannel(),
                    additionalChannel({ host: '172.18.0.7:9735' })
                ],
                false
            )
        ).toBe(false);
    });

    it('is invalid when an additional channel has no amount', () => {
        expect(
            OpenChannelUtils.hasInvalidAdditionalChannels(
                [additionalChannel({ satAmount: '0' })],
                false
            )
        ).toBe(true);
    });

    it('is invalid when one of several additional channels is invalid', () => {
        expect(
            OpenChannelUtils.hasInvalidAdditionalChannels(
                [
                    additionalChannel(),
                    additionalChannel({ node_pubkey_string: '' })
                ],
                false
            )
        ).toBe(true);
    });

    it('ignores additional channels in connect-peer-only mode', () => {
        expect(
            OpenChannelUtils.hasInvalidAdditionalChannels(
                [additionalChannel({ satAmount: '0' })],
                true
            )
        ).toBe(false);
    });
});
