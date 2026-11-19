import BackendUtils from './BackendUtils';
import type { Filter } from '../stores/ActivityStore';

export interface SupportedActivityFilters {
    onChain: boolean;
    cashu: boolean;
    swaps: boolean;
    lsps1: boolean;
    lsps7: boolean;
    unconfirmed: boolean;
    standardInvoices: boolean;
    ampInvoices: boolean;
    zeusPay: boolean;
    keysend: boolean;
    circularRebalance: boolean;
}

/**
 * Which activity filters apply to the connected node. A filter that does
 * not apply is hidden on the filter screen.
 *
 * The In transit and Failed filters are not listed: their toggles are
 * gated on the filter screen, as before.
 */
export const getSupportedActivityFilters = ({
    testnet,
    lightningAddressEnabled,
    cashuEnabled
}: {
    testnet: boolean;
    lightningAddressEnabled: boolean;
    cashuEnabled: boolean;
}): SupportedActivityFilters => {
    const lndBased = !!BackendUtils.isLNDBased();
    return {
        // Transactions only reach Activity when the node can send on-chain
        // (ActivityStore.getSortedActivity)
        onChain: !!BackendUtils.supportsOnchainSends(),
        // Cashu activity is only added when ecash is on in the settings
        cashu: cashuEnabled && !!BackendUtils.supportsCashuWallet(),
        // Swaps are not offered on testnet, as in the menu
        swaps: !testnet,
        lsps1:
            !!BackendUtils.supportsLSPS1native() ||
            !!BackendUtils.supportsLSPScustomMessage() ||
            !!BackendUtils.supportsLSPS1rest(),
        // LSPS7 runs natively or over custom messages, as in LSPStore
        lsps7:
            !!BackendUtils.supportsLSPS7native() ||
            !!BackendUtils.supportsLSPScustomMessage(),
        unconfirmed: !!BackendUtils.supportsOnchainSends(),
        // Standard invoices exist with or without AMP
        standardInvoices: lndBased,
        ampInvoices: lndBased && !!BackendUtils.supportsAMP(),
        // The menu hides Lightning address on testnet, and the setting is
        // global, so it can still be on after switching to a testnet wallet
        zeusPay:
            !testnet &&
            lightningAddressEnabled &&
            !!BackendUtils.supportsLightningAddress(),
        keysend: !!BackendUtils.supportsKeysend(),
        circularRebalance: !!BackendUtils.supportsCircularRebalancing()
    };
};

/**
 * Returns a copy of `filters` where every toggle the node does not support
 * is reset to its default, so a toggle the user cannot see never filters
 * activity. Every toggle listed in SupportedActivityFilters is on by
 * default, so the reset can only show more activity.
 */
export const neutralizeUnsupportedFilters = (
    filters: Filter,
    defaults: Filter,
    supported: SupportedActivityFilters
): Filter => {
    const result: Filter = { ...filters };
    (Object.keys(supported) as (keyof SupportedActivityFilters)[]).forEach(
        (key) => {
            if (!supported[key]) result[key] = defaults[key];
        }
    );
    if (!supported.swaps) {
        result.swapFilter = defaults.swapFilter;
        result.submarine = defaults.submarine;
        result.reverse = defaults.reverse;
    }
    if (!supported.lsps1) result.lsps1State = defaults.lsps1State;
    if (!supported.lsps7) result.lsps7State = defaults.lsps7State;
    return result;
};
