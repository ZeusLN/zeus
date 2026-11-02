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

jest.mock('../ldknode/LdkNodeInjection', () => ({
    __esModule: true,
    default: {
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
            receiveBolt11: (...args: any[]) => mockReceiveBolt11(...args),
            receiveVariableAmountBolt11: (...args: any[]) =>
                mockReceiveVariableAmountBolt11(...args)
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

    describe('payLightningInvoice', () => {
        const pay = () =>
            ldk.payLightningInvoice({
                payment_request: 'lnbcrt1...',
                timeout_seconds: '1'
            });

        it('reports a payment still pending at timeout as in flight', async () => {
            mockListPayments.mockResolvedValue([pendingPayment('hash')]);

            const { result, error }: any = await settle(pay());

            expect(error).toBeUndefined();
            expect(result.status).toEqual('IN_FLIGHT');
            expect(result.payment_hash).toEqual('hash');
            expect(result.payment_preimage).toEqual('');
            // SendingLightning reads any payment_route as success
            expect(result.payment_route).toBeUndefined();
        });

        it('reports a payment not yet listed at timeout as in flight, keyed by the payment id', async () => {
            mockListPayments.mockResolvedValue([]);

            const { result }: any = await settle(pay());

            expect(result.status).toEqual('IN_FLIGHT');
            expect(result.payment_hash).toEqual(PAYMENT_ID);
        });

        it('still reports a succeeded payment with a route', async () => {
            mockListPayments.mockResolvedValue([succeededPayment(1000)]);

            const { result }: any = await settle(pay());

            expect(result.status).toEqual('SUCCEEDED');
            expect(result.payment_hash).toEqual('hash');
            expect(result.payment_route).toEqual({});
        });

        it('still fails a payment LDK marked failed', async () => {
            mockListPayments.mockResolvedValue([
                { ...pendingPayment('hash'), status: 'failed' }
            ]);

            const { error }: any = await settle(pay());

            expect(error.message).toEqual('PAYMENT_FAILED_UNKNOWN');
        });
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
