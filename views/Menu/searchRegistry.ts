export interface MenuSearchContext {
    hasSelectedNode: boolean;
    hasEmbeddedSeed: boolean;
    supportsNodeInfo: boolean;
    supportsNetworkInfo: boolean;
    supportsCashuWallet: boolean;
    cashuEnabled: boolean;
    supportsCustomPreimages: boolean;
    isTestnet: boolean;
    supportsOffers: boolean;
    supportsRouting: boolean;
    supportsAddressesWithDerivationPaths: boolean;
    supportsFlowLSP: boolean;
    supportsAccounts: boolean;
    supportsNostrWalletConnectService: boolean;
    supportsWatchtowerClient: boolean;
    isLNDBased: boolean;
    supportsMessageSigning: boolean;
    supportsChannelManagement: boolean;
    supportsSweep: boolean;
    supportsOnchainSends: boolean;
    supportsWithdrawalRequests: boolean;
    supportsDevTools: boolean;
}

export type MenuSearchAction =
    | 'openLspSettings'
    | 'openLightningAddress'
    | 'clearStorage';

export interface MenuSearchItemDefinition {
    id: string;
    labelKey: string;
    routeName?: string;
    routeParams?: Record<string, any>;
    aliasKeys?: string[];
    action?: MenuSearchAction;
    isVisible: (context: MenuSearchContext) => boolean;
}

export const MENU_SEARCH_ITEMS: MenuSearchItemDefinition[] = [
    {
        id: 'create-wallet',
        labelKey: 'views.Settings.createConnectWallet',
        routeName: 'WalletConfiguration',
        routeParams: { newEntry: true, index: 0 },
        aliasKeys: ['general.wallet', 'general.node'],
        isVisible: (context) => !context.hasSelectedNode
    },
    {
        id: 'wallets',
        labelKey: 'views.Settings.Wallets.title',
        routeName: 'Wallets',
        aliasKeys: ['general.wallets'],
        isVisible: (context) => context.hasSelectedNode
    },
    {
        id: 'settings',
        labelKey: 'views.Settings.title',
        routeName: 'Settings',
        aliasKeys: ['general.advancedSettings'],
        isVisible: () => true
    },
    {
        id: 'seed',
        labelKey: 'views.Settings.Seed.title',
        routeName: 'Seed',
        aliasKeys: [
            'views.Wallet.BalancePane.backup.title',
            'views.Wallet.BalancePane.recovery.title'
        ],
        isVisible: (context) => context.hasEmbeddedSeed
    },
    {
        id: 'embedded-node',
        labelKey: 'views.Settings.EmbeddedNode.title',
        routeName: 'EmbeddedNodeSettings',
        aliasKeys: ['general.node', 'general.bitcoin'],
        isVisible: (context) => context.hasEmbeddedSeed
    },
    {
        id: 'node-info',
        labelKey: 'views.NodeInfo.title',
        routeName: 'NodeInfo',
        aliasKeys: ['general.node'],
        isVisible: (context) =>
            context.hasSelectedNode && context.supportsNodeInfo
    },
    {
        id: 'network-info',
        labelKey: 'views.NetworkInfo.title',
        routeName: 'NetworkInfo',
        aliasKeys: ['general.network', 'general.peers'],
        isVisible: (context) =>
            context.hasSelectedNode &&
            context.supportsNodeInfo &&
            context.supportsNetworkInfo
    },
    {
        id: 'mints',
        labelKey: 'cashu.cashuMints',
        routeName: 'Mints',
        aliasKeys: ['general.cashu', 'general.ecash'],
        isVisible: (context) =>
            context.hasSelectedNode &&
            context.supportsCashuWallet &&
            context.cashuEnabled
    },
    {
        id: 'lightning-address',
        labelKey: 'general.lightningAddress',
        action: 'openLightningAddress',
        aliasKeys: ['general.lightningAddressCondensed'],
        isVisible: (context) =>
            context.hasSelectedNode &&
            context.supportsCustomPreimages &&
            !context.isTestnet
    },
    {
        id: 'swaps',
        labelKey: 'views.Swaps.title',
        routeName: 'Swaps',
        aliasKeys: ['general.swap'],
        isVisible: (context) => context.hasSelectedNode
    },
    {
        id: 'onchain-addresses',
        labelKey: 'views.OnChainAddresses.title',
        routeName: 'OnChainAddresses',
        aliasKeys: ['general.onchain', 'general.address'],
        isVisible: (context) => context.supportsAddressesWithDerivationPaths
    },
    {
        id: 'bolt12-address',
        labelKey: 'views.Settings.Bolt12Address',
        routeName: 'Bolt12Address',
        isVisible: (context) =>
            context.hasSelectedNode && context.supportsOffers
    },
    {
        id: 'paycodes',
        labelKey: 'general.paycodes',
        routeName: 'PayCodes',
        aliasKeys: ['general.paycode'],
        isVisible: (context) =>
            context.hasSelectedNode && context.supportsOffers
    },
    {
        id: 'routing',
        labelKey: 'general.routing',
        routeName: 'Routing',
        aliasKeys: ['views.Wallet.Wallet.channels'],
        isVisible: (context) =>
            context.hasSelectedNode && context.supportsRouting
    },
    {
        id: 'contacts',
        labelKey: 'views.Settings.Contacts.contacts',
        routeName: 'Contacts',
        aliasKeys: ['general.address'],
        isVisible: (context) => context.hasSelectedNode
    },
    {
        id: 'tools',
        labelKey: 'views.Tools.title',
        routeName: 'Tools',
        aliasKeys: ['general.advanced'],
        isVisible: () => true
    },
    {
        id: 'support',
        labelKey: 'views.Settings.Support.title',
        routeName: 'Support',
        aliasKeys: ['views.PaymentRequest.donate'],
        isVisible: () => true
    },
    {
        id: 'help',
        labelKey: 'general.help',
        routeName: 'Help',
        aliasKeys: ['general.about'],
        isVisible: () => true
    },
    {
        id: 'lsp',
        labelKey: 'general.lsp',
        action: 'openLspSettings',
        aliasKeys: ['general.serviceProvider'],
        isVisible: (context) =>
            context.hasSelectedNode && context.supportsFlowLSP
    },
    {
        id: 'ecash-settings',
        labelKey: 'general.ecash',
        routeName: 'EcashSettings',
        aliasKeys: ['general.cashu'],
        isVisible: (context) =>
            context.hasSelectedNode && context.supportsCashuWallet
    },
    {
        id: 'payments-settings',
        labelKey: 'views.Settings.payments',
        routeName: 'PaymentsSettings',
        aliasKeys: ['general.send'],
        isVisible: (context) => context.hasSelectedNode
    },
    {
        id: 'invoices-settings',
        labelKey: 'views.Wallet.Wallet.invoices',
        routeName: 'InvoicesSettings',
        aliasKeys: ['general.receive'],
        isVisible: (context) => context.hasSelectedNode
    },
    {
        id: 'channels-settings',
        labelKey: 'views.Wallet.Wallet.channels',
        routeName: 'ChannelsSettings',
        aliasKeys: ['general.routing'],
        isVisible: (context) =>
            context.hasSelectedNode && context.supportsChannelManagement
    },
    {
        id: 'privacy',
        labelKey: 'views.Settings.privacy',
        routeName: 'Privacy',
        aliasKeys: ['views.Settings.security'],
        isVisible: () => true
    },
    {
        id: 'security',
        labelKey: 'views.Settings.security',
        routeName: 'Security',
        aliasKeys: ['views.Settings.privacy'],
        isVisible: () => true
    },
    {
        id: 'currency',
        labelKey: 'views.Settings.Currency.title',
        routeName: 'Currency',
        aliasKeys: ['general.fiat', 'general.bitcoin'],
        isVisible: () => true
    },
    {
        id: 'language',
        labelKey: 'views.Settings.Language.title',
        routeName: 'Language',
        isVisible: () => true
    },
    {
        id: 'display',
        labelKey: 'views.Settings.Display.title',
        routeName: 'Display',
        isVisible: () => true
    },
    {
        id: 'pos-settings',
        labelKey: 'general.pos',
        routeName: 'PointOfSaleSettings',
        aliasKeys: ['general.admin'],
        isVisible: (context) => context.hasSelectedNode
    },
    {
        id: 'accounts',
        labelKey: 'views.Accounts.title',
        routeName: 'Accounts',
        aliasKeys: ['general.account'],
        isVisible: (context) => context.supportsAccounts
    },
    {
        id: 'nwc',
        labelKey: 'views.Settings.NostrWalletConnect.title',
        routeName: 'NostrWalletConnect',
        aliasKeys: ['nostr.nostr'],
        isVisible: (context) =>
            context.hasSelectedNode && context.supportsNostrWalletConnectService
    },
    {
        id: 'watchtowers',
        labelKey: 'views.Tools.watchtowers',
        routeName: 'Watchtowers',
        aliasKeys: ['views.Settings.security'],
        isVisible: (context) =>
            context.hasSelectedNode && context.supportsWatchtowerClient
    },
    {
        id: 'bump-fee',
        labelKey: 'views.BumpFee.title',
        routeName: 'BumpFee',
        isVisible: (context) => context.hasSelectedNode && context.isLNDBased
    },
    {
        id: 'sign-verify',
        labelKey: 'views.Settings.SignMessage.title',
        routeName: 'SignVerifyMessage',
        aliasKeys: ['general.signature'],
        isVisible: (context) =>
            context.hasSelectedNode && context.supportsMessageSigning
    },
    {
        id: 'converter',
        labelKey: 'views.Settings.CurrencyConverter.title',
        routeName: 'CurrencyConverter',
        aliasKeys: ['general.conversionRate'],
        isVisible: () => true
    },
    {
        id: 'rebalance',
        labelKey: 'views.Rebalance.title',
        routeName: 'Rebalance',
        aliasKeys: ['general.routing'],
        isVisible: (context) =>
            context.hasSelectedNode && context.supportsChannelManagement
    },
    {
        id: 'sweep',
        labelKey: 'views.Sweep.title',
        routeName: 'Sweep',
        aliasKeys: ['general.onchain'],
        isVisible: (context) => context.supportsSweep
    },
    {
        id: 'wif-sweeper',
        labelKey: 'views.Wif.title',
        routeName: 'WIFSweeper',
        aliasKeys: ['views.Settings.Seed.title'],
        isVisible: (context) =>
            context.hasSelectedNode && context.supportsOnchainSends
    },
    {
        id: 'activity-export',
        labelKey: 'views.ActivityExport.title',
        routeName: 'ActivityExport',
        isVisible: (context) => context.hasSelectedNode
    },
    {
        id: 'cashu-tools',
        labelKey: 'views.Tools.cashu',
        routeName: 'CashuTools',
        aliasKeys: ['general.cashu', 'general.ecash'],
        isVisible: (context) =>
            context.supportsCashuWallet && context.cashuEnabled
    },
    {
        id: 'config-export-import',
        labelKey: 'views.Tools.nodeConfigExportImport.title',
        routeName: 'NodeConfigExportImport',
        aliasKeys: [
            'views.Tools.nodeConfigExportImport.exportConfigs',
            'views.Tools.nodeConfigExportImport.importConfigs'
        ],
        isVisible: () => true
    },
    {
        id: 'withdrawal-request',
        labelKey: 'general.withdrawalRequest',
        routeName: 'CreateWithdrawalRequest',
        aliasKeys: ['general.request'],
        isVisible: (context) => context.supportsWithdrawalRequests
    },
    {
        id: 'developer-tools',
        labelKey: 'views.Tools.developers',
        routeName: 'DeveloperTools',
        aliasKeys: ['general.advanced'],
        isVisible: (context) => context.supportsDevTools
    },
    {
        id: 'clear-storage',
        labelKey: 'views.Tools.clearStorage.title',
        action: 'clearStorage',
        aliasKeys: ['general.warning'],
        isVisible: () => true
    }
];

export const MENU_SEARCH_ITEMS_BY_ID: Record<string, MenuSearchItemDefinition> =
    MENU_SEARCH_ITEMS.reduce((a, x) => {
        a[x.id] = x;
        return a;
    }, {} as Record<string, MenuSearchItemDefinition>);

export const getMenuSearchItem = (itemId: string) =>
    MENU_SEARCH_ITEMS_BY_ID[itemId];
