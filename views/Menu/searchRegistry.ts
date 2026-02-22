export interface MenuSearchContext {
    hasSelectedNode: boolean;
    hasEmbeddedSeed: boolean;
    implementation?: string;
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

export type SettingsSurface = 'menu' | 'settings' | 'tools';

export type SettingsTextTone = 'default' | 'highlight' | 'warning';

export type SettingsIconKey =
    | 'add'
    | 'wallets'
    | 'settings'
    | 'seed'
    | 'embedded-node'
    | 'node-info'
    | 'network-info'
    | 'mints'
    | 'lightning-address'
    | 'swaps'
    | 'onchain-addresses'
    | 'bolt12-address'
    | 'paycodes'
    | 'routing'
    | 'contacts'
    | 'tools'
    | 'support'
    | 'help'
    | 'lsp'
    | 'ecash'
    | 'payments'
    | 'invoices'
    | 'channels'
    | 'privacy'
    | 'security'
    | 'currency'
    | 'language'
    | 'display'
    | 'pos'
    | 'accounts'
    | 'nwc'
    | 'watchtowers'
    | 'bump-fee'
    | 'sign-verify'
    | 'converter'
    | 'rebalance'
    | 'sweep'
    | 'wif-sweeper'
    | 'activity-export'
    | 'config-export-import'
    | 'withdrawal-request'
    | 'developer-tools'
    | 'clear-storage';

export interface MenuSearchItemPlacement {
    surface: SettingsSurface;
    group: string;
    tone?: SettingsTextTone;
    isVisible?: (context: MenuSearchContext) => boolean;
}

export interface MenuSearchItemDefinition {
    id: string;
    labelKey: string;
    iconKey: SettingsIconKey;
    routeName?: string;
    routeParams?: Record<string, any>;
    aliasKeys?: string[];
    action?: MenuSearchAction;
    excludeFromSearch?: boolean;
    placements?: MenuSearchItemPlacement[];
    isVisible: (context: MenuSearchContext) => boolean;
}

export const MENU_SEARCH_ITEMS: MenuSearchItemDefinition[] = [
    {
        id: 'create-wallet',
        labelKey: 'views.Settings.createConnectWallet',
        iconKey: 'add',
        routeName: 'WalletConfiguration',
        routeParams: { newEntry: true, index: 0 },
        aliasKeys: ['general.wallet', 'general.node'],
        placements: [
            {
                surface: 'menu',
                group: 'create-wallet',
                tone: 'highlight'
            }
        ],
        isVisible: (context) => !context.hasSelectedNode
    },
    {
        id: 'wallets',
        labelKey: 'views.Settings.Wallets.title',
        iconKey: 'wallets',
        routeName: 'Wallets',
        aliasKeys: ['general.wallets'],
        isVisible: (context) => context.hasSelectedNode
    },
    {
        id: 'settings',
        labelKey: 'views.Settings.title',
        iconKey: 'settings',
        routeName: 'Settings',
        aliasKeys: ['general.advancedSettings'],
        placements: [{ surface: 'menu', group: 'settings' }],
        isVisible: () => true
    },
    {
        id: 'seed',
        labelKey: 'views.Settings.Seed.title',
        iconKey: 'seed',
        routeName: 'Seed',
        aliasKeys: [
            'views.Wallet.BalancePane.backup.title',
            'views.Wallet.BalancePane.recovery.title'
        ],
        placements: [{ surface: 'menu', group: 'seed' }],
        isVisible: (context) => context.hasEmbeddedSeed
    },
    {
        id: 'embedded-node',
        labelKey: 'views.Settings.EmbeddedNode.title',
        iconKey: 'embedded-node',
        routeName: 'EmbeddedNodeSettings',
        aliasKeys: ['general.node', 'general.bitcoin'],
        placements: [{ surface: 'menu', group: 'seed' }],
        isVisible: (context) => context.hasEmbeddedSeed
    },
    {
        id: 'node-info',
        labelKey: 'views.NodeInfo.title',
        iconKey: 'node-info',
        routeName: 'NodeInfo',
        aliasKeys: ['general.node'],
        placements: [{ surface: 'menu', group: 'node-info' }],
        isVisible: (context) =>
            context.hasSelectedNode && context.supportsNodeInfo
    },
    {
        id: 'network-info',
        labelKey: 'views.NetworkInfo.title',
        iconKey: 'network-info',
        routeName: 'NetworkInfo',
        aliasKeys: ['general.network', 'general.peers'],
        placements: [{ surface: 'menu', group: 'node-info' }],
        isVisible: (context) =>
            context.hasSelectedNode &&
            context.supportsNodeInfo &&
            context.supportsNetworkInfo
    },
    {
        id: 'mints',
        labelKey: 'cashu.cashuMints',
        iconKey: 'mints',
        routeName: 'Mints',
        aliasKeys: ['general.cashu', 'general.ecash'],
        placements: [{ surface: 'menu', group: 'mints' }],
        isVisible: (context) =>
            context.hasSelectedNode &&
            context.supportsCashuWallet &&
            context.cashuEnabled
    },
    {
        id: 'lightning-address',
        labelKey: 'general.lightningAddress',
        iconKey: 'lightning-address',
        action: 'openLightningAddress',
        aliasKeys: ['general.lightningAddressCondensed'],
        placements: [{ surface: 'menu', group: 'lightning-address' }],
        isVisible: (context) =>
            context.hasSelectedNode &&
            context.supportsCustomPreimages &&
            !context.isTestnet
    },
    {
        id: 'swaps',
        labelKey: 'views.Swaps.title',
        iconKey: 'swaps',
        routeName: 'Swaps',
        aliasKeys: ['general.swap'],
        placements: [{ surface: 'menu', group: 'swaps' }],
        isVisible: (context) => context.hasSelectedNode
    },
    {
        id: 'onchain-addresses',
        labelKey: 'views.OnChainAddresses.title',
        iconKey: 'onchain-addresses',
        routeName: 'OnChainAddresses',
        aliasKeys: ['general.onchain', 'general.address'],
        placements: [{ surface: 'menu', group: 'onchain-addresses' }],
        isVisible: (context) => context.supportsAddressesWithDerivationPaths
    },
    {
        id: 'bolt12-address',
        labelKey: 'views.Settings.Bolt12Address',
        iconKey: 'bolt12-address',
        routeName: 'Bolt12Address',
        placements: [{ surface: 'menu', group: 'bolt12-address' }],
        isVisible: (context) =>
            context.hasSelectedNode && context.supportsOffers
    },
    {
        id: 'paycodes',
        labelKey: 'general.paycodes',
        iconKey: 'paycodes',
        routeName: 'PayCodes',
        aliasKeys: ['general.paycode'],
        placements: [{ surface: 'menu', group: 'paycodes' }],
        isVisible: (context) =>
            context.hasSelectedNode && context.supportsOffers
    },
    {
        id: 'routing',
        labelKey: 'general.routing',
        iconKey: 'routing',
        routeName: 'Routing',
        aliasKeys: ['views.Wallet.Wallet.channels'],
        placements: [{ surface: 'menu', group: 'routing' }],
        isVisible: (context) =>
            context.hasSelectedNode && context.supportsRouting
    },
    {
        id: 'contacts',
        labelKey: 'views.Settings.Contacts.contacts',
        iconKey: 'contacts',
        routeName: 'Contacts',
        aliasKeys: ['general.address'],
        placements: [{ surface: 'menu', group: 'contacts' }],
        isVisible: (context) => context.hasSelectedNode
    },
    {
        id: 'tools',
        labelKey: 'views.Tools.title',
        iconKey: 'tools',
        routeName: 'Tools',
        aliasKeys: ['general.advanced'],
        placements: [{ surface: 'menu', group: 'tools' }],
        isVisible: () => true
    },
    {
        id: 'support',
        labelKey: 'views.Settings.Support.title',
        iconKey: 'support',
        routeName: 'Support',
        aliasKeys: ['views.PaymentRequest.donate'],
        placements: [{ surface: 'menu', group: 'support' }],
        isVisible: () => true
    },
    {
        id: 'help',
        labelKey: 'general.help',
        iconKey: 'help',
        routeName: 'Help',
        aliasKeys: ['general.about'],
        placements: [{ surface: 'menu', group: 'help' }],
        isVisible: () => true
    },
    {
        id: 'lsp',
        labelKey: 'general.lsp',
        iconKey: 'lsp',
        action: 'openLspSettings',
        aliasKeys: ['general.serviceProvider'],
        placements: [{ surface: 'settings', group: 'lsp' }],
        isVisible: (context) =>
            context.hasSelectedNode && context.supportsFlowLSP
    },
    {
        id: 'ecash-settings',
        labelKey: 'general.ecash',
        iconKey: 'ecash',
        routeName: 'EcashSettings',
        aliasKeys: ['general.cashu'],
        placements: [{ surface: 'settings', group: 'ecash' }],
        isVisible: (context) =>
            context.hasSelectedNode && context.supportsCashuWallet
    },
    {
        id: 'payments-settings',
        labelKey: 'views.Settings.payments',
        iconKey: 'payments',
        routeName: 'PaymentsSettings',
        aliasKeys: ['general.send'],
        placements: [{ surface: 'settings', group: 'payments' }],
        isVisible: (context) => context.hasSelectedNode
    },
    {
        id: 'invoices-settings',
        labelKey: 'views.Wallet.Wallet.invoices',
        iconKey: 'invoices',
        routeName: 'InvoicesSettings',
        aliasKeys: ['general.receive'],
        placements: [
            { surface: 'settings', group: 'payments' },
            {
                surface: 'settings',
                group: 'legacy-invoices',
                isVisible: (context) =>
                    context.hasSelectedNode &&
                    !context.isLNDBased &&
                    context.implementation !== 'lndhub'
            }
        ],
        isVisible: (context) => context.hasSelectedNode
    },
    {
        id: 'channels-settings',
        labelKey: 'views.Wallet.Wallet.channels',
        iconKey: 'channels',
        routeName: 'ChannelsSettings',
        aliasKeys: ['general.routing'],
        placements: [{ surface: 'settings', group: 'channels' }],
        isVisible: (context) =>
            context.hasSelectedNode && context.supportsChannelManagement
    },
    {
        id: 'privacy',
        labelKey: 'views.Settings.privacy',
        iconKey: 'privacy',
        routeName: 'Privacy',
        aliasKeys: ['views.Settings.security'],
        placements: [{ surface: 'settings', group: 'privacy-security' }],
        isVisible: () => true
    },
    {
        id: 'security',
        labelKey: 'views.Settings.security',
        iconKey: 'security',
        routeName: 'Security',
        aliasKeys: ['views.Settings.privacy'],
        placements: [{ surface: 'settings', group: 'privacy-security' }],
        isVisible: () => true
    },
    {
        id: 'currency',
        labelKey: 'views.Settings.Currency.title',
        iconKey: 'currency',
        routeName: 'Currency',
        aliasKeys: ['general.fiat', 'general.bitcoin'],
        placements: [{ surface: 'settings', group: 'currency-language' }],
        isVisible: () => true
    },
    {
        id: 'language',
        labelKey: 'views.Settings.Language.title',
        iconKey: 'language',
        routeName: 'Language',
        placements: [{ surface: 'settings', group: 'currency-language' }],
        isVisible: () => true
    },
    {
        id: 'display',
        labelKey: 'views.Settings.Display.title',
        iconKey: 'display',
        routeName: 'Display',
        placements: [{ surface: 'settings', group: 'display' }],
        isVisible: () => true
    },
    {
        id: 'pos-settings',
        labelKey: 'general.pos',
        iconKey: 'pos',
        routeName: 'PointOfSaleSettings',
        aliasKeys: ['general.admin'],
        placements: [{ surface: 'settings', group: 'pos' }],
        isVisible: (context) => context.hasSelectedNode
    },
    {
        id: 'accounts',
        labelKey: 'views.Accounts.title',
        iconKey: 'accounts',
        routeName: 'Accounts',
        aliasKeys: ['general.account'],
        placements: [{ surface: 'tools', group: 'accounts' }],
        isVisible: (context) => context.supportsAccounts
    },
    {
        id: 'nwc',
        labelKey: 'views.Settings.NostrWalletConnect.title',
        iconKey: 'nwc',
        routeName: 'NostrWalletConnect',
        aliasKeys: ['nostr.nostr'],
        placements: [{ surface: 'tools', group: 'nwc' }],
        isVisible: (context) =>
            context.hasSelectedNode && context.supportsNostrWalletConnectService
    },
    {
        id: 'watchtowers',
        labelKey: 'views.Tools.watchtowers',
        iconKey: 'watchtowers',
        routeName: 'Watchtowers',
        aliasKeys: ['views.Settings.security'],
        placements: [{ surface: 'tools', group: 'watchtowers' }],
        isVisible: (context) =>
            context.hasSelectedNode && context.supportsWatchtowerClient
    },
    {
        id: 'bump-fee',
        labelKey: 'views.BumpFee.title',
        iconKey: 'bump-fee',
        routeName: 'BumpFee',
        placements: [{ surface: 'tools', group: 'bump-fee' }],
        isVisible: (context) => context.hasSelectedNode && context.isLNDBased
    },
    {
        id: 'sign-verify',
        labelKey: 'views.Settings.SignMessage.title',
        iconKey: 'sign-verify',
        routeName: 'SignVerifyMessage',
        aliasKeys: ['general.signature'],
        placements: [{ surface: 'tools', group: 'sign-verify' }],
        isVisible: (context) =>
            context.hasSelectedNode && context.supportsMessageSigning
    },
    {
        id: 'converter',
        labelKey: 'views.Settings.CurrencyConverter.title',
        iconKey: 'converter',
        routeName: 'CurrencyConverter',
        aliasKeys: ['general.conversionRate'],
        placements: [{ surface: 'tools', group: 'converter' }],
        isVisible: () => true
    },
    {
        id: 'rebalance',
        labelKey: 'views.Rebalance.title',
        iconKey: 'rebalance',
        routeName: 'Rebalance',
        aliasKeys: ['general.routing'],
        placements: [{ surface: 'tools', group: 'rebalance' }],
        isVisible: (context) =>
            context.hasSelectedNode && context.supportsChannelManagement
    },
    {
        id: 'sweep',
        labelKey: 'views.Sweep.title',
        iconKey: 'sweep',
        routeName: 'Sweep',
        aliasKeys: ['general.onchain'],
        placements: [{ surface: 'tools', group: 'sweep' }],
        isVisible: (context) => context.supportsSweep
    },
    {
        id: 'wif-sweeper',
        labelKey: 'views.Wif.title',
        iconKey: 'wif-sweeper',
        routeName: 'WIFSweeper',
        aliasKeys: ['views.Settings.Seed.title'],
        placements: [{ surface: 'tools', group: 'wif-sweeper' }],
        isVisible: (context) =>
            context.hasSelectedNode && context.supportsOnchainSends
    },
    {
        id: 'activity-export',
        labelKey: 'views.ActivityExport.title',
        iconKey: 'activity-export',
        routeName: 'ActivityExport',
        placements: [{ surface: 'tools', group: 'activity-export' }],
        isVisible: (context) => context.hasSelectedNode
    },
    {
        id: 'cashu-tools',
        labelKey: 'views.Tools.cashu',
        iconKey: 'ecash',
        routeName: 'CashuTools',
        aliasKeys: ['general.cashu', 'general.ecash'],
        placements: [{ surface: 'tools', group: 'cashu-tools' }],
        isVisible: (context) =>
            context.supportsCashuWallet && context.cashuEnabled
    },
    {
        id: 'config-export-import',
        labelKey: 'views.Tools.nodeConfigExportImport.title',
        iconKey: 'config-export-import',
        routeName: 'NodeConfigExportImport',
        aliasKeys: [
            'views.Tools.nodeConfigExportImport.exportConfigs',
            'views.Tools.nodeConfigExportImport.importConfigs'
        ],
        placements: [{ surface: 'tools', group: 'config-export-import' }],
        isVisible: () => true
    },
    {
        id: 'withdrawal-request',
        labelKey: 'general.withdrawalRequest',
        iconKey: 'withdrawal-request',
        routeName: 'CreateWithdrawalRequest',
        aliasKeys: ['general.request'],
        placements: [{ surface: 'tools', group: 'withdrawal-request' }],
        isVisible: (context) => context.supportsWithdrawalRequests
    },
    {
        id: 'developer-tools',
        labelKey: 'views.Tools.developers',
        iconKey: 'developer-tools',
        routeName: 'DeveloperTools',
        aliasKeys: ['general.advanced'],
        placements: [{ surface: 'tools', group: 'developer-tools' }],
        isVisible: (context) => context.supportsDevTools
    },
    {
        id: 'clear-storage',
        labelKey: 'views.Tools.clearStorage.title',
        iconKey: 'clear-storage',
        action: 'clearStorage',
        aliasKeys: ['general.warning'],
        excludeFromSearch: true,
        placements: [
            {
                surface: 'tools',
                group: 'clear-storage',
                tone: 'warning'
            }
        ],
        isVisible: () => true
    }
];

export const getSettingsItemPlacements = (
    item: MenuSearchItemDefinition,
    surface: SettingsSurface
) =>
    (item.placements || []).filter(
        (placement) => placement.surface === surface
    );
