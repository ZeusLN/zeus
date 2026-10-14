jest.mock('dateformat', () => ({}));
jest.mock('./LocaleUtils', () => ({
    localeString: (s: string) => s
}));
jest.mock('../stores/Stores', () => ({ notesStore: { notes: {} } }));
jest.mock('../cashu-cdk', () => ({}));

import CashuInvoice from '../models/CashuInvoice';
import CashuPayment from '../models/CashuPayment';
import CashuToken from '../models/CashuToken';
import Invoice from '../models/Invoice';
import { LSPOrderState } from '../models/LSP';
import Payment from '../models/Payment';
import Transaction from '../models/Transaction';
import Swap, { SwapType } from '../models/Swap';
import { getActivityLayer, getRightTitleTheme } from './ActivityUtils';

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

    describe('getActivityLayer', () => {
        it.each([
            ['Cashu invoice', new CashuInvoice({}), 'ecash'],
            ['Cashu payment', new CashuPayment({}), 'ecash'],
            ['Cashu token', new CashuToken({}), 'ecash'],
            ['transaction', new Transaction({}), 'onchain'],
            [
                'submarine swap destination',
                new Swap({ type: SwapType.Submarine }),
                'lightning'
            ],
            [
                'reverse swap destination',
                new Swap({ type: SwapType.Reverse }),
                'onchain'
            ],
            ['invoice', new Invoice({}), 'lightning'],
            ['payment', new Payment({}), 'lightning'],
            ['LSPS1 order', { model: 'LSPS1Order' }, 'lightning'],
            ['LSPS7 order', { model: 'LSPS7Order' }, 'lightning'],
            ['unknown activity', {}, 'lightning'],
            ['null', null, 'lightning'],
            ['undefined', undefined, 'lightning']
        ])('%s', (_name, item, layer) => {
            expect(getActivityLayer(item)).toBe(layer);
        });
    });
});
