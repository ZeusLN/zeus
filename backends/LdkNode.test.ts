const mockListPayments = jest.fn();
const mockReceiveBolt11 = jest.fn();
const mockReceiveVariableAmountBolt11 = jest.fn();
const mockSendBolt11 = jest.fn();
const mockSendBolt11UsingAmount = jest.fn();
const mockSendSpontaneousPayment = jest.fn();
const mockBolt12SendUsingAmount = jest.fn();
const mockBolt12InitiateRefund = jest.fn();
const mockBolt12DecodeOffer = jest.fn();
const mockBolt12RequestRefundPayment = jest.fn();
const mockListChannels = jest.fn();
const mockCloseChannel = jest.fn();
const mockForceCloseChannel = jest.fn();
const mockLsps1RequestChannel = jest.fn();
const mockReceiveViaJitChannel = jest.fn();
const mockListBalances = jest.fn();

jest.mock('../ldknode/LdkNodeInjection', () => ({
    __esModule: true,
    default: {
        node: {
            listBalances: (...args: any[]) => mockListBalances(...args)
        },
        channel: {
            listChannels: (...args: any[]) => mockListChannels(...args),
            closeChannel: (...args: any[]) => mockCloseChannel(...args),
            forceCloseChannel: (...args: any[]) =>
                mockForceCloseChannel(...args)
        },
        payments: {
            listPayments: (...args: any[]) => mockListPayments(...args)
        },
        bolt11: {
            sendBolt11: (...args: any[]) => mockSendBolt11(...args),
            sendBolt11UsingAmount: (...args: any[]) =>
                mockSendBolt11UsingAmount(...args),
            receiveBolt11: (...args: any[]) => mockReceiveBolt11(...args),
            receiveVariableAmountBolt11: (...args: any[]) =>
                mockReceiveVariableAmountBolt11(...args),
            receiveViaJitChannel: (...args: any[]) =>
                mockReceiveViaJitChannel(...args)
        },
        spontaneous: {
            sendSpontaneousPayment: (...args: any[]) =>
                mockSendSpontaneousPayment(...args)
        },
        lsps1: {
            requestChannel: (...args: any[]) => mockLsps1RequestChannel(...args)
        },
        bolt12: {
            bolt12SendUsingAmount: (...args: any[]) =>
                mockBolt12SendUsingAmount(...args),
            bolt12InitiateRefund: (...args: any[]) =>
                mockBolt12InitiateRefund(...args),
            bolt12DecodeOffer: (...args: any[]) =>
                mockBolt12DecodeOffer(...args),
            bolt12RequestRefundPayment: (...args: any[]) =>
                mockBolt12RequestRefundPayment(...args)
        }
    }
}));

jest.mock('../stores/Stores');

jest.mock('../utils/LocaleUtils');

import { bech32 } from 'bech32';

import Bolt11Utils from '../utils/Bolt11Utils';

import LdkNode from './LdkNode';
import { LNURLAUTH_CANONICAL_PHRASE } from '../utils/LnurlAuthUtils';
import Payment from '../models/Payment';
import { isInvoiceNotFoundError } from '../utils/PaymentLookupUtils';
import * as LocaleUtils from '../utils/LocaleUtils';

const PAYMENT_ID = 'payment-id';

const succeededPayment = (feePaidMsat?: number) => ({
    id: PAYMENT_ID,
    status: 'succeeded',
    amountMsat: 5_000_000,
    feePaidMsat,
    latestUpdateTimestamp: 0,
    kind: { hash: 'hash', preimage: 'preimage' }
});

describe('LdkNode payment results', () => {
    let ldk: LdkNode;

    beforeEach(() => {
        jest.clearAllMocks();
        ldk = new LdkNode();
        // Keep the native event loop out of the test
        ldk.subscribeToEvents = () => () => {};
        mockSendBolt11.mockResolvedValue(PAYMENT_ID);
        mockSendSpontaneousPayment.mockResolvedValue(PAYMENT_ID);
        mockBolt12SendUsingAmount.mockResolvedValue(PAYMENT_ID);
        mockBolt12DecodeOffer.mockResolvedValue({ offerId: 'offer-id' });
    });

    const payBolt11 = () =>
        ldk.payLightningInvoice({ payment_request: 'lnbcrt1...' });
    const payKeysend = () => ldk.sendKeysend({ pubkey: '02abc', amt: '5000' });
    const payOffer = () => ldk.payOffer({ offer: 'lno1...', amt: '5000' });

    describe.each([
        ['payLightningInvoice', payBolt11],
        ['sendKeysend', payKeysend],
        ['payOffer', payOffer]
    ])('%s', (_name, pay) => {
        it('returns the fee LDK paid', async () => {
            mockListPayments.mockResolvedValue([succeededPayment(25_000)]);

            const result = await pay();

            expect(result.payment_hash).toEqual('hash');
            expect(result.payment_preimage).toEqual('preimage');
            expect(result.fee_msat).toEqual('25000');
            // What TransactionsStore.handlePayment shows on the success screen
            expect(new Payment(result).getFee).toEqual('25');
        });

        it('keeps a sub-sat fee', async () => {
            mockListPayments.mockResolvedValue([succeededPayment(1_500)]);

            const result = await pay();

            expect(new Payment(result).getFee).toEqual('1.5');
        });

        it('returns a zero fee when LDK reports none', async () => {
            mockListPayments.mockResolvedValue([succeededPayment(undefined)]);

            const result = await pay();

            expect(result.fee_msat).toEqual('0');
            expect(new Payment(result).getFee).toEqual('0');
        });
    });
});

describe('LdkNode.payLightningInvoice with an explicit amount', () => {
    // BOLT11 spec reference vectors: 2500u (250,000 sats) and no amount
    const FIXED_AMOUNT_INVOICE =
        'lnbc2500u1pvjluezsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygspp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpquwpc4curk03c9wlrswe78q4eyqc7d8d0xqzpu9qrsgqhtjpauu9ur7fw2thcl4y9vfvh4m9wlfyz2gem29g5ghe2aak2pm3ps8fdhtceqsaagty2vph7utlgj48u0ged6a337aewvraedendscp573dxr';
    const NO_AMOUNT_INVOICE =
        'lnbc1pvjluezsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygspp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpl2pkx2ctnv5sxxmmwwd5kgetjypeh2ursdae8g6twvus8g6rfwvs8qun0dfjkxaq9qrsgq357wnc5r2ueh7ck6q93dj32dlqnls087fxdwk8qakdyafkq3yap2r09nt4ndd0unm3z9u5t48y6ucv4r5sg7lk98c77ctvjczkspk5qprc90gx';
    // 15010p is 1501 msat: a fixed amount below one sat. Zero timestamp,
    // zero payment hash and a zeroed signature, which decode never checks.
    const SUB_SAT_INVOICE = bech32.encode(
        'lnbc15010p',
        [
            ...new Array(7).fill(0),
            ...[1, 1, 20, ...new Array(52).fill(0)],
            ...new Array(104).fill(0)
        ],
        Infinity
    );

    let ldk: LdkNode;

    beforeEach(() => {
        jest.clearAllMocks();
        ldk = new LdkNode();
        ldk.subscribeToEvents = () => () => {};
        mockSendBolt11.mockResolvedValue(PAYMENT_ID);
        mockSendBolt11UsingAmount.mockResolvedValue(PAYMENT_ID);
        mockListPayments.mockResolvedValue([succeededPayment(0)]);
    });

    it.each([
        ['a fixed-amount invoice', FIXED_AMOUNT_INVOICE],
        ['a sub-satoshi fixed-amount invoice', SUB_SAT_INVOICE]
    ])('pays %s at its own amount and ignores amt', async (_name, invoice) => {
        await ldk.payLightningInvoice({
            payment_request: invoice,
            amt: '500000'
        });

        expect(mockSendBolt11UsingAmount).not.toHaveBeenCalled();
        expect(mockSendBolt11).toHaveBeenCalledWith(
            expect.objectContaining({ invoice })
        );
    });

    it('pays a no-amount invoice with amt', async () => {
        await ldk.payLightningInvoice({
            payment_request: NO_AMOUNT_INVOICE,
            amt: '5000'
        });

        expect(mockSendBolt11).not.toHaveBeenCalled();
        expect(mockSendBolt11UsingAmount).toHaveBeenCalledWith(
            expect.objectContaining({
                invoice: NO_AMOUNT_INVOICE,
                amountMsat: 5_000_000
            })
        );
    });

    it('ignores amt when only the sat amount of the invoice decodes', async () => {
        const decode = jest
            .spyOn(Bolt11Utils, 'decode')
            .mockReturnValue({ satoshis: 250000, millisatoshis: null } as any);

        await ldk.payLightningInvoice({
            payment_request: FIXED_AMOUNT_INVOICE,
            amt: '500000'
        });
        decode.mockRestore();

        expect(mockSendBolt11UsingAmount).not.toHaveBeenCalled();
        expect(mockSendBolt11).toHaveBeenCalledTimes(1);
    });

    it('sends an invoice it cannot decode without amt', async () => {
        await ldk.payLightningInvoice({
            payment_request: 'lnbcrt1...',
            amt: '5000'
        });

        expect(mockSendBolt11UsingAmount).not.toHaveBeenCalled();
        expect(mockSendBolt11).toHaveBeenCalledTimes(1);
        expect(mockSendBolt11.mock.calls[0][0]).toMatchObject({
            invoice: 'lnbcrt1...'
        });
        expect(mockSendBolt11.mock.calls[0][0]).not.toHaveProperty(
            'amountMsat'
        );
    });
});

describe('LdkNode routing fee limit', () => {
    let ldk: LdkNode;

    beforeEach(() => {
        jest.clearAllMocks();
        ldk = new LdkNode();
        ldk.subscribeToEvents = () => () => {};
        mockSendBolt11.mockResolvedValue(PAYMENT_ID);
        mockSendSpontaneousPayment.mockResolvedValue(PAYMENT_ID);
        mockBolt12SendUsingAmount.mockResolvedValue(PAYMENT_ID);
        mockListPayments.mockResolvedValue([succeededPayment(0)]);
    });

    // maxTotalRoutingFeeMsat as passed to the native module
    const sentFeeLimit = async (
        method: 'payLightningInvoice' | 'sendKeysend' | 'payOffer',
        fee_limit_sat: any
    ) => {
        await ldk[method]({
            payment_request: 'lnbcrt1...',
            offer: 'lno1...',
            pubkey: '02abc',
            // the invoice carries the amount
            amt: method === 'payLightningInvoice' ? undefined : '5000',
            fee_limit_sat
        });
        const nativeSend = {
            payLightningInvoice: mockSendBolt11,
            sendKeysend: mockSendSpontaneousPayment,
            payOffer: mockBolt12SendUsingAmount
        }[method];
        return nativeSend.mock.calls[0][0].maxTotalRoutingFeeMsat;
    };

    describe.each(['payLightningInvoice', 'sendKeysend', 'payOffer'] as const)(
        '%s',
        (method) => {
            it('passes the fee limit the user set', async () => {
                expect(await sentFeeLimit(method, 7)).toBe(7_000);
            });

            // TransactionsStore passes the fee limit as a number, so a
            // limit of '0' arrives here as 0
            it('passes a fee limit of 0 as a cap of 0', async () => {
                expect(await sentFeeLimit(method, 0)).toBe(0);
            });
        }
    );

    it.each([
        ['no fee limit', undefined],
        ['an empty fee limit', ''],
        ['an unparsable fee limit', NaN]
    ])(
        "sends a keysend with LDK's default cap for %s",
        async (_name, fee_limit_sat) => {
            // 1% of 5,000 sats plus 50 sats
            expect(await sentFeeLimit('sendKeysend', fee_limit_sat)).toBe(
                100_000
            );
        }
    );

    it.each(['payLightningInvoice', 'payOffer'] as const)(
        '%s leaves the cap to ldk-node when no limit is set',
        async (method) => {
            expect(await sentFeeLimit(method, undefined)).toBeUndefined();
        }
    );
});

describe('LdkNode payment timeouts', () => {
    let ldk: LdkNode;

    const pendingPayment = (hash?: string) => ({
        id: PAYMENT_ID,
        status: 'pending',
        amountMsat: 5_000_000,
        latestUpdateTimestamp: 0,
        kind: { hash, preimage: undefined }
    });

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        ldk = new LdkNode();
        ldk.subscribeToEvents = () => () => {};
        mockSendBolt11.mockResolvedValue(PAYMENT_ID);
        mockSendSpontaneousPayment.mockResolvedValue(PAYMENT_ID);
        mockBolt12SendUsingAmount.mockResolvedValue(PAYMENT_ID);
        mockBolt12DecodeOffer.mockResolvedValue({ offerId: 'offer-id' });
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    // Runs a send to the end of its polling window (timeout + 5 polls)
    const settle = async (send: Promise<any>) => {
        const outcome = send.then(
            (result) => ({ result }),
            (error) => ({ error })
        );
        await jest.advanceTimersByTimeAsync(10_000);
        return outcome;
    };

    describe.each([
        [
            'sendKeysend',
            (ldk: LdkNode) =>
                ldk.sendKeysend({
                    pubkey: '02abc',
                    amt: '5000',
                    timeout_seconds: '1'
                })
        ],
        [
            'payOffer',
            (ldk: LdkNode) =>
                ldk.payOffer({
                    offer: 'lno1...',
                    amt: '5000',
                    timeout_seconds: '1'
                })
        ]
    ])('%s', (_name, pay) => {
        it('reports a payment still pending at timeout as in flight', async () => {
            mockListPayments.mockResolvedValue([pendingPayment('hash')]);

            const { result, error }: any = await settle(pay(ldk));

            expect(error).toBeUndefined();
            expect(result.status).toEqual('IN_FLIGHT');
            expect(result.payment_hash).toEqual('hash');
            expect(result.payment_preimage).toEqual('');
            expect(new Payment(result).getFee).toEqual('0');
            // SendingLightning would read a route as success
            expect(result.payment_route).toBeUndefined();
        });

        it('reports a pending payment with no hash yet as in flight', async () => {
            // A BOLT 12 payment has no hash until the invoice arrives
            mockListPayments.mockResolvedValue([pendingPayment(undefined)]);

            const { result }: any = await settle(pay(ldk));

            expect(result.status).toEqual('IN_FLIGHT');
            expect(result.payment_hash).toEqual('');
        });

        it('reports a payment not yet listed at timeout as in flight', async () => {
            mockListPayments.mockResolvedValue([]);

            const { result }: any = await settle(pay(ldk));

            expect(result.status).toEqual('IN_FLIGHT');
        });

        it('still fails a payment LDK marked failed', async () => {
            mockListPayments.mockResolvedValue([
                { ...pendingPayment('hash'), status: 'failed' }
            ]);

            const { error }: any = await settle(pay(ldk));

            expect(error.message).toEqual('PAYMENT_FAILED_UNKNOWN');
        });
    });

    // BOLT 11 retries reuse the payment hash, which LDK rejects as a
    // duplicate, and NWC relies on the timeout error for this path
    it('payLightningInvoice still throws on timeout', async () => {
        mockListPayments.mockResolvedValue([pendingPayment('hash')]);

        const { error }: any = await settle(
            ldk.payLightningInvoice({
                payment_request: 'lnbcrt1...',
                timeout_seconds: '1'
            })
        );

        expect(error.message).toEqual('error.paymentTimedOut');
        // the app's own timeout, read as one whatever the locale's text
        expect(error.requestTimedOut).toBe(true);
    });
});

describe('LdkNode.payOffer with an earlier payment to the offer', () => {
    let ldk: LdkNode;

    const offerPayment = (overrides: Record<string, any> = {}) => ({
        id: 'earlier-payment-id',
        direction: 'outbound',
        status: 'pending',
        amountMsat: 5_000_000,
        latestUpdateTimestamp: 0,
        ...overrides,
        kind: {
            type: 'bolt12Offer',
            offerId: 'offer-id',
            ...overrides.kind
        }
    });

    const payOffer = () => ldk.payOffer({ offer: 'lno1...', amt: '5000' });

    beforeEach(() => {
        jest.clearAllMocks();
        ldk = new LdkNode();
        ldk.subscribeToEvents = () => () => {};
        mockBolt12DecodeOffer.mockResolvedValue({ offerId: 'offer-id' });
        mockBolt12SendUsingAmount.mockResolvedValue(PAYMENT_ID);
    });

    it('refuses to pay while an outbound payment to the same offer is pending', async () => {
        mockListPayments.mockResolvedValue([offerPayment()]);

        await expect(payOffer()).rejects.toThrow(
            'views.Send.payBolt12.paymentPending'
        );

        expect(mockBolt12DecodeOffer).toHaveBeenCalledWith({
            offer: 'lno1...'
        });
        expect(mockBolt12SendUsingAmount).not.toHaveBeenCalled();
    });

    it.each([
        ['succeeded', offerPayment({ status: 'succeeded' })],
        ['failed', offerPayment({ status: 'failed' })],
        [
            'pending to another offer',
            offerPayment({ kind: { offerId: 'other-offer-id' } })
        ],
        ['pending and inbound', offerPayment({ direction: 'inbound' })],
        [
            'a pending refund',
            offerPayment({ kind: { type: 'bolt12Refund', offerId: undefined } })
        ]
    ])('pays when the earlier payment is %s', async (_name, earlier) => {
        mockListPayments.mockResolvedValue([
            earlier,
            { ...succeededPayment(0), id: PAYMENT_ID }
        ]);

        const result = await payOffer();

        expect(mockBolt12SendUsingAmount).toHaveBeenCalledTimes(1);
        expect(result.status).toEqual('SUCCEEDED');
    });
});

describe('LdkNode.formatChannel', () => {
    const formatChannel = (overrides: any = {}) =>
        (new LdkNode() as any).formatChannel({
            channelId: 'abc',
            counterpartyNodeId: 'peer-1',
            channelValueSats: 100000,
            outboundCapacityMsat: 40000000,
            inboundCapacityMsat: 59000000,
            unspendablePunishmentReserve: 1000,
            counterpartyUnspendablePunishmentReserve: 1000,
            isUsable: true,
            isAnnounced: false,
            isOutbound: true,
            ...overrides
        });

    it('reports the force-close spend delay as the CSV delay', () => {
        expect(formatChannel({ forceCloseSpendDelay: 144 }).csv_delay).toBe(
            144
        );
    });

    it('does not count an unclaimed inbound HTLC on either side', () => {
        // 1,000,000 sat channel opened by the peer: 200,000 ours, 100,000
        // in an inbound HTLC, 1,000 in commit fee and anchors, 699,000 theirs
        const channel = formatChannel({
            channelValueSats: 1_000_000,
            outboundCapacityMsat: 190_000_000,
            inboundCapacityMsat: 689_000_000,
            unspendablePunishmentReserve: 10_000,
            counterpartyUnspendablePunishmentReserve: 10_000,
            isOutbound: false
        });

        expect(channel.local_balance).toEqual('200000');
        expect(channel.remote_balance).toEqual('699000');
    });

    it('reports no remote balance while the peer has no inbound capacity', () => {
        // 1,000,000 sat channel we opened and have not used: the peer holds
        // nothing, 2,000 is in commit fee and anchors
        const channel = formatChannel({
            channelValueSats: 1_000_000,
            outboundCapacityMsat: 988_000_000,
            inboundCapacityMsat: 0,
            unspendablePunishmentReserve: 10_000,
            counterpartyUnspendablePunishmentReserve: 10_000,
            isOutbound: true
        });

        expect(channel.remote_balance).toEqual('0');
        expect(channel.local_balance).toEqual('998000');
    });

    it('adds the peer reserve as soon as there is inbound capacity', () => {
        const channel = formatChannel({
            channelValueSats: 1_000_000,
            inboundCapacityMsat: 1000,
            unspendablePunishmentReserve: 10_000,
            counterpartyUnspendablePunishmentReserve: 10_000
        });

        expect(channel.remote_balance).toEqual('10001');
    });

    it('reports the inbound capacity when the peer reserve is not set', () => {
        const channel = formatChannel({
            inboundCapacityMsat: 59_000_000,
            counterpartyUnspendablePunishmentReserve: undefined
        });

        expect(channel.remote_balance).toEqual('59000');
    });

    it('reports 0 before the counterparty has accepted the channel', () => {
        // LDK leaves forceCloseSpendDelay unset on an outbound channel
        // until the counterparty accepts it
        expect(formatChannel().csv_delay).toBe(0);
    });
});

describe('LdkNode.getChannels', () => {
    const SAT = 1000;
    const ready = (inboundSats: number) => ({
        channelId: `chan-${inboundSats}`,
        counterpartyNodeId: 'lsp',
        channelValueSats: inboundSats * 2,
        outboundCapacityMsat: 0,
        inboundCapacityMsat: inboundSats * SAT,
        isChannelReady: true,
        isUsable: true,
        isAnnounced: false,
        isOutbound: false
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockListChannels.mockResolvedValue([ready(25_000), ready(22_650)]);
        mockListBalances.mockResolvedValue({ lightningBalances: [] });
    });

    it('reports the inbound createInvoice buys an LSPS2 channel against', async () => {
        const ldk = new LdkNode();
        ldk.isLsps2Active = () => true;

        const { channels, receivable_inbound_sat } = await ldk.getChannels();

        expect(channels).toHaveLength(2);
        // 47,650 of inbound, less the 2,000 sat margin kept per channel
        expect(receivable_inbound_sat).toBe(43_650);
    });

    it('leaves it out when receives use Flow 2.0', async () => {
        const ldk = new LdkNode();
        ldk.isLsps2Active = () => false;

        const data = await ldk.getChannels();

        expect(data).not.toHaveProperty('receivable_inbound_sat');
    });
});

describe('LdkNode.closeChannel', () => {
    let ldk: LdkNode;
    let emitEvent: (event: any) => void;
    let unsubscribed: boolean;

    const CHANNEL = {
        fundingTxo_txid: 'txid',
        userChannelId: 'user-channel-id',
        counterpartyNodeId: '02peer'
    };

    // Tracks the close without awaiting it, so tests can check that it is
    // still waiting
    const track = (close: Promise<any>) => {
        const state: { settled: boolean; error?: any } = { settled: false };
        close.then(
            () => (state.settled = true),
            (error) => {
                state.settled = true;
                state.error = error;
            }
        );
        return state;
    };

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        unsubscribed = false;
        ldk = new LdkNode();
        ldk.subscribeToEvents = (callback: any) => {
            emitEvent = callback;
            unsubscribed = false;
            return () => {
                unsubscribed = true;
            };
        };
        mockListChannels.mockResolvedValue([CHANNEL]);
        mockCloseChannel.mockResolvedValue(undefined);
        mockForceCloseChannel.mockResolvedValue(undefined);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe.each([
        ['cooperative', false, mockCloseChannel, mockForceCloseChannel],
        ['force', true, mockForceCloseChannel, mockCloseChannel]
    ])('%s close', (_name, force, called, notCalled) => {
        it('resolves once LDK reports the channel closed', async () => {
            const close = track(
                ldk.closeChannel(['txid', '0', force ? 'true' : ''])
            );
            await jest.advanceTimersByTimeAsync(0);

            expect(called).toHaveBeenCalledWith({
                userChannelId: 'user-channel-id',
                counterpartyNodeId: '02peer'
            });
            expect(notCalled).not.toHaveBeenCalled();
            expect(close.settled).toBe(false);

            emitEvent({
                type: 'channelClosed',
                userChannelId: 'user-channel-id'
            });
            await jest.advanceTimersByTimeAsync(0);

            expect(close.settled).toBe(true);
            expect(close.error).toBeUndefined();
            expect(unsubscribed).toBe(true);
        });
    });

    it('rejects an unknown channel without subscribing', async () => {
        let subscribed = false;
        ldk.subscribeToEvents = () => {
            subscribed = true;
            return () => {};
        };

        await expect(
            ldk.closeChannel(['unknown-txid', '0', ''])
        ).rejects.toThrow('error.channelNotFound');

        expect(subscribed).toBe(false);
        expect(mockCloseChannel).not.toHaveBeenCalled();
        expect(mockForceCloseChannel).not.toHaveBeenCalled();
    });

    it('resolves when channelClosed arrives before the close call returns', async () => {
        let returnClose: () => void = () => {};
        mockCloseChannel.mockReturnValue(
            new Promise<void>((resolve) => {
                returnClose = resolve;
            })
        );

        const close = track(ldk.closeChannel(['txid', '0', '']));
        await jest.advanceTimersByTimeAsync(0);
        emitEvent({
            type: 'channelClosed',
            userChannelId: 'user-channel-id'
        });
        await jest.advanceTimersByTimeAsync(0);

        // still waiting on the close call itself
        expect(close.settled).toBe(false);
        expect(unsubscribed).toBe(true);

        returnClose();
        await jest.advanceTimersByTimeAsync(0);

        expect(close.settled).toBe(true);
        expect(close.error).toBeUndefined();
    });

    it('ignores other channels and other events', async () => {
        const close = track(ldk.closeChannel(['txid', '0', '']));
        await jest.advanceTimersByTimeAsync(0);

        emitEvent({ type: 'channelClosed', userChannelId: 'other-channel' });
        emitEvent({ type: 'channelReady', userChannelId: 'user-channel-id' });
        await jest.advanceTimersByTimeAsync(0);

        expect(close.settled).toBe(false);
        expect(unsubscribed).toBe(false);
    });

    describe('closure reason', () => {
        beforeEach(() => {
            // the shared LocaleUtils mock drops substitutions, so include
            // them to check which reason ends up in the error
            jest.spyOn(LocaleUtils, 'localeString').mockImplementation(
                (key: string, substitutions?: any) =>
                    substitutions
                        ? `${key} ${JSON.stringify(substitutions)}`
                        : key
            );
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        const closeWithReason = async (force: boolean, reason?: any) => {
            const close = track(
                ldk.closeChannel(['txid', '0', force ? 'true' : ''])
            );
            await jest.advanceTimersByTimeAsync(0);
            emitEvent({
                type: 'channelClosed',
                userChannelId: 'user-channel-id',
                reason
            });
            await jest.advanceTimersByTimeAsync(0);
            expect(close.settled).toBe(true);
            expect(unsubscribed).toBe(true);
            return close;
        };

        it.each([
            'locallyInitiatedCooperativeClosure',
            'counterpartyInitiatedCooperativeClosure',
            'legacyCooperativeClosure',
            'locallyCoopClosedUnfundedChannel',
            'counterpartyCoopClosedUnfundedChannel'
        ])('resolves a cooperative close that ends with %s', async (type) => {
            const close = await closeWithReason(false, { type });
            expect(close.error).toBeUndefined();
        });

        it('resolves a cooperative close when the event has no reason', async () => {
            const close = await closeWithReason(false, undefined);
            expect(close.error).toBeUndefined();
        });

        it('rejects a cooperative close that LDK turned into a force close', async () => {
            const close = await closeWithReason(false, {
                type: 'processingError',
                peerMessage:
                    'remote wants something (4073 sat) higher than our max fee (1182 sat)'
            });

            expect(close.error?.message).toEqual(
                'views.Channel.coopCloseBecameForceClose {"reason":"views.Channel.closureReason.processingError {\\"peerMessage\\":\\"remote wants something (4073 sat) higher than our max fee (1182 sat)\\"}"}'
            );
            // tells callers the channel is gone despite the error
            expect((close.error as any)?.channelClosed).toBe(true);
        });

        it.each([
            'holderForceClosed',
            'counterpartyForceClosed',
            'commitmentTxConfirmed',
            'htlcsTimedOut',
            'disconnectedPeer'
        ])('rejects a cooperative close that ends with %s', async (type) => {
            const close = await closeWithReason(false, { type });

            expect(close.error?.message).toContain(
                'views.Channel.coopCloseBecameForceClose'
            );
        });

        it.each([
            'holderForceClosed',
            'processingError',
            'commitmentTxConfirmed',
            'locallyInitiatedCooperativeClosure'
        ])('resolves a force close that ends with %s', async (type) => {
            const close = await closeWithReason(true, { type });
            expect(close.error).toBeUndefined();
        });

        it('ignores a force close of another channel', async () => {
            const close = track(ldk.closeChannel(['txid', '0', '']));
            await jest.advanceTimersByTimeAsync(0);

            emitEvent({
                type: 'channelClosed',
                userChannelId: 'other-channel',
                reason: { type: 'holderForceClosed' }
            });
            await jest.advanceTimersByTimeAsync(0);
            expect(close.settled).toBe(false);

            emitEvent({
                type: 'channelClosed',
                userChannelId: 'user-channel-id',
                reason: { type: 'locallyInitiatedCooperativeClosure' }
            });
            await jest.advanceTimersByTimeAsync(0);
            expect(close.settled).toBe(true);
            expect(close.error).toBeUndefined();
        });

        it('rejects once the close call returns when the force close event arrives first', async () => {
            let returnClose: () => void = () => {};
            mockCloseChannel.mockReturnValue(
                new Promise<void>((resolve) => {
                    returnClose = resolve;
                })
            );

            const close = track(ldk.closeChannel(['txid', '0', '']));
            await jest.advanceTimersByTimeAsync(0);
            emitEvent({
                type: 'channelClosed',
                userChannelId: 'user-channel-id',
                reason: { type: 'holderForceClosed' }
            });
            await jest.advanceTimersByTimeAsync(0);
            expect(close.settled).toBe(false);

            returnClose();
            await jest.advanceTimersByTimeAsync(0);

            expect(close.error?.message).toContain(
                'views.Channel.coopCloseBecameForceClose'
            );
        });

        it('reports the close call error over a later force close event', async () => {
            mockCloseChannel.mockRejectedValue(new Error('peer disconnected'));

            const close = track(ldk.closeChannel(['txid', '0', '']));
            await jest.advanceTimersByTimeAsync(0);
            emitEvent({
                type: 'channelClosed',
                userChannelId: 'user-channel-id',
                reason: { type: 'holderForceClosed' }
            });
            await jest.advanceTimersByTimeAsync(0);

            expect(close.error?.message).toEqual('peer disconnected');
        });
    });

    it('rejects and stops listening when LDK rejects the close', async () => {
        mockCloseChannel.mockRejectedValue(new Error('peer disconnected'));

        const close = track(ldk.closeChannel(['txid', '0', '']));
        await jest.advanceTimersByTimeAsync(0);

        expect(close.error?.message).toEqual('peer disconnected');
        expect(unsubscribed).toBe(true);
    });

    it('resolves after a minute without the event', async () => {
        const close = track(ldk.closeChannel(['txid', '0', '']));

        await jest.advanceTimersByTimeAsync(59_999);
        expect(close.settled).toBe(false);

        await jest.advanceTimersByTimeAsync(1);
        expect(close.settled).toBe(true);
        expect(close.error).toBeUndefined();
        expect(unsubscribed).toBe(true);
    });
});

describe('LdkNode.createWithdrawalRequest', () => {
    it('takes the amount in sats and initiates the refund in msat', async () => {
        mockBolt12InitiateRefund.mockResolvedValue('lnr1...');

        const result = await new LdkNode().createWithdrawalRequest({
            amount: '100',
            description: 'pocket money'
        });

        expect(result).toEqual({ bolt12: 'lnr1...' });
        expect(mockBolt12InitiateRefund).toHaveBeenCalledWith(
            expect.objectContaining({ amountMsat: 100_000 })
        );
    });
});

describe('LdkNode.redeemWithdrawalRequest', () => {
    let ldk: LdkNode;
    let payments: any[];

    // ldk-node keys a refund payment by its payment hash
    const refundPayment = (
        hash: string,
        status: string,
        direction = 'inbound'
    ) => ({
        id: hash,
        direction,
        status,
        amountMsat: 250_000_000,
        latestUpdateTimestamp: 0,
        kind: { type: 'bolt12Refund', hash }
    });

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        ldk = new LdkNode();
        ldk.subscribeToEvents = () => () => {};
        // A withdrawal request redeemed earlier, still pending
        payments = [refundPayment('earlier-hash', 'pending')];
        mockListPayments.mockImplementation(async () => [...payments]);
        // ldk-node lists the new payment as pending and returns at once
        mockBolt12RequestRefundPayment.mockImplementation(
            async (invreq: string) => {
                const paymentHash = `${invreq}-hash`;
                payments.push(refundPayment(paymentHash, 'pending'));
                return { invoice: `lni-${invreq}`, paymentHash };
            }
        );
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    const redeem = (invreq = 'lnr1') => {
        const outcome: any = {};
        ldk.redeemWithdrawalRequest({ invreq, label: '' }).then(
            (result) => (outcome.result = result),
            (error) => (outcome.error = error)
        );
        return outcome;
    };

    it('does not resolve before the payment is received', async () => {
        const outcome = redeem();

        await jest.advanceTimersByTimeAsync(5_000);

        expect(mockBolt12RequestRefundPayment).toHaveBeenCalledWith('lnr1');
        expect(outcome).toEqual({});
    });

    it('resolves once the payment has been received', async () => {
        const outcome = redeem();
        await jest.advanceTimersByTimeAsync(5_000);

        payments[1] = refundPayment('lnr1-hash', 'succeeded');
        await jest.advanceTimersByTimeAsync(1_000);

        expect(outcome.error).toBeUndefined();
        expect(outcome.result).toEqual({
            bolt12: 'lni-lnr1',
            payment_hash: 'lnr1-hash'
        });
    });

    it('ignores an earlier refund payment that succeeds meanwhile', async () => {
        const outcome = redeem();
        await jest.advanceTimersByTimeAsync(1_000);

        payments[0] = refundPayment('earlier-hash', 'succeeded');
        await jest.advanceTimersByTimeAsync(5_000);

        expect(outcome).toEqual({});
    });

    it('waits for its own payment when redeemed concurrently', async () => {
        const first = redeem('lnr1');
        const second = redeem('lnr2');
        await jest.advanceTimersByTimeAsync(1_000);

        payments = payments.map((p) =>
            p.id === 'earlier-hash' ? p : refundPayment(p.id, 'succeeded')
        );
        await jest.advanceTimersByTimeAsync(1_000);

        expect([
            first.result?.payment_hash,
            second.result?.payment_hash
        ]).toEqual(['lnr1-hash', 'lnr2-hash']);
        expect(first.result).toEqual({
            bolt12: 'lni-lnr1',
            payment_hash: 'lnr1-hash'
        });
        expect(second.result).toEqual({
            bolt12: 'lni-lnr2',
            payment_hash: 'lnr2-hash'
        });
    });

    it('waits for a payment that is listed after the request returns', async () => {
        mockBolt12RequestRefundPayment.mockResolvedValue({
            invoice: 'lni-lnr1',
            paymentHash: 'lnr1-hash'
        });

        const outcome = redeem();
        await jest.advanceTimersByTimeAsync(2_000);

        expect(outcome).toEqual({});

        payments.push(refundPayment('lnr1-hash', 'succeeded'));
        await jest.advanceTimersByTimeAsync(1_000);

        expect(outcome.result).toEqual({
            bolt12: 'lni-lnr1',
            payment_hash: 'lnr1-hash'
        });
    });

    it('rejects when the invoice is not paid in time', async () => {
        const outcome = redeem();

        await jest.advanceTimersByTimeAsync(100_000);

        expect(outcome.result).toBeUndefined();
        expect(outcome.error.message).toEqual(
            'backends.LdkNode.withdrawalRequestNotPaid'
        );
    });

    it('rejects when the payment fails', async () => {
        const outcome = redeem();
        await jest.advanceTimersByTimeAsync(1_000);

        payments[1] = refundPayment('lnr1-hash', 'failed');
        await jest.advanceTimersByTimeAsync(1_000);

        expect(outcome.error.message).toEqual('PAYMENT_FAILED_UNKNOWN');
    });

    it('rejects when ldk-node refuses the request', async () => {
        mockBolt12RequestRefundPayment.mockRejectedValue(new Error('refused'));

        const outcome = redeem();
        await jest.advanceTimersByTimeAsync(0);

        expect(outcome.error.message).toEqual('refused');
    });
});

describe('LdkNode createInvoice', () => {
    let ldk: LdkNode;

    // The BOLT 11 example invoice; its content does not matter here
    const INVOICE =
        'lnbc2500u1pvjluezsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygspp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpquwpc4curk03c9wlrswe78q4eyqc7d8d0xqzpu9qrsgqhtjpauu9ur7fw2thcl4y9vfvh4m9wlfyz2gem29g5ghe2aak2pm3ps8fdhtceqsaagty2vph7utlgj48u0ged6a337aewvraedendscp573dxr';

    beforeEach(() => {
        jest.clearAllMocks();
        ldk = new LdkNode();
        ldk.subscribeToEvents = () => () => {};
        mockReceiveBolt11.mockResolvedValue(INVOICE);
        mockReceiveVariableAmountBolt11.mockResolvedValue(INVOICE);
    });

    it('passes an amount and expiry that fit the native types', async () => {
        await ldk.createInvoice({
            value: '21000',
            memo: 'order 17',
            expiry_seconds: String(0xffffffff)
        });

        expect(mockReceiveBolt11).toHaveBeenCalledWith({
            amountMsat: 21_000_000,
            description: 'order 17',
            expirySecs: 0xffffffff
        });
    });

    // The native module converts these with UInt32(_:) / UInt64(_:), which
    // terminate the iOS app on a value that does not fit instead of
    // rejecting, and an NWC make_invoice request picks both
    it.each([
        [
            'an expiry above UInt32.max',
            { value: '21000', expiry_seconds: '4294967296' }
        ],
        ['a negative expiry', { value: '21000', expiry_seconds: '-1' }],
        ['an infinite expiry', { value: '21000', expiry_seconds: 'Infinity' }],
        [
            'an amount above UInt64.max',
            { value: '1e20', expiry_seconds: '3600' }
        ],
        ['a negative amount', { value: '-1', expiry_seconds: '3600' }],
        ['a non-numeric amount', { value: 'abc', expiry_seconds: '3600' }],
        [
            'an expiry above UInt32.max on an any-amount invoice',
            { value: '0', expiry_seconds: '4294967296' }
        ]
    ])('rejects %s before calling the native module', async (_name, data) => {
        await expect(ldk.createInvoice(data)).rejects.toThrow(
            'error.invalidInvoiceAmountOrExpiry'
        );

        expect(mockReceiveBolt11).not.toHaveBeenCalled();
        expect(mockReceiveVariableAmountBolt11).not.toHaveBeenCalled();
    });
});

describe('LdkNode.getPayments', () => {
    // LDK lists a keysend with the preimage the sender chose, whatever its
    // status; the app reads a preimage as proof of settlement
    const keysend = (status: string) => ({
        id: PAYMENT_ID,
        direction: 'outbound',
        status,
        amountMsat: 3_000_000,
        latestUpdateTimestamp: 0,
        kind: { type: 'spontaneous', hash: 'hash', preimage: '01'.repeat(32) }
    });

    const listed = async (status: string) => {
        mockListPayments.mockResolvedValue([keysend(status)]);
        const { payments } = await new LdkNode().getPayments();
        return new Payment(payments[0]);
    };

    it('keeps the preimage of a keysend that arrived', async () => {
        const payment = await listed('succeeded');

        expect(payment.getPreimage).toEqual('01'.repeat(32));
        expect(payment.isIncomplete).toBe(false);
        expect(payment.isFailed).toBe(false);
    });

    it('lists a failed keysend as failed, without a preimage', async () => {
        const payment = await listed('failed');

        expect(payment.getPreimage).toEqual('');
        expect(payment.isIncomplete).toBe(true);
        expect(payment.isFailed).toBe(true);
    });

    it('lists a pending keysend as incomplete', async () => {
        const payment = await listed('pending');

        expect(payment.getPreimage).toEqual('');
        expect(payment.isIncomplete).toBe(true);
        expect(payment.isFailed).toBe(false);
    });
});

describe('LdkNode.lookupPayment', () => {
    const HASH = 'ab'.repeat(32);
    const entry = (
        direction: string,
        type: string,
        amountMsat: number,
        hash = HASH
    ) => ({
        id: `${direction}-${type}`,
        direction,
        status: 'pending',
        amountMsat,
        latestUpdateTimestamp: 0,
        kind: { type, hash }
    });

    beforeEach(() => mockListPayments.mockReset());

    it('returns the outbound lightning payment, not an inbound or on-chain entry with the same hash', async () => {
        // listed first, so a lookup without either filter would pick them
        mockListPayments.mockResolvedValue([
            entry('inbound', 'bolt11', 1_000_000),
            entry('outbound', 'onchain', 2_000_000),
            entry('outbound', 'bolt11', 3_000_000)
        ]);

        const payment = await new LdkNode().lookupPayment({
            payment_hash: HASH
        });

        expect(payment).toMatchObject({
            payment_hash: HASH,
            value_sat: '3000',
            status: 'IN_FLIGHT'
        });
    });

    it('matches the hash case-insensitively', async () => {
        mockListPayments.mockResolvedValue([
            entry('outbound', 'bolt11', 3_000_000)
        ]);

        const payment = await new LdkNode().lookupPayment({
            payment_hash: HASH.toUpperCase()
        });

        expect(payment).toMatchObject({ value_sat: '3000' });
    });

    it('answers null for an unknown hash', async () => {
        mockListPayments.mockResolvedValue([
            entry('outbound', 'bolt11', 3_000_000, 'cd'.repeat(32))
        ]);

        await expect(
            new LdkNode().lookupPayment({ payment_hash: HASH })
        ).resolves.toBeNull();
    });

    it('answers null when only inbound or on-chain entries carry the hash', async () => {
        mockListPayments.mockResolvedValue([
            entry('inbound', 'bolt11', 1_000_000),
            entry('outbound', 'onchain', 2_000_000)
        ]);

        await expect(
            new LdkNode().lookupPayment({ payment_hash: HASH })
        ).resolves.toBeNull();
    });
});

// LNURL-auth hashing key: sha256 of the node's signature string, one byte
// per code point (Base64Utils.stringToUint8Array). Expected value computed
// with Node's crypto; a changed value would change every LNURL-auth identity.
describe('LdkNode.lnurlAuth', () => {
    it('returns sha256 of the node signature as the hashing key', async () => {
        const backend: any = new LdkNode();
        backend.signMessage = jest.fn().mockResolvedValue({
            signature:
                'd7xkpk3e8zfm6rjd9x6zgttdqohkxyqgcxkxrg4uhhrbg5fh1sx7kwsfdr6pmsxjhb9pwftgj8uznsyqdbj4ri8p3bp9m6ux8kqxoaz'
        });

        const { signature } = await backend.lnurlAuth(
            LNURLAUTH_CANONICAL_PHRASE
        );

        expect(backend.signMessage).toHaveBeenCalledWith(
            LNURLAUTH_CANONICAL_PHRASE
        );
        expect(Buffer.from(signature).toString('hex')).toBe(
            '974844ab2f50a8fc85ca54a9fc686854e902ad46f1b72219d05e0f371f29bb8c'
        );
    });
});

describe('LdkNode.requestLsps1Liquidity', () => {
    // the map lsps1OrderStatusToMap / serializeLsps1OrderStatus build in the
    // Android and iOS modules
    const nativeOrder = (announceChannel: boolean) => ({
        orderId: 'order-1',
        orderParams: {
            lspBalanceSat: 1000000,
            clientBalanceSat: 0,
            requiredChannelConfirmations: 3,
            fundingConfirmsWithinBlocks: 6,
            channelExpiryBlocks: 13140,
            token: '',
            announceChannel
        },
        paymentInfo: {
            state: 'ExpectPayment',
            feeTotalSat: 2000,
            orderTotalSat: 2000,
            bolt11Invoice: {
                state: 'ExpectPayment',
                expiresAt: '2026-11-03T00:00:00Z',
                feeTotalSat: 2000,
                orderTotalSat: 2000,
                invoice: 'lnbc1'
            }
        }
    });

    let ldk: LdkNode;

    beforeEach(() => {
        jest.clearAllMocks();
        ldk = new LdkNode();
    });

    it('passes the request through to the native module', async () => {
        mockLsps1RequestChannel.mockResolvedValue(nativeOrder(false));
        await ldk.requestLsps1Liquidity({
            amount_sat: 1000000,
            client_balance_sat: 0,
            expiry_blocks: 13140,
            announce_channel: true
        });
        expect(mockLsps1RequestChannel).toHaveBeenCalledWith({
            lspBalanceSat: 1000000,
            clientBalanceSat: 0,
            channelExpiryBlocks: 13140,
            announceChannel: true
        });
    });

    it.each([false, true])(
        'maps the order terms with announceChannel %p',
        async (announceChannel) => {
            mockLsps1RequestChannel.mockResolvedValue(
                nativeOrder(announceChannel)
            );
            const order = await ldk.requestLsps1Liquidity({
                amount_sat: 1000000,
                expiry_blocks: 13140
            });
            expect(order).toMatchObject({
                order_id: 'order-1',
                lsp_balance_sat: 1000000,
                client_balance_sat: 0,
                funding_confirms_within_blocks: 6,
                channel_expiry_blocks: 13140,
                announce_channel: announceChannel,
                payment: {
                    state: 'ExpectPayment',
                    fee_total_sat: 2000,
                    order_total_sat: 2000,
                    bolt11_invoice: 'lnbc1'
                }
            });
        }
    );

    it('falls back to a one-year expiry when none is given', async () => {
        mockLsps1RequestChannel.mockResolvedValue(nativeOrder(false));
        await ldk.requestLsps1Liquidity({ amount_sat: 1000000 });
        expect(mockLsps1RequestChannel).toHaveBeenCalledWith(
            expect.objectContaining({ channelExpiryBlocks: 52560 })
        );
    });
});

describe('LdkNode.lookupInvoice', () => {
    it('throws an error callers read as "invoice not found" for a hash the node does not list', async () => {
        mockListPayments.mockResolvedValue([]);

        const error = await new LdkNode()
            .lookupInvoice({ r_hash: 'ab'.repeat(32) })
            .then(
                () => undefined,
                (e: any) => e
            );

        expect(error).toBeInstanceOf(Error);
        expect(isInvoiceNotFoundError(error)).toBe(true);
    });

    it('does not read an outbound payment with the same hash as the invoice', async () => {
        mockListPayments.mockResolvedValue([
            {
                id: PAYMENT_ID,
                direction: 'outbound',
                status: 'succeeded',
                amountMsat: 1000,
                latestUpdateTimestamp: 0,
                kind: { type: 'bolt11', hash: 'ab'.repeat(32), preimage: '' }
            }
        ]);

        const error = await new LdkNode()
            .lookupInvoice({ r_hash: 'ab'.repeat(32) })
            .then(
                () => undefined,
                (e: any) => e
            );

        expect(isInvoiceNotFoundError(error)).toBe(true);
    });
});

describe('LdkNode.createInvoice', () => {
    const SAT = 1000;
    const channel = (inboundSats: number, extra: any = {}) => ({
        isChannelReady: true,
        inboundCapacityMsat: inboundSats * SAT,
        ...extra
    });
    const jitPayment = (openingFeeMsat: number) => ({
        id: 'jit',
        direction: 'inbound',
        status: 'pending',
        kind: {
            type: 'bolt11Jit',
            hash: 'hash',
            lspFeeLimits: { maxTotalOpeningFeeMsat: openingFeeMsat }
        }
    });
    const create = (value: string, lsps2_jit = true) =>
        new LdkNode().createInvoice({
            value,
            memo: 'memo',
            expiry_seconds: '3600',
            lsps2_jit
        });

    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(Bolt11Utils, 'decode').mockReturnValue({
            payment_hash: 'hash'
        } as any);
        mockReceiveBolt11.mockResolvedValue('lnbc-plain');
        mockReceiveVariableAmountBolt11.mockResolvedValue('lnbc-variable');
        mockReceiveViaJitChannel.mockResolvedValue('lnbc-jit');
        mockListPayments.mockResolvedValue([jitPayment(10_000 * SAT)]);
    });

    it('creates a plain invoice when existing inbound can take it', async () => {
        mockListChannels.mockResolvedValue([channel(60_000)]);

        const result = await create('50000');

        expect(mockReceiveViaJitChannel).not.toHaveBeenCalled();
        expect(result).toEqual({
            payment_request: 'lnbc-plain',
            r_hash: 'hash',
            add_index: ''
        });
    });

    it('buys a JIT channel when inbound is short and returns its fee', async () => {
        mockListChannels.mockResolvedValue([]);

        const result = await create('50000');

        expect(mockReceiveViaJitChannel).toHaveBeenCalledWith({
            amountMsat: 50_000 * SAT,
            description: 'memo',
            expirySecs: 3600,
            maxLspFeeLimitMsat: 50_000 * SAT - 1
        });
        expect(result).toEqual({
            payment_request: 'lnbc-jit',
            r_hash: 'hash',
            add_index: '',
            lsps2_jit: true,
            lsp_fee_msat: 10_000 * SAT
        });
    });

    it('caps a JIT invoice at an hour, and only a JIT invoice', async () => {
        const createWithExpiry = (expiry_seconds: string) =>
            new LdkNode().createInvoice({
                value: '50000',
                memo: 'memo',
                expiry_seconds,
                lsps2_jit: true
            });

        mockListChannels.mockResolvedValue([]);
        await createWithExpiry('86400');
        expect(mockReceiveViaJitChannel).toHaveBeenCalledWith(
            expect.objectContaining({ expirySecs: 3600 })
        );

        await createWithExpiry('600');
        expect(mockReceiveViaJitChannel).toHaveBeenLastCalledWith(
            expect.objectContaining({ expirySecs: 600 })
        );

        mockListChannels.mockResolvedValue([channel(60_000)]);
        await createWithExpiry('86400');
        expect(mockReceiveBolt11).toHaveBeenCalledWith(
            expect.objectContaining({ expirySecs: 86400 })
        );
    });

    it('adds up inbound across channels', async () => {
        mockListChannels.mockResolvedValue([channel(30_000), channel(30_000)]);

        await create('50000');

        expect(mockReceiveViaJitChannel).not.toHaveBeenCalled();
    });

    it('keeps a margin back on each channel', async () => {
        mockListChannels.mockResolvedValue([channel(50_000)]);

        await create('50000');

        expect(mockReceiveViaJitChannel).toHaveBeenCalled();
    });

    it("respects a channel's per-payment cap", async () => {
        mockListChannels.mockResolvedValue([
            channel(500_000, { inboundHtlcMaximumMsat: 40_000 * SAT })
        ]);

        await create('50000');

        expect(mockReceiveViaJitChannel).toHaveBeenCalled();
    });

    it('ignores channels that are not ready', async () => {
        mockListChannels.mockResolvedValue([
            channel(500_000, { isChannelReady: false })
        ]);

        await create('50000');

        expect(mockReceiveViaJitChannel).toHaveBeenCalled();
    });

    it('never buys a channel unless the caller allows it', async () => {
        mockListChannels.mockResolvedValue([]);

        await create('50000', false);

        expect(mockListChannels).not.toHaveBeenCalled();
        expect(mockReceiveViaJitChannel).not.toHaveBeenCalled();
        expect(mockReceiveBolt11).toHaveBeenCalled();
    });

    it('keeps no-amount invoices plain', async () => {
        mockListChannels.mockResolvedValue([]);

        await create('0');

        expect(mockReceiveViaJitChannel).not.toHaveBeenCalled();
        expect(mockReceiveVariableAmountBolt11).toHaveBeenCalled();
    });

    it('keeps 1 sat plain, and buys a channel from 2 sats', async () => {
        mockListChannels.mockResolvedValue([]);

        await create('1');

        expect(mockReceiveViaJitChannel).not.toHaveBeenCalled();
        expect(mockReceiveBolt11).toHaveBeenCalledWith(
            expect.objectContaining({ amountMsat: SAT })
        );

        await create('2');

        expect(mockReceiveViaJitChannel).toHaveBeenCalledWith(
            expect.objectContaining({
                amountMsat: 2 * SAT,
                maxLspFeeLimitMsat: 2 * SAT - 1
            })
        );
    });

    it.each([
        [
            'the node has no record of the payment',
            () => mockListPayments.mockResolvedValue([])
        ],
        [
            'the payment lookup fails',
            () => mockListPayments.mockRejectedValue(new Error('node busy'))
        ],
        [
            'the invoice cannot be decoded',
            () =>
                jest.spyOn(Bolt11Utils, 'decode').mockImplementation(() => {
                    throw new Error('bad invoice');
                })
        ]
    ])('marks a JIT invoice with an unknown fee when %s', async (_, setUp) => {
        mockListChannels.mockResolvedValue([]);
        setUp();

        const result = await create('50000');

        expect(result.lsps2_jit).toBe(true);
        expect(result.lsp_fee_msat).toBeUndefined();
    });

    it('explains LSP failures in plain language', async () => {
        mockListChannels.mockResolvedValue([]);
        mockReceiveViaJitChannel.mockRejectedValue(
            new Error('Failed to request inbound liquidity.')
        );

        await expect(create('50000')).rejects.toThrow(
            'stores.InvoicesStore.lsps2.requestFailed'
        );
    });
});

describe('LdkNode received JIT payments', () => {
    const received = (kind: any) => ({
        id: 'jit',
        direction: 'inbound',
        status: 'succeeded',
        amountMsat: 40_000_000,
        latestUpdateTimestamp: 0,
        kind: { hash: 'hash', ...kind }
    });
    const lookup = (kind: any) => {
        mockListPayments.mockResolvedValue([received(kind)]);
        return new LdkNode().lookupInvoice({ r_hash: 'hash' });
    };

    beforeEach(() => jest.clearAllMocks());

    it('reports the fee the LSP withheld next to the net amount', async () => {
        const invoice = await lookup({
            type: 'bolt11Jit',
            counterpartySkimmedFeeMsat: 10_000_000
        });

        expect(invoice.lsp_fee_msat).toEqual('10000000');
        expect(invoice.amt_paid_sat).toEqual('40000');
    });

    it('reports no fee for a plain payment, from either platform', async () => {
        // Android leaves the key out, iOS sends null
        expect((await lookup({ type: 'bolt11' })).lsp_fee_msat).toBeUndefined();
        expect(
            (
                await lookup({
                    type: 'bolt11Jit',
                    counterpartySkimmedFeeMsat: null
                })
            ).lsp_fee_msat
        ).toBeUndefined();
    });
});
