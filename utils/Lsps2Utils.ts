import type { ChannelDetails, PaymentDetails } from '../ldknode/LdkNode.d';
import { localeString } from './LocaleUtils';

// inboundCapacityMsat leaves out the commitment fee the LSP pays to add our
// HTLC, so a payment right at the limit can fail. Kept back per channel.
export const LSPS2_RECEIVE_MARGIN_MSAT = 2_000_000;

// What the node can receive without a new channel, assuming the payer can
// split it across channels. inboundHtlcMaximumMsat also covers LDK's 10%
// max-in-flight default on channels not opened by us or the LSPS2 LSP.
export const getReceivableMsat = (channels: ChannelDetails[]): number =>
    channels
        .filter((channel) => channel.isChannelReady)
        .reduce((total, channel) => {
            const inbound = Math.max(
                channel.inboundCapacityMsat - LSPS2_RECEIVE_MARGIN_MSAT,
                0
            );
            const max = channel.inboundHtlcMaximumMsat ?? inbound;
            return total + Math.min(inbound, max);
        }, 0);

// ldk-node stores the opening fee it accepted from the LSP as the JIT
// payment's fee limit when it creates the invoice
export const getJitQuoteMsat = (
    payments: PaymentDetails[],
    paymentHash: string
): number | undefined =>
    payments.find(
        (payment) =>
            payment.kind.type === 'bolt11Jit' &&
            payment.kind.hash === paymentHash
    )?.kind.lspFeeLimits?.maxTotalOpeningFeeMsat ?? undefined;

// ldk-node Display texts (src/error.rs); the native modules only pass these on
const NODE_ERROR_LIQUIDITY_SOURCE_UNAVAILABLE =
    'The given operation failed due to the required liquidity source being unavailable.';
const NODE_ERROR_LIQUIDITY_REQUEST_FAILED =
    'Failed to request inbound liquidity.';
const NODE_ERROR_LIQUIDITY_FEE_TOO_HIGH =
    "The given operation failed due to the LSP's required opening fee being too high.";
const NODE_ERROR_CONNECTION_FAILED = 'Network connection closed.';

export const getLsps2ErrorMessage = (message: string): string => {
    if (message.includes(NODE_ERROR_LIQUIDITY_SOURCE_UNAVAILABLE)) {
        return localeString('stores.InvoicesStore.lsps2.sourceUnavailable');
    }
    if (message.includes(NODE_ERROR_LIQUIDITY_REQUEST_FAILED)) {
        return localeString('stores.InvoicesStore.lsps2.requestFailed');
    }
    if (message.includes(NODE_ERROR_LIQUIDITY_FEE_TOO_HIGH)) {
        return localeString('stores.InvoicesStore.lsps2.feeTooHigh');
    }
    if (message.includes(NODE_ERROR_CONNECTION_FAILED)) {
        return localeString('stores.InvoicesStore.lsps2.lspUnreachable');
    }
    return message;
};
