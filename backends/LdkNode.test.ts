const mockListPayments = jest.fn();
const mockReceiveBolt11 = jest.fn();
const mockReceiveVariableAmountBolt11 = jest.fn();
const mockSendBolt11 = jest.fn();
const mockSendSpontaneousPayment = jest.fn();
const mockBolt12SendUsingAmount = jest.fn();
const mockBolt12InitiateRefund = jest.fn();
const mockBolt12DecodeOffer = jest.fn();
const mockListChannels = jest.fn();
const mockCloseChannel = jest.fn();
const mockForceCloseChannel = jest.fn();
const mockListBalances = jest.fn();
const mockStatus = jest.fn();
const mockListUtxos = jest.fn();
const mockReceiveViaJitChannel = jest.fn();

jest.mock('../ldknode/LdkNodeInjection', () => ({
    __esModule: true,
    default: {
        channel: {
            listChannels: (...args: any[]) => mockListChannels(...args),
            closeChannel: (...args: any[]) => mockCloseChannel(...args),
            forceCloseChannel: (...args: any[]) =>
                mockForceCloseChannel(...args)
        },
        node: {
            listBalances: (...args: any[]) => mockListBalances(...args),
            status: (...args: any[]) => mockStatus(...args)
        },
        onchain: {
            listUtxos: (...args: any[]) => mockListUtxos(...args)
        },
        payments: {
            listPayments: (...args: any[]) => mockListPayments(...args)
        },
        bolt11: {
            sendBolt11: (...args: any[]) => mockSendBolt11(...args),
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
        bolt12: {
            bolt12SendUsingAmount: (...args: any[]) =>
                mockBolt12SendUsingAmount(...args),
            bolt12InitiateRefund: (...args: any[]) =>
                mockBolt12InitiateRefund(...args),
            bolt12DecodeOffer: (...args: any[]) =>
                mockBolt12DecodeOffer(...args)
        }
    }
}));

jest.mock('../stores/Stores');

jest.mock('../utils/LocaleUtils');

import LdkNode from './LdkNode';
import Payment from '../models/Payment';
import Bolt11Utils from '../utils/Bolt11Utils';

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

    it('reports 0 before the counterparty has accepted the channel', () => {
        // LDK leaves forceCloseSpendDelay unset on an outbound channel
        // until the counterparty accepts it
        expect(formatChannel().csv_delay).toBe(0);
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

describe('LdkNode.getBlockchainBalance', () => {
    const mockBalances = (balances: {
        totalOnchainBalanceSats: number;
        spendableOnchainBalanceSats: number;
        totalAnchorChannelsReserveSats: number;
    }) =>
        mockListBalances.mockResolvedValue({
            totalLightningBalanceSats: 0,
            lightningBalances: [],
            pendingBalancesFromChannelClosures: [],
            ...balances
        });

    beforeEach(() => jest.clearAllMocks());

    it('reports the anchor channel reserve alongside the balances', async () => {
        mockBalances({
            totalOnchainBalanceSats: 130000,
            spendableOnchainBalanceSats: 75000,
            totalAnchorChannelsReserveSats: 25000
        });

        expect(await new LdkNode().getBlockchainBalance()).toEqual({
            total_balance: '130000',
            confirmed_balance: '100000',
            unconfirmed_balance: '30000',
            reserved_balance_anchor_chan: '25000'
        });
    });

    it('reports a zero reserve without anchor channels', async () => {
        mockBalances({
            totalOnchainBalanceSats: 50000,
            spendableOnchainBalanceSats: 50000,
            totalAnchorChannelsReserveSats: 0
        });

        const balance = await new LdkNode().getBlockchainBalance();
        expect(balance.confirmed_balance).toEqual('50000');
        expect(balance.reserved_balance_anchor_chan).toEqual('0');
    });

    it('still reports the reserve once it exceeds the spendable balance', async () => {
        mockBalances({
            totalOnchainBalanceSats: 20000,
            spendableOnchainBalanceSats: 0,
            totalAnchorChannelsReserveSats: 25000
        });
        mockListUtxos.mockResolvedValue([
            { txid: 'aa', vout: 0, value_sats: 20000, is_spent: false }
        ]);
        mockListPayments.mockResolvedValue([
            { kind: { type: 'onchain', txid: 'aa', confirmationHeight: 100 } }
        ]);
        mockStatus.mockResolvedValue({ currentBestBlock_height: 105 });

        const balance = await new LdkNode().getBlockchainBalance();
        expect(balance.confirmed_balance).toEqual('20000');
        expect(balance.reserved_balance_anchor_chan).toEqual('25000');
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
