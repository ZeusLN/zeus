import { Platform } from 'react-native';

import BackendUtils from '../../utils/BackendUtils';
import { localeString } from '../../utils/LocaleUtils';
import { reAuthNavigation } from '../../utils/NavigationUtils';
import {
    getSettingsItemPlacements,
    MENU_SEARCH_ITEMS,
    MenuSearchContext,
    MenuSearchItemDefinition,
    MenuSearchItemPlacement,
    SettingsSurface
} from './searchRegistry';

interface BuildMenuSearchContextParams {
    hasSelectedNode: boolean;
    hasLocalSeed: boolean;
    implementation?: string;
    cashuEnabled: boolean;
    isTestnet: boolean;
    supportsOffers: boolean;
    supportsListingOffers: boolean;
    isChannelMigrating: boolean;
    canExportChannels: boolean;
}

interface HandleMenuSearchItemPressParams {
    item: MenuSearchItemDefinition;
    navigation: any;
    skipLightningAddressStatus?: boolean;
    onClearStorage?: () => void;
    onExportChannels?: () => void;
}

export interface SettingsSurfaceGroup {
    groupId: string;
    items: Array<{
        item: MenuSearchItemDefinition;
        placement: MenuSearchItemPlacement;
    }>;
}

export const buildMenuSearchContext = ({
    hasSelectedNode,
    hasLocalSeed,
    implementation,
    cashuEnabled,
    isTestnet,
    supportsOffers,
    supportsListingOffers,
    isChannelMigrating,
    canExportChannels
}: BuildMenuSearchContextParams): MenuSearchContext => ({
    hasSelectedNode,
    hasLocalSeed,
    isLocalWallet: BackendUtils.isLocalWallet(),
    implementation,
    supportsNodeInfo: BackendUtils.supportsNodeInfo(),
    supportsNetworkInfo: BackendUtils.supportsNetworkInfo(),
    supportsCashuWallet: BackendUtils.supportsCashuWallet(),
    cashuEnabled,
    supportsLightningAddress: BackendUtils.supportsLightningAddress(),
    isTestnet,
    supportsOffers,
    supportsListingOffers,
    supportsBolt12Address: BackendUtils.supportsBolt12Address(),
    supportsRouting: BackendUtils.supportsRouting(),
    supportsAddressesWithDerivationPaths:
        BackendUtils.supportsAddressesWithDerivationPaths(),
    supportsFlowLSP: BackendUtils.supportsFlowLSP(),
    supportsAccounts: BackendUtils.supportsAccounts(),
    supportsNostrWalletConnectService:
        BackendUtils.supportsNostrWalletConnectService(),
    supportsWatchtowerClient: BackendUtils.supportsWatchtowerClient(),
    isLNDBased: BackendUtils.isLNDBased(),
    supportsMessageSigning: BackendUtils.supportsMessageSigning(),
    supportsChannelManagement: BackendUtils.supportsChannelManagement(),
    supportsCircularRebalancing: BackendUtils.supportsCircularRebalancing(),
    supportsSweep: BackendUtils.supportsSweep(),
    supportsOnchainSends: BackendUtils.supportsOnchainSends(),
    supportsWithdrawalRequests: BackendUtils.supportsWithdrawalRequests(),
    supportsDevTools: BackendUtils.supportsDevTools(),
    isChannelMigrating,
    canExportChannels
});

export const isRegistryItemVisible = (
    item: MenuSearchItemDefinition,
    context: MenuSearchContext
) => {
    if (!item.isVisible(context)) {
        return false;
    }

    if (context.isChannelMigrating && !item.survivesChannelMigration) {
        return false;
    }

    return true;
};

export const getMenuSearchItemLabelKey = (item: MenuSearchItemDefinition) =>
    Platform.OS === 'android' && item.androidLabelKey
        ? item.androidLabelKey
        : item.labelKey;

export const getMenuSearchItemLabel = (
    item: MenuSearchItemDefinition,
    context: MenuSearchContext
) =>
    item.labelKeys
        ? item
              .labelKeys(context)
              .map((key) => localeString(key))
              .join(' & ')
        : localeString(getMenuSearchItemLabelKey(item));

export const doesMenuSearchItemMatch = (
    item: MenuSearchItemDefinition,
    context: MenuSearchContext,
    normalizedQuery: string
) => {
    if (!normalizedQuery) {
        return true;
    }

    const searchTerms = [
        item.labelKey,
        item.androidLabelKey,
        ...(item.labelKeys?.(context) || []),
        ...(item.aliasKeys || [])
    ]
        .filter((key): key is string => !!key)
        .map((key) => localeString(key).toLocaleLowerCase());

    return searchTerms.some((term) => term.includes(normalizedQuery));
};

export const getMatchingSettingsItems = (
    context: MenuSearchContext,
    query: string
) => {
    const normalizedQuery = query.trim().toLocaleLowerCase();

    return MENU_SEARCH_ITEMS.filter(
        (item) =>
            !item.excludeFromSearch &&
            isRegistryItemVisible(item, context) &&
            doesMenuSearchItemMatch(item, context, normalizedQuery)
    );
};

export const getVisibleSettingsSurfaceGroups = (
    context: MenuSearchContext,
    surface: SettingsSurface
) => {
    const groups = new Map<string, SettingsSurfaceGroup>();

    MENU_SEARCH_ITEMS.forEach((item) => {
        if (!isRegistryItemVisible(item, context)) {
            return;
        }

        getSettingsItemPlacements(item, surface).forEach((placement) => {
            if (placement.isVisible && !placement.isVisible(context)) {
                return;
            }

            if (!groups.has(placement.group)) {
                groups.set(placement.group, {
                    groupId: placement.group,
                    items: []
                });
            }

            groups.get(placement.group)?.items.push({ item, placement });
        });
    });

    return Array.from(groups.values());
};

export const handleMenuSearchItemPress = ({
    item,
    navigation,
    skipLightningAddressStatus,
    onClearStorage,
    onExportChannels
}: HandleMenuSearchItemPressParams) => {
    if (item.action === 'openLspSettings') {
        const supportsLSPS1 =
            BackendUtils.supportsLSPScustomMessage() ||
            BackendUtils.supportsLSPS1rest() ||
            BackendUtils.supportsLSPS1native();

        if (BackendUtils.supportsFlowLSP() && supportsLSPS1) {
            navigation.navigate('LSPServicesList');
        } else {
            navigation.navigate('LSPSettings');
        }
        return;
    }

    if (item.action === 'openLightningAddress') {
        navigation.navigate('LightningAddress', {
            skipStatus: !!skipLightningAddressStatus
        });
        return;
    }

    if (item.action === 'clearStorage') {
        if (onClearStorage) {
            onClearStorage();
            return;
        }

        navigation.navigate('Tools', {
            showClearDataModal: true
        });
        return;
    }

    if (item.action === 'exportChannels') {
        onExportChannels?.();
        return;
    }

    if (item.routeName) {
        if (item.requiresReAuth) {
            reAuthNavigation(navigation, item.routeName, item.routeParams);
            return;
        }

        navigation.navigate(item.routeName, item.routeParams);
    }
};
