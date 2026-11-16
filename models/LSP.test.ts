import { isValidOrderResponse } from './LSP';

const lsps1Order = {
    order_id: 'order-1',
    order_state: 'FAILED',
    lsp_balance_sat: '1000000',
    client_balance_sat: '0',
    required_channel_confirmations: 0,
    funding_confirms_within_blocks: 6,
    channel_expiry_blocks: 13000,
    token: '',
    created_at: '2026-10-01T00:00:00Z',
    announce_channel: false,
    payment: {
        bolt11: {
            state: 'EXPECT_PAYMENT',
            expires_at: '2026-10-01T01:00:00Z',
            fee_total_sat: '2000',
            order_total_sat: '2000',
            invoice: 'lnbc1'
        },
        onchain: null
    },
    channel: null
};

const lsps7Order = {
    order_id: 'ext-1',
    order_state: 'COMPLETED',
    channel_extension_expiry_blocks: 4320,
    new_channel_expiry_block: 900000,
    payment: { bolt11: { invoice: 'lnbc1', order_total_sat: '500' } },
    channel: {
        short_channel_id: '800000x1x0',
        max_channel_extension_expiry_blocks: 52000,
        expiration_block: 880000,
        original_order: { id: 'order-1', service: 'LSPS1' },
        extension_order_ids: ['ext-0']
    }
};

describe('isValidOrderResponse', () => {
    it.each([
        ['an LSPS1 order', lsps1Order],
        ['an LSPS1 order in a JSON-RPC reply', { id: '1', result: lsps1Order }],
        ['an LSPS7 order', lsps7Order],
        ['a free order', { ...lsps1Order, payment: {} }],
        [
            'an order as the LDK Node backend builds it',
            {
                result: {
                    order_id: 'order-1',
                    lsp_balance_sat: '1000000',
                    client_balance_sat: '0',
                    payment: {
                        state: 'Paid',
                        fee_total_sat: '2000',
                        order_total_sat: '2000',
                        bolt11_invoice: 'lnbc1',
                        onchain_address: 'bc1q',
                        onchain_payment: { address: 'bc1q', state: 'Paid' }
                    },
                    channel: {
                        funding_txid: 'ab'.repeat(32),
                        funding_vout: 0,
                        expires_at: '2027-01-01T00:00:00Z'
                    }
                }
            }
        ],
        [
            'an object field the readers do not use',
            { ...lsps1Order, metadata: { a: 1 } }
        ],
        [
            'a list field the readers do not use',
            { ...lsps1Order, token: ['a'] }
        ],
        [
            'a list payment field the readers do not use',
            {
                ...lsps1Order,
                payment: {
                    ...lsps1Order.payment,
                    onchain_payments: [{ outpoint: 'ab:0', sat: '2000' }]
                }
            }
        ],
        [
            'an object in a payment option the readers do not use',
            {
                ...lsps1Order,
                payment: {
                    bolt11: { ...lsps1Order.payment.bolt11, extra: { a: 1 } },
                    onchain: { address: 'bc1q', extra: ['a'] }
                }
            }
        ],
        [
            'an object channel field the readers do not use',
            { ...lsps7Order, channel: { ...lsps7Order.channel, extra: {} } }
        ],
        [
            'an object in original_order the readers do not use',
            {
                ...lsps7Order,
                channel: {
                    ...lsps7Order.channel,
                    original_order: { id: 'order-1', extra: { a: 1 } }
                }
            }
        ]
    ])('accepts %s', (_label, order) => {
        expect(isValidOrderResponse(order)).toBe(true);
    });

    it.each([
        ['no order', undefined],
        ['a string', 'order-1'],
        ['a list', [lsps1Order]],
        ['no order_id', { ...lsps1Order, order_id: undefined }],
        ['an object order_id', { ...lsps1Order, order_id: { id: 'order-1' } }],
        [
            'an object with its own toString as a balance',
            { ...lsps1Order, lsp_balance_sat: { toString: 0 } }
        ],
        [
            'an object as a field rendered as text',
            { ...lsps1Order, funding_confirms_within_blocks: { blocks: 6 } }
        ],
        ['an object order_state', { ...lsps1Order, order_state: { a: 1 } }],
        ['a list as a field', { ...lsps1Order, channel_expiry_blocks: ['a'] }],
        ['an object created_at', { ...lsps1Order, created_at: { a: 1 } }],
        ['a string payment', { ...lsps1Order, payment: 'lnbc1' }],
        [
            'an object as a payment amount',
            { ...lsps1Order, payment: { fee_total_sat: { toString: 0 } } }
        ],
        [
            'a nested object in a payment option',
            {
                ...lsps1Order,
                payment: { bolt11: { order_total_sat: { toString: 0 } } }
            }
        ],
        [
            'an empty object as a payment amount',
            { ...lsps1Order, payment: { fee_total_sat: {} } }
        ],
        [
            'a string payment option',
            { ...lsps1Order, payment: { bolt11: 'lnbc1' } }
        ],
        [
            'a list payment option',
            { ...lsps1Order, payment: { onchain: ['bc1q'] } }
        ],
        [
            'a nested object in the onchain payment option',
            { ...lsps1Order, payment: { onchain: { address: { a: 1 } } } }
        ],
        [
            'a string bolt12 payment option',
            { ...lsps1Order, payment: { bolt12: 'lno1' } }
        ],
        [
            'a string onchain_payment',
            { ...lsps1Order, payment: { onchain_payment: 'ab:0' } }
        ],
        ['a string channel', { ...lsps7Order, channel: '800000x1x0' }],
        [
            'a string original_order',
            {
                ...lsps7Order,
                channel: { ...lsps7Order.channel, original_order: 'order-1' }
            }
        ],
        [
            'an object in extension_order_ids',
            {
                ...lsps7Order,
                channel: {
                    ...lsps7Order.channel,
                    extension_order_ids: [{ id: 'ext-0' }]
                }
            }
        ],
        [
            'an object as a channel field',
            {
                ...lsps7Order,
                channel: { ...lsps7Order.channel, expiration_block: { a: 1 } }
            }
        ],
        [
            'a string extension_order_ids',
            {
                ...lsps7Order,
                channel: { ...lsps7Order.channel, extension_order_ids: 'ext-0' }
            }
        ],
        [
            'a nested object in original_order',
            {
                ...lsps7Order,
                channel: {
                    ...lsps7Order.channel,
                    original_order: { id: { a: 1 } }
                }
            }
        ]
    ])('rejects %s', (_label, order) => {
        expect(isValidOrderResponse(order)).toBe(false);
    });

    // every field the order screens, the orders list and the Activity list
    // read must be a scalar
    const notScalar = { a: 1 };

    it.each([
        'order_state',
        'lsp_balance_sat',
        'client_balance_sat',
        'announce_channel',
        'channel_expiry_blocks',
        'funding_confirms_within_blocks',
        'created_at',
        'expires_at',
        'channel_extension_expiry_blocks',
        'new_channel_expiry_block'
    ])('rejects an object as %s', (field) => {
        expect(
            isValidOrderResponse({ ...lsps1Order, [field]: notScalar })
        ).toBe(false);
    });

    it.each([
        'state',
        'order_total_sat',
        'fee_total_sat',
        'lightning_invoice',
        'bolt11_invoice',
        'min_fee_for_0conf',
        'min_onchain_payment_confirmations',
        'onchain_address'
    ])('rejects an object as payment.%s', (field) => {
        expect(
            isValidOrderResponse({
                ...lsps1Order,
                payment: { [field]: notScalar }
            })
        ).toBe(false);
    });

    it.each([
        ['bolt11', 'state'],
        ['bolt11', 'order_total_sat'],
        ['bolt11', 'fee_total_sat'],
        ['bolt11', 'expires_at'],
        ['bolt11', 'invoice'],
        ['onchain', 'order_total_sat'],
        ['onchain', 'fee_total_sat'],
        ['onchain', 'expires_at'],
        ['onchain', 'address'],
        ['onchain', 'min_fee_for_0conf'],
        ['onchain', 'min_onchain_payment_confirmations']
    ])('rejects an object as payment.%s.%s', (option, field) => {
        expect(
            isValidOrderResponse({
                ...lsps1Order,
                payment: { [option]: { [field]: notScalar } }
            })
        ).toBe(false);
    });

    it.each([
        'funding_outpoint',
        'funded_at',
        'expires_at',
        'short_channel_id',
        'max_channel_extension_expiry_blocks',
        'expiration_block'
    ])('rejects an object as channel.%s', (field) => {
        expect(
            isValidOrderResponse({
                ...lsps7Order,
                channel: { [field]: notScalar }
            })
        ).toBe(false);
    });

    it.each(['id', 'service'])(
        'rejects an object as channel.original_order.%s',
        (field) => {
            expect(
                isValidOrderResponse({
                    ...lsps7Order,
                    channel: { original_order: { [field]: notScalar } }
                })
            ).toBe(false);
        }
    );

    it('checks the result inside a JSON-RPC reply', () => {
        expect(
            isValidOrderResponse({
                id: '1',
                result: { ...lsps1Order, lsp_balance_sat: { toString: 0 } }
            })
        ).toBe(false);
    });
});
