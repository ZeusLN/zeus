import BackendUtils from '../../utils/BackendUtils';
import { localeString } from '../../utils/LocaleUtils';
import { MenuSearchContext, MenuSearchItemDefinition } from './searchRegistry';

interface BuildMenuSearchContextParams {
    hasSelectedNode: boolean;
    hasEmbeddedSeed: boolean;
    cashuEnabled: boolean;
    isTestnet: boolean;
    supportsOffers: boolean;
}

interface HandleMenuSearchItemPressParams {
    item: MenuSearchItemDefinition;
    navigation: any;
    skipLightningAddressStatus?: boolean;
    onClearStorage?: () => void;
}

export const buildMenuSearchContext = ({
    hasSelectedNode,
    hasEmbeddedSeed,
    cashuEnabled,
    isTestnet,
    supportsOffers
}: BuildMenuSearchContextParams): MenuSearchContext => ({
    hasSelectedNode,
    hasEmbeddedSeed,
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
    supportsDevTools: BackendUtils.supportsDevTools()
});

export const doesMenuSearchItemMatch = (
    item: MenuSearchItemDefinition,
    normalizedQuery: string
) => {
    if (!normalizedQuery) {
        return true;
    }

    const searchTerms = [item.labelKey, ...(item.aliasKeys || [])].map((key) =>
        localeString(key).toLocaleLowerCase()
    );

    return searchTerms.some((term) => term.includes(normalizedQuery));
};

export const handleMenuSearchItemPress = ({
    item,
    navigation,
    skipLightningAddressStatus,
    onClearStorage
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

    if (item.routeName) {
        navigation.navigate(item.routeName, item.routeParams);
    }
};
