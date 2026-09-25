import CashuInvoice from '../models/CashuInvoice';
import CashuPayment from '../models/CashuPayment';
import CashuToken from '../models/CashuToken';
import Transaction from '../models/Transaction';
import Swap from '../models/Swap';

export function getActivityLayer(item: any): 'onchain' | 'lightning' | 'ecash' {
    if (
        item instanceof CashuInvoice ||
        item instanceof CashuPayment ||
        item instanceof CashuToken
    ) {
        return 'ecash';
    }

    if (item instanceof Transaction) return 'onchain';

    if (item instanceof Swap) {
        return item.isSubmarineSwap ? 'lightning' : 'onchain';
    }

    return 'lightning';
}
