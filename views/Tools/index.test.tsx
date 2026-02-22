jest.mock('../../utils/LocaleUtils');
jest.mock('../../utils/BackendUtils', () => ({
    __esModule: true,
    default: new Proxy({}, { get: () => () => false })
}));

import { Platform } from 'react-native';

import { MENU_SEARCH_ITEMS } from '../Menu/searchRegistry';
import {
    buildMenuSearchContext,
    getMenuSearchItemLabelKey,
    getVisibleSettingsSurfaceGroups,
    handleMenuSearchItemPress
} from '../Menu/searchUtils';

const toolsContext = ({
    hasSelectedNode = false,
    implementation,
    canExportChannels = false,
    isChannelMigrating = false
}: {
    hasSelectedNode?: boolean;
    implementation?: string;
    canExportChannels?: boolean;
    isChannelMigrating?: boolean;
} = {}) =>
    buildMenuSearchContext({
        hasSelectedNode,
        hasEmbeddedSeed: false,
        implementation,
        cashuEnabled: false,
        isTestnet: false,
        supportsOffers: false,
        isChannelMigrating,
        canExportChannels
    });

const visibleToolIds = (options?: Parameters<typeof toolsContext>[0]) =>
    getVisibleSettingsSurfaceGroups(toolsContext(options), 'tools').flatMap(
        (group) => group.items.map(({ item }) => item.id)
    );

const itemById = (id: string) => {
    const item = MENU_SEARCH_ITEMS.find((entry) => entry.id === id);
    if (!item) {
        throw new Error(`Missing menu item ${id}`);
    }
    return item;
};

afterEach(() => {
    jest.restoreAllMocks();
});

describe('Tools menu', () => {
    it('offers wallet config export/import when no wallet exists', () => {
        const navigation = { navigate: jest.fn() };

        expect(visibleToolIds()).toContain('config-export-import');
        handleMenuSearchItemPress({
            item: itemById('config-export-import'),
            navigation
        });

        expect(navigation.navigate).toHaveBeenCalledWith(
            'NodeConfigExportImport',
            undefined
        );
    });

    it('offers wallet config export/import with a wallet selected', () => {
        expect(
            visibleToolIds({
                hasSelectedNode: true,
                implementation: 'embedded-lnd'
            })
        ).toContain('config-export-import');
    });

    it.each([
        ['android', 'views.Tools.keychainCleanup.title.android'],
        ['ios', 'views.Tools.keychainCleanup.title']
    ] as const)('names the keychain cleanup tool for %s', (os, title) => {
        jest.replaceProperty(Platform, 'OS', os);

        expect(visibleToolIds()).toContain('keychain-cleanup');
        expect(getMenuSearchItemLabelKey(itemById('keychain-cleanup'))).toBe(
            title
        );
    });

    it('offers channel export for an embedded LND wallet that can export', () => {
        expect(
            visibleToolIds({
                hasSelectedNode: true,
                implementation: 'embedded-lnd',
                canExportChannels: true
            })
        ).toContain('channel-export');
        expect(
            visibleToolIds({
                implementation: 'embedded-lnd',
                canExportChannels: false
            })
        ).not.toContain('channel-export');
    });
});
