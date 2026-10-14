import { localeString } from './LocaleUtils';
import { LSPOrderState } from '../models/LSP';
import type Transaction from '../models/Transaction';

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

// embedded LND keeps a num_confirmations of 0 on the protobuf prototype,
// which BaseModel does not copy, so check isConfirmed instead of
// comparing num_confirmations to 0
export const getTransactionSubtitle = (transaction: Transaction): string =>
    transaction.isConfirmed
        ? localeString('general.onchain')
        : `${localeString('general.onchain')}: ${localeString(
              'general.unconfirmed'
          )}`;
