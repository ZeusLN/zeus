jest.mock('dateformat', () => ({}));
jest.mock('./LocaleUtils', () => ({ localeString: (s: string) => s }));
jest.mock('../stores/Stores', () => ({ notesStore: { notes: {} } }));
jest.mock('../cashu-cdk', () => ({}));

import CashuInvoice from '../models/CashuInvoice';
import CashuPayment from '../models/CashuPayment';
import CashuToken from '../models/CashuToken';
import Invoice from '../models/Invoice';
import Payment from '../models/Payment';
import Transaction from '../models/Transaction';
import Swap, { SwapType } from '../models/Swap';
import { getActivityLayer } from './ActivityIconUtils';

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
