jest.mock('../stores/Stores', () => ({}));
jest.mock('./LocaleUtils', () => ({
    localeString: (s: string) => s
}));

import { LSPOrderState } from '../models/LSP';
import Transaction from '../models/Transaction';
import { getRightTitleTheme, getTransactionSubtitle } from './ActivityUtils';

describe('ActivityUtils', () => {
    describe('getRightTitleTheme', () => {
        it('uses secondaryText for zero amounts regardless of type', () => {
            expect(
                getRightTitleTheme({
                    getAmount: 0,
                    model: 'views.Payment.title'
                })
            ).toBe('secondaryText');
            expect(
                getRightTitleTheme({
                    getAmount: '0',
                    model: 'general.transaction'
                })
            ).toBe('secondaryText');
        });

        it('colors on-chain transactions by sign', () => {
            expect(
                getRightTitleTheme({
                    getAmount: '-1000',
                    model: 'general.transaction'
                })
            ).toBe('warning');
            expect(
                getRightTitleTheme({
                    getAmount: 1000,
                    model: 'general.transaction'
                })
            ).toBe('success');
        });

        it('uses warning for lightning and Cashu payments', () => {
            expect(
                getRightTitleTheme({
                    getAmount: 1000,
                    model: 'views.Payment.title'
                })
            ).toBe('warning');
            expect(
                getRightTitleTheme({
                    getAmount: 1000,
                    model: 'views.Cashu.CashuPayment.title'
                })
            ).toBe('warning');
        });

        it('uses text for swaps', () => {
            expect(
                getRightTitleTheme({
                    getAmount: 1000,
                    model: 'views.Swaps.title'
                })
            ).toBe('text');
        });

        it.each([
            ['LSPS1Order', LSPOrderState.CREATED, 'highlight'],
            ['LSPS1Order', LSPOrderState.COMPLETED, 'success'],
            ['LSPS1Order', LSPOrderState.FAILED, 'warning'],
            ['LSPS1Order', 'UNKNOWN', 'text'],
            ['LSPS7Order', LSPOrderState.CREATED, 'highlight'],
            ['LSPS7Order', LSPOrderState.COMPLETED, 'success'],
            ['LSPS7Order', LSPOrderState.FAILED, 'warning']
        ])('maps %s in state %s to %s', (model, state, expected) => {
            expect(getRightTitleTheme({ getAmount: 1000, model, state })).toBe(
                expected
            );
        });

        it('colors Cashu tokens by sent and spent state', () => {
            const token = { getAmount: 1000, model: 'cashu.token' };
            expect(
                getRightTitleTheme({ ...token, sent: true, spent: true })
            ).toBe('warning');
            expect(
                getRightTitleTheme({ ...token, sent: true, spent: false })
            ).toBe('highlight');
            expect(getRightTitleTheme({ ...token, sent: false })).toBe(
                'success'
            );
        });

        it.each(['views.Invoice.title', 'views.Cashu.CashuInvoice.title'])(
            'colors %s by paid and expired state',
            (model) => {
                const invoice = { getAmount: 1000, model };
                expect(
                    getRightTitleTheme({
                        ...invoice,
                        isPaid: false,
                        isExpired: true
                    })
                ).toBe('text');
                expect(
                    getRightTitleTheme({
                        ...invoice,
                        isPaid: false,
                        isExpired: false
                    })
                ).toBe('highlight');
                expect(
                    getRightTitleTheme({
                        ...invoice,
                        isPaid: true,
                        isExpired: true
                    })
                ).toBe('success');
            }
        );

        it('falls back to success when paid and secondaryText otherwise', () => {
            expect(
                getRightTitleTheme({
                    getAmount: 1000,
                    model: 'other',
                    isPaid: true
                })
            ).toBe('success');
            expect(
                getRightTitleTheme({ getAmount: 1000, model: 'other' })
            ).toBe('secondaryText');
        });
    });
    describe('getTransactionSubtitle', () => {
        it('labels a transaction with 0 confirmations unconfirmed', () => {
            expect(
                getTransactionSubtitle(
                    new Transaction({ amount: '-50000', num_confirmations: 0 })
                )
            ).toBe('general.onchain: general.unconfirmed');
        });

        it('labels an embedded LND transaction with no num_confirmations unconfirmed', () => {
            // embedded LND keeps a 0 num_confirmations on the protobuf
            // prototype, and BaseModel only copies own fields
            expect(
                getTransactionSubtitle(new Transaction({ amount: '-50000' }))
            ).toBe('general.onchain: general.unconfirmed');
        });

        it('labels an LDK Node pending transaction unconfirmed', () => {
            expect(
                getTransactionSubtitle(
                    new Transaction({
                        amount: '-50000',
                        num_confirmations: 0,
                        status: 'pending'
                    })
                )
            ).toBe('general.onchain: general.unconfirmed');
        });

        it('labels a confirmed transaction on-chain only', () => {
            expect(
                getTransactionSubtitle(
                    new Transaction({ amount: '100000', num_confirmations: 3 })
                )
            ).toBe('general.onchain');
            expect(
                getTransactionSubtitle(
                    new Transaction({ amount: '100000', status: 'confirmed' })
                )
            ).toBe('general.onchain');
        });
    });
});
