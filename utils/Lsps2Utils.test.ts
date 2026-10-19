jest.mock('./LocaleUtils');

import {
    LSPS2_RECEIVE_MARGIN_MSAT,
    getJitQuoteMsat,
    getLsps2ErrorMessage,
    getReceivableMsat
} from './Lsps2Utils';

describe('getReceivableMsat', () => {
    const channel = (inboundCapacityMsat: number, extra: any = {}) =>
        ({ isChannelReady: true, inboundCapacityMsat, ...extra } as any);

    it('is zero without channels', () => {
        expect(getReceivableMsat([])).toEqual(0);
    });

    it('sums ready channels minus the margin on each', () => {
        expect(
            getReceivableMsat([
                channel(10_000_000),
                channel(20_000_000),
                channel(50_000_000, { isChannelReady: false })
            ])
        ).toEqual(30_000_000 - 2 * LSPS2_RECEIVE_MARGIN_MSAT);
    });

    it('never counts a channel below zero', () => {
        expect(getReceivableMsat([channel(1_000_000)])).toEqual(0);
    });

    it('caps a channel at its inbound HTLC maximum', () => {
        expect(
            getReceivableMsat([
                channel(100_000_000, { inboundHtlcMaximumMsat: 10_000_000 })
            ])
        ).toEqual(10_000_000);
    });
});

describe('getJitQuoteMsat', () => {
    const payment = (type: string, hash: string, fee?: number) =>
        ({
            kind: {
                type,
                hash,
                lspFeeLimits:
                    fee === undefined
                        ? undefined
                        : { maxTotalOpeningFeeMsat: fee }
            }
        } as any);

    it('reads the opening fee stored with the JIT payment', () => {
        expect(
            getJitQuoteMsat(
                [payment('bolt11', 'a', 1), payment('bolt11Jit', 'b', 5_000)],
                'b'
            )
        ).toEqual(5_000);
    });

    it('is undefined when no JIT payment matches', () => {
        expect(
            getJitQuoteMsat([payment('bolt11', 'b', 5_000)], 'b')
        ).toBeUndefined();
        expect(
            getJitQuoteMsat([payment('bolt11Jit', 'b')], 'b')
        ).toBeUndefined();
    });
});

describe('getLsps2ErrorMessage', () => {
    it.each([
        [
            'The given operation failed due to the required liquidity source being unavailable.',
            'stores.InvoicesStore.lsps2.sourceUnavailable'
        ],
        [
            'Failed to request inbound liquidity.',
            'stores.InvoicesStore.lsps2.requestFailed'
        ],
        [
            "The given operation failed due to the LSP's required opening fee being too high.",
            'stores.InvoicesStore.lsps2.feeTooHigh'
        ],
        [
            'Network connection closed.',
            'stores.InvoicesStore.lsps2.lspUnreachable'
        ]
    ])('maps "%s"', (message, key) => {
        expect(getLsps2ErrorMessage(message)).toEqual(key);
    });

    it('passes other errors through', () => {
        expect(getLsps2ErrorMessage('Node is not running.')).toEqual(
            'Node is not running.'
        );
    });
});
