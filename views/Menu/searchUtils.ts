import { Platform } from 'react-native';

import BackendUtils from '../../utils/BackendUtils';
import { localeString } from '../../utils/LocaleUtils';
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
    hasEmbeddedSeed: boolean;
    implementation?: string;
    cashuEnabled: boolean;
    isTestnet: boolean;
    supportsOffers: boolean;
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
    hasEmbeddedSeed,
    implementation,
    cashuEnabled,
    isTestnet,
    supportsOffers,
    isChannelMigrating,
    canExportChannels
}: BuildMenuSearchContextParams): MenuSearchContext => ({
    hasSelectedNode,
    hasEmbeddedSeed,
    implementation,
    supportsNodeInfo: BackendUtils.supportsNodeInfo(),
    supportsNetworkInfo: BackendUtils.supportsNetworkInfo(),
    supportsCashuWallet: BackendUtils.supportsCashuWallet(),
    cashuEnabled,
    supportsCustomPreimages: BackendUtils.supportsCustomPreimages(),
    isTestnet,
    supportsOffers,
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
    supportsSweep: BackendUtils.supportsSweep(),
    supportsOnchainSends: BackendUtils.supportsOnchainSends(),
    supportsWithdrawalRequests: BackendUtils.supportsWithdrawalRequests(),
    supportsDevTools: BackendUtils.supportsDevTools(),
    isChannelMigrating,
    canExportChannels
});

export const getMenuSearchItemLabelKey = (item: MenuSearchItemDefinition) =>
    Platform.OS === 'android' && item.androidLabelKey
        ? item.androidLabelKey
        : item.labelKey;

export const doesMenuSearchItemMatch = (
    item: MenuSearchItemDefinition,
    normalizedQuery: string
) => {
    if (!normalizedQuery) {
        return true;
    }

    const searchTerms = [
        item.labelKey,
        item.androidLabelKey,
        ...(item.aliasKeys || [])
    ]
        .filter((key): key is string => !!key)
        .map((key) => localeString(key).toLocaleLowerCase());

    return searchTerms.some((term) => term.includes(normalizedQuery));
};

export const getMatchingSettingsItems = (
    context: MenuSearchContext,
    normalizedQuery: string
) =>
    MENU_SEARCH_ITEMS.filter(
        (item) =>
            !item.excludeFromSearch &&
            item.isVisible(context) &&
            doesMenuSearchItemMatch(item, normalizedQuery)
    );

export const getVisibleSettingsSurfaceGroups = (
    context: MenuSearchContext,
    surface: SettingsSurface
) => {
    const groups = new Map<string, SettingsSurfaceGroup>();

    MENU_SEARCH_ITEMS.forEach((item) => {
        if (!item.isVisible(context)) {
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
            BackendUtils.supportsLSPS1rest();

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
        navigation.navigate(item.routeName, item.routeParams);
    }
};
