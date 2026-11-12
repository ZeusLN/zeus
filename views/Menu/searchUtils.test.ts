jest.mock('../../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));

jest.mock('../../stores/Stores', () => ({
    settingsStore: (() => {
        const store = {
            settings: {} as Record<string, unknown>,
            loginMethodConfigured: jest.fn()
        };
        store.loginMethodConfigured.mockImplementation(
            () => !!(store.settings.pin || store.settings.passphrase)
        );
        return store;
    })()
}));

const backendFlags: Record<string, boolean> = {
    isLocalWallet: false,
    supportsLightningAddress: false,
    supportsBolt12Address: false,
    supportsCircularRebalancing: false,
    supportsLSPS1native: false,
    supportsLSPScustomMessage: false,
    supportsLSPS1rest: false,
    supportsFlowLSP: false
};

jest.mock('../../utils/BackendUtils', () => ({
    __esModule: true,
    default: new Proxy(
        {},
        {
            get: (_target, prop: string) => () => backendFlags[prop] ?? false
        }
    )
}));

import { settingsStore } from '../../stores/Stores';
import { MENU_SEARCH_ITEMS } from './searchRegistry';
import {
    buildMenuSearchContext,
    getMatchingSettingsItems,
    getMenuSearchItemLabel,
    getVisibleSettingsSurfaceGroups,
    handleMenuSearchItemPress,
    isRegistryItemVisible
} from './searchUtils';

const itemById = (id: string) => {
    const item = MENU_SEARCH_ITEMS.find((entry) => entry.id === id);
    if (!item) throw new Error(`Missing ${id}`);
    return item;
};

const baseContext = (overrides: Record<string, unknown> = {}) =>
    ({
        hasSelectedNode: true,
        hasLocalSeed: false,
        isLocalWallet: false,
        implementation: 'lnd',
        supportsNodeInfo: true,
        supportsNetworkInfo: false,
        supportsCashuWallet: false,
        cashuEnabled: false,
        supportsLightningAddress: false,
        isTestnet: false,
        supportsOffers: false,
        supportsListingOffers: false,
        supportsBolt12Address: false,
        supportsRouting: false,
        supportsAddressesWithDerivationPaths: false,
        supportsFlowLSP: false,
        supportsAccounts: false,
        supportsNostrWalletConnectService: false,
        supportsWatchtowerClient: false,
        isLNDBased: true,
        supportsMessageSigning: false,
        supportsChannelManagement: true,
        supportsCircularRebalancing: false,
        supportsSweep: false,
        supportsOnchainSends: false,
        supportsWithdrawalRequests: false,
        supportsDevTools: false,
        isChannelMigrating: false,
        canExportChannels: false,
        ...overrides
    } as any);

const visibleMenuIds = (context: ReturnType<typeof baseContext>) =>
    getVisibleSettingsSurfaceGroups(context, 'menu').flatMap((g) =>
        g.items.map(({ item }) => item.id)
    );

const visibleIdsOnSurface = (
    surface: 'menu' | 'settings' | 'tools',
    context: ReturnType<typeof baseContext>
) =>
    getVisibleSettingsSurfaceGroups(context, surface).flatMap((group) =>
        group.items.map(({ item }) => item.id)
    );

const allVisibleIds = (context: ReturnType<typeof baseContext>) =>
    new Set(
        (['menu', 'settings', 'tools'] as const).flatMap((surface) =>
            visibleIdsOnSurface(surface, context)
        )
    );

const backendCases = [
    {
        name: 'embedded-lnd',
        context: {
            implementation: 'embedded-lnd',
            hasLocalSeed: true,
            isLocalWallet: true,
            supportsLightningAddress: true,
            isLNDBased: true,
            supportsChannelManagement: true,
            supportsCircularRebalancing: true
        },
        visible: [
            'seed',
            'embedded-node',
            'lightning-address',
            'rebalance',
            'channels-settings'
        ],
        hidden: ['bolt12-address', 'paycodes', 'create-paycode']
    },
    {
        name: 'ldk-node',
        context: {
            implementation: 'ldk-node',
            hasLocalSeed: true,
            isLocalWallet: true,
            supportsLightningAddress: true,
            supportsOffers: true,
            supportsListingOffers: false,
            isLNDBased: false,
            supportsChannelManagement: true
        },
        visible: [
            'seed',
            'embedded-node',
            'lightning-address',
            'create-paycode',
            'channels-settings'
        ],
        hidden: ['bolt12-address', 'paycodes', 'rebalance']
    },
    {
        name: 'lnd',
        context: {
            implementation: 'lnd',
            supportsLightningAddress: true,
            isLNDBased: true,
            supportsChannelManagement: true,
            supportsCircularRebalancing: true
        },
        visible: ['lightning-address', 'rebalance', 'channels-settings'],
        hidden: [
            'seed',
            'embedded-node',
            'bolt12-address',
            'paycodes',
            'create-paycode'
        ]
    },
    {
        name: 'cln-rest',
        context: {
            implementation: 'cln-rest',
            supportsOffers: true,
            supportsListingOffers: true,
            supportsBolt12Address: true,
            isLNDBased: false,
            supportsChannelManagement: true,
            supportsCircularRebalancing: true
        },
        visible: [
            'bolt12-address',
            'paycodes',
            'rebalance',
            'channels-settings'
        ],
        hidden: ['seed', 'embedded-node', 'lightning-address', 'create-paycode']
    },
    {
        name: 'lndhub',
        context: {
            implementation: 'lndhub',
            isLNDBased: false,
            supportsChannelManagement: false
        },
        visible: [],
        hidden: [
            'seed',
            'embedded-node',
            'lightning-address',
            'bolt12-address',
            'paycodes',
            'create-paycode',
            'rebalance',
            'channels-settings'
        ]
    },
    {
        name: 'nostr-wallet-connect',
        context: {
            implementation: 'nostr-wallet-connect',
            isLNDBased: false,
            supportsChannelManagement: false
        },
        visible: ['channels-settings'],
        hidden: [
            'seed',
            'embedded-node',
            'lightning-address',
            'bolt12-address',
            'paycodes',
            'create-paycode',
            'rebalance'
        ]
    }
] as const;

const duplicateIdsOnSurface = (
    surface: 'menu' | 'settings' | 'tools',
    context: ReturnType<typeof baseContext>
) => {
    const ids = getVisibleSettingsSurfaceGroups(context, surface).flatMap((g) =>
        g.items.map(({ item }) => item.id)
    );
    return ids.filter((id, index) => ids.indexOf(id) !== index);
};

beforeEach(() => {
    jest.clearAllMocks();
    (settingsStore as any).settings = {};
    Object.keys(backendFlags).forEach((key) => {
        backendFlags[key] = false;
    });
});

describe('isRegistryItemVisible', () => {
    it('hides every non-surviving row during channel migration', () => {
        const ctx = baseContext({ isChannelMigrating: true });

        MENU_SEARCH_ITEMS.filter(
            (item) => !item.survivesChannelMigration
        ).forEach((item) => {
            expect(
                isRegistryItemVisible({ ...item, isVisible: () => true }, ctx)
            ).toBe(false);
        });
    });

    it('preserves only the rows available during migration on master', () => {
        expect(
            MENU_SEARCH_ITEMS.filter(
                (item) => item.survivesChannelMigration
            ).map((item) => item.id)
        ).toEqual([
            'create-wallet',
            'wallets',
            'settings',
            'tools',
            'support',
            'help',
            'networking',
            'privacy',
            'security',
            'currency',
            'language',
            'display',
            'converter',
            'nostr-keys',
            'config-export-import',
            'keychain-cleanup',
            'clear-storage'
        ]);
    });
});

describe('menu visibility matrix', () => {
    it.each(backendCases)(
        'shows the expected gated rows for $name',
        ({ context, visible, hidden }) => {
            const ids = allVisibleIds(baseContext(context));

            visible.forEach((id) => expect(ids).toContain(id));
            hidden.forEach((id) => expect(ids).not.toContain(id));
        }
    );

    it('shows Embedded Node settings for a local wallet without a loaded seed', () => {
        const ctx = baseContext({
            implementation: 'ldk-node',
            hasLocalSeed: false,
            isLocalWallet: true
        });

        expect(visibleMenuIds(ctx)).not.toContain('embedded-node');
        expect(visibleIdsOnSurface('settings', ctx)).toContain('embedded-node');
    });
});

describe('current master parity', () => {
    it('keeps Wallets in search without rendering a second menu row', () => {
        const ctx = baseContext();

        expect(visibleMenuIds(ctx)).not.toContain('wallets');
        expect(
            getMatchingSettingsItems(ctx, 'wallets').map((item) => item.id)
        ).toContain('wallets');
    });

    it('uses one combined Node and Network row that opens NodeInfo', () => {
        const ctx = baseContext({ supportsNetworkInfo: true });
        const ids = visibleMenuIds(ctx);
        const nodeInfo = itemById('node-info');

        expect(ids.filter((id) => id === 'node-info')).toHaveLength(1);
        expect(ids).not.toContain('network-info');
        expect(
            MENU_SEARCH_ITEMS.some((item) => item.id === 'network-info')
        ).toBe(false);
        expect(nodeInfo.routeName).toBe('NodeInfo');
        expect(getMenuSearchItemLabel(nodeInfo, ctx)).toBe(
            'general.node & views.NetworkInfo.title'
        );
    });

    it('shows PayCodes when listing is supported without an extra offers gate', () => {
        const ctx = baseContext({
            supportsOffers: false,
            supportsListingOffers: true
        });

        expect(visibleMenuIds(ctx)).toContain('paycodes');
        expect(visibleMenuIds(ctx)).not.toContain('create-paycode');
    });

    it('shows Withdrawal Request without requiring a selected node', () => {
        const ctx = baseContext({
            hasSelectedNode: false,
            supportsWithdrawalRequests: true
        });

        expect(visibleIdsOnSurface('tools', ctx)).toContain(
            'withdrawal-request'
        );
    });
});

describe('getMatchingSettingsItems', () => {
    it('matches aliases case-insensitively', () => {
        const ctx = baseContext({ hasLocalSeed: true });
        const matches = getMatchingSettingsItems(ctx, 'BACKUP');
        expect(matches.map((item) => item.id)).toContain('seed');
    });

    it('returns every visible item for a whitespace-only query', () => {
        const ctx = baseContext();
        const allVisible = MENU_SEARCH_ITEMS.filter(
            (item) =>
                !item.excludeFromSearch && isRegistryItemVisible(item, ctx)
        );
        expect(getMatchingSettingsItems(ctx, '   ')).toHaveLength(
            allVisible.length
        );
    });

    it('keeps clear storage out of search results', () => {
        const ctx = baseContext();
        const matches = getMatchingSettingsItems(ctx, 'warning');
        expect(matches.map((item) => item.id)).not.toContain('clear-storage');
    });
});

describe('handleMenuSearchItemPress', () => {
    it.each([
        ['PIN', { pin: '123456' }],
        ['passphrase', { passphrase: 'correct horse battery staple' }]
    ])('routes Seed through Lockscreen when a %s is set', (_name, settings) => {
        (settingsStore as any).settings = settings;
        const navigation = { navigate: jest.fn() };

        handleMenuSearchItemPress({
            item: itemById('seed'),
            navigation
        });

        expect(navigation.navigate).toHaveBeenCalledTimes(1);
        expect(navigation.navigate).toHaveBeenCalledWith('Lockscreen', {
            pendingNavigation: { screen: 'Seed', params: undefined }
        });
    });

    it('opens LSPServicesList when only native LSPS1 is available', () => {
        backendFlags.supportsFlowLSP = true;
        backendFlags.supportsLSPS1native = true;
        const navigation = { navigate: jest.fn() };

        handleMenuSearchItemPress({
            item: itemById('lsp'),
            navigation
        });

        expect(navigation.navigate).toHaveBeenCalledTimes(1);
        expect(navigation.navigate).toHaveBeenCalledWith('LSPServicesList');
        expect(navigation.navigate).not.toHaveBeenCalledWith('LSPSettings');
    });
});

describe('surface duplicates', () => {
    it.each(backendCases)(
        'does not render an item twice on any surface for $name',
        ({ context }) => {
            const ctx = baseContext(context);

            (['menu', 'settings', 'tools'] as const).forEach((surface) => {
                expect(duplicateIdsOnSurface(surface, ctx)).toEqual([]);
            });
        }
    );
});

describe('buildMenuSearchContext', () => {
    it('reads backend capability flags', () => {
        backendFlags.supportsLightningAddress = true;
        backendFlags.isLocalWallet = true;

        const ctx = buildMenuSearchContext({
            hasSelectedNode: true,
            hasLocalSeed: true,
            implementation: 'ldk-node',
            cashuEnabled: false,
            isTestnet: false,
            supportsOffers: true,
            supportsListingOffers: false,
            isChannelMigrating: false,
            canExportChannels: false
        });

        expect(ctx.supportsLightningAddress).toBe(true);
        expect(ctx.isLocalWallet).toBe(true);
    });
});
