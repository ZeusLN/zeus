import Invoice from '../models/Invoice';
import Payment from '../models/Payment';
import Transaction from '../models/Transaction';
import CashuInvoice from '../models/CashuInvoice';
import CashuPayment from '../models/CashuPayment';
import CashuToken from '../models/CashuToken';
import { SwapType } from '../models/Swap';
import { LSPOrderState } from '../models/LSP';
import { localeString } from './LocaleUtils';

type ActivityLayer = 'lightning' | 'onchain' | 'cashu' | 'service' | 'swap';

export interface ActivityListItemPresentation {
    title: string;
    directionLabel: string;
    directionIcon: string;
    directionColor:
        | 'text'
        | 'highlight'
        | 'secondaryText'
        | 'success'
        | 'warning';
    layer?: ActivityLayer;
    layerLabel?: string;
}

const incoming = {
    directionIcon: 'call-received',
    directionColor: 'success' as const
};

const outgoing = {
    directionIcon: 'call-made',
    directionColor: 'warning' as const
};

const pending = {
    directionIcon: 'schedule',
    directionColor: 'highlight' as const
};

const neutral = {
    directionIcon: 'receipt',
    directionColor: 'secondaryText' as const
};

const failed = {
    directionIcon: 'error-outline',
    directionColor: 'secondaryText' as const
};

export function getActivityListItemPresentation(
    item: any
): ActivityListItemPresentation {
    if (item instanceof Invoice) {
        if (item.isPaid) {
            const directionLabel = item.is_amp
                ? localeString('views.Activity.youReceivedAmp')
                : localeString('views.Activity.youReceived');
            return {
                title: localeString('views.Invoice.title'),
                directionLabel,
                ...incoming,
                layer: 'lightning',
                layerLabel: localeString('general.lightning')
            };
        }

        const directionLabel = item.isExpired
            ? localeString('views.Activity.expiredRequested')
            : item.is_amp
            ? localeString('views.Activity.requestedPaymentAmp')
            : localeString('views.Activity.requestedPayment');

        return {
            title: directionLabel,
            directionLabel,
            ...(item.isExpired ? neutral : pending),
            layer: 'lightning',
            layerLabel: localeString('views.PaymentRequest.title')
        };
    }

    if (item instanceof Payment) {
        if (item.isFailed) {
            const directionLabel = localeString('views.Payment.failedPayment');
            return {
                title: directionLabel,
                directionLabel,
                ...failed,
                layer: 'lightning',
                layerLabel: localeString('general.lightning')
            };
        }

        if (item.isInTransit) {
            const directionLabel = localeString(
                'views.Payment.inTransitPayment'
            );
            return {
                title: directionLabel,
                directionLabel,
                ...pending,
                layer: 'lightning',
                layerLabel: localeString('general.lightning')
            };
        }

        return {
            title: localeString('views.Payment.title'),
            directionLabel: localeString('views.Activity.youSent'),
            ...outgoing,
            layer: 'lightning',
            layerLabel: localeString('general.lightning')
        };
    }

    if (item instanceof Transaction) {
        const amount = Number(item.getAmount);
        if (amount === 0) {
            return {
                title: localeString('views.Activity.channelOperation'),
                directionLabel: localeString('views.Activity.channelOperation'),
                directionIcon: 'swap-vert',
                directionColor: 'secondaryText',
                layer: 'onchain',
                layerLabel: localeString('general.onchain')
            };
        }

        const received = amount > 0;
        return {
            title: localeString('general.transaction'),
            directionLabel: received
                ? localeString('views.Activity.youReceived')
                : localeString('views.Activity.youSent'),
            ...(received ? incoming : outgoing),
            layer: 'onchain',
            layerLabel: localeString('general.onchain')
        };
    }

    if (item instanceof CashuToken) {
        if (item.pendingClaim) {
            const directionLabel = localeString('cashu.offlinePending.title');
            return {
                title: directionLabel,
                directionLabel,
                ...pending,
                layer: 'cashu',
                layerLabel: localeString('cashu.token')
            };
        }

        if (item.received) {
            return {
                title: localeString('cashu.token'),
                directionLabel: localeString('views.Activity.youReceived'),
                ...incoming,
                layer: 'cashu',
                layerLabel: localeString('cashu.token')
            };
        }

        if (item.spent) {
            return {
                title: localeString('cashu.token'),
                directionLabel: localeString('views.Activity.youSent'),
                ...outgoing,
                layer: 'cashu',
                layerLabel: localeString('cashu.token')
            };
        }

        return {
            title: localeString('general.unspent'),
            directionLabel: localeString('general.unspent'),
            ...neutral,
            layer: 'cashu',
            layerLabel: localeString('cashu.token')
        };
    }

    if (item instanceof CashuInvoice) {
        if (item.isPaid) {
            return {
                title: localeString('views.Cashu.CashuInvoice.title'),
                directionLabel: localeString('views.Activity.youReceived'),
                ...incoming,
                layer: 'cashu',
                layerLabel: localeString('general.cashu')
            };
        }

        const directionLabel = item.isExpired
            ? localeString('views.Activity.expiredRequested')
            : localeString('views.Activity.requestedPayment');
        return {
            title: directionLabel,
            directionLabel,
            ...(item.isExpired ? neutral : pending),
            layer: 'cashu',
            layerLabel: localeString('views.Cashu.CashuInvoice.title')
        };
    }

    if (item instanceof CashuPayment) {
        if (item.isFailed) {
            const directionLabel = localeString(
                'views.Cashu.CashuPayment.failedPayment'
            );
            return {
                title: directionLabel,
                directionLabel,
                ...failed,
                layer: 'cashu',
                layerLabel: localeString('general.cashu')
            };
        }

        if (item.isInTransit) {
            const directionLabel = localeString(
                'views.Cashu.CashuPayment.inTransitPayment'
            );
            return {
                title: directionLabel,
                directionLabel,
                ...pending,
                layer: 'cashu',
                layerLabel: localeString('general.cashu')
            };
        }

        return {
            title: localeString('views.Cashu.CashuPayment.title'),
            directionLabel: localeString('views.Activity.youSent'),
            ...outgoing,
            layer: 'cashu',
            layerLabel: localeString('general.cashu')
        };
    }

    if (item.model === localeString('views.Swaps.title')) {
        const directionLabel =
            item.type === SwapType.Submarine
                ? localeString('views.Swaps.submarine')
                : localeString('views.Swaps.reverse');
        return {
            title: directionLabel,
            directionLabel,
            directionIcon: 'sync-alt',
            directionColor: 'text',
            layer: 'swap',
            layerLabel: localeString('views.Swaps.title')
        };
    }

    if (item.model === 'LSPS1Order' || item.model === 'LSPS7Order') {
        const title =
            item.model === 'LSPS1Order'
                ? localeString('views.LSPS1.type')
                : localeString('views.LSPS7.type');
        return {
            title,
            directionLabel: title,
            directionIcon:
                item.state === LSPOrderState.FAILED
                    ? 'error-outline'
                    : item.state === LSPOrderState.COMPLETED
                    ? 'check-circle'
                    : 'schedule',
            directionColor:
                item.state === LSPOrderState.FAILED
                    ? 'warning'
                    : item.state === LSPOrderState.COMPLETED
                    ? 'success'
                    : 'highlight',
            layer: 'service',
            layerLabel: localeString('general.lsp')
        };
    }

    return {
        title: item.model,
        directionLabel: item.model,
        ...neutral
    };
}

export function getActivityAmountTheme(
    item: any
):
    | 'text'
    | 'highlight'
    | 'secondaryText'
    | 'success'
    | 'warning'
    | 'warningReserve' {
    if (
        (item instanceof Payment || item instanceof CashuPayment) &&
        item.isFailed
    ) {
        return 'secondaryText';
    }

    return 'text';
}
