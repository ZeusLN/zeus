import { localeString } from './LocaleUtils';
import { LSPOrderState } from '../models/LSP';
import CashuInvoice from '../models/CashuInvoice';
import CashuPayment from '../models/CashuPayment';
import CashuToken from '../models/CashuToken';
import Transaction from '../models/Transaction';
import Swap from '../models/Swap';

export type ActivityRightTitleTheme =
    | 'text'
    | 'highlight'
    | 'secondaryText'
    | 'success'
    | 'warning'
    | 'warningReserve';

// TODO this feels like an odd place to do all this deciding
// TODO on-chain has "-" sign but lightning doesn't?
export const getRightTitleTheme = (item: any): ActivityRightTitleTheme => {
    if (item.getAmount == 0) return 'secondaryText';

    if (item.model === localeString('general.transaction')) {
        if (item.getAmount.toString().includes('-')) return 'warning';
        return 'success';
    }

    if (item.model === localeString('views.Payment.title')) return 'warning';

    if (item.model === localeString('views.Cashu.CashuPayment.title'))
        return 'warning';

    if (item.model === localeString('views.Swaps.title')) {
        return 'text';
    }

    if (item.model === 'LSPS1Order' || item.model === 'LSPS7Order') {
        switch (item.state) {
            case LSPOrderState.CREATED:
                return 'highlight';
            case LSPOrderState.COMPLETED:
                return 'success';
            case LSPOrderState.FAILED:
                return 'warning';
            default:
                return 'text';
        }
    }

    if (item.model === localeString('cashu.token')) {
        return item.sent ? (item.spent ? 'warning' : 'highlight') : 'success';
    }

    if (item.model === localeString('views.Invoice.title')) {
        if (item.isExpired && !item.isPaid) {
            return 'text';
        } else if (!item.isPaid) {
            return 'highlight';
        }
    }

    if (item.model === localeString('views.Cashu.CashuInvoice.title')) {
        if (item.isExpired && !item.isPaid) {
            return 'text';
        } else if (!item.isPaid) {
            return 'highlight';
        }
    }

    if (item.isPaid) return 'success';

    return 'secondaryText';
};

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
