jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../../utils/RestartUtils', () => ({ restartApp: jest.fn() }));
jest.mock('../../storage', () => ({
    __esModule: true,
    default: { getItem: jest.fn() }
}));
jest.mock('../../utils/MigrationUtils', () => ({
    IS_BACKED_UP_KEY: 'backup-complete-v2'
}));
jest.mock('../../utils/ChannelMigrationUtils', () => ({
    CHANNEL_MIGRATION_ACTIVE: 'channel_migration_active'
}));
jest.mock('../../utils/NavigationUtils', () => ({
    reAuthNavigation: jest.fn()
}));
jest.mock('../../utils/UrlUtils', () => ({}));
jest.mock('../../utils/LocaleUtils');
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
jest.mock('../../components/WalletHeader', () => 'WalletHeader');
jest.mock('../../components/Amount', () => 'Amount');
jest.mock('../../components/Conversion', () => 'Conversion');
jest.mock('../../components/SyncingStatus', () => 'SyncingStatus');
jest.mock('../../components/RecoveryStatus', () => 'RecoveryStatus');
jest.mock('../../components/RescanStatus', () => 'RescanStatus');
jest.mock('../../components/Button', () => {
    const { Pressable, Text } = require('react-native');
    return ({ title, onPress }: any) => (
        <Pressable role="button" onPress={onPress}>
            <Text>{title}</Text>
        </Pressable>
    );
});
jest.mock('../../assets/images/SVG/Alert.svg', () => 'AlertIcon');
jest.mock('../../assets/images/SVG/Clock.svg', () => 'ClockIcon');
jest.mock('../../assets/images/SVG/Lock.svg', () => 'LockIcon');

import * as React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import BalancePane from './BalancePane';
import Storage from '../../storage';
import { reAuthNavigation } from '../../utils/NavigationUtils';

const BACKUP_TITLE = 'views.Wallet.BalancePane.backup.title';
const FOLDER_MISSING_TITLE = 'views.Wallet.lndFolderMissing.title';

beforeEach(() => {
    jest.clearAllMocks();
    (Storage.getItem as jest.Mock).mockResolvedValue(false);
});

afterEach(() => jest.restoreAllMocks());

const renderPane = async ({
    implementation = 'embedded-lnd',
    lndFolderMissing = false,
    isSyncing = false,
    balances = {}
}: {
    implementation?: string;
    lndFolderMissing?: boolean;
    isSyncing?: boolean;
    balances?: Record<string, any>;
} = {}) => {
    const listeners: { [event: string]: () => void } = {};
    const unsubscribe = jest.fn();
    const navigation = {
        addListener: jest.fn((event: string, listener: () => void) => {
            listeners[event] = listener;
            return unsubscribe;
        }),
        navigate: jest.fn()
    };
    const result = await render(
        <BalancePane
            {...({
                navigation,
                loading: false,
                isChannelMigrating: false,
                BalanceStore: {
                    lightningBalance: 50_000,
                    totalBlockchainBalance: 80_000,
                    settledBlockchainBalance: 80_000,
                    loadingBlockchainBalance: false,
                    loadingLightningBalance: false,
                    ...balances
                },
                CashuStore: {
                    totalBalanceSats: 0,
                    offlinePendingBalance: 0,
                    offlinePendingTokens: [],
                    offlineSpentTokens: []
                },
                NodeInfoStore: {},
                SettingsStore: {
                    implementation,
                    lndFolderMissing,
                    settings: {}
                },
                SyncStore: { isSyncing, isBusy: isSyncing },
                ModalStore: {}
            } as any)}
        />
    );
    return { navigation, listeners, unsubscribe, ...result };
};

describe('BalancePane backup card', () => {
    it('reminds an embedded LND wallet with funds to back up its seed', async () => {
        await renderPane();

        expect(Storage.getItem).toHaveBeenCalledWith('backup-complete-v2');
        expect(screen.getByText(BACKUP_TITLE)).toBeOnTheScreen();
    });

    it('opens the seed behind re-authentication when pressed', async () => {
        const { navigation } = await renderPane();

        await fireEvent.press(screen.getByText(BACKUP_TITLE));

        expect(reAuthNavigation).toHaveBeenCalledWith(navigation, 'Seed');
    });

    it('is hidden once the seed is backed up', async () => {
        (Storage.getItem as jest.Mock).mockResolvedValue('true');
        await renderPane();

        expect(screen.queryByText(BACKUP_TITLE)).not.toBeOnTheScreen();
    });

    it('is hidden when the view regains focus after the seed is backed up', async () => {
        const { listeners } = await renderPane();
        expect(screen.getByText(BACKUP_TITLE)).toBeOnTheScreen();

        // the Seed view stores the flag once the backup is confirmed
        (Storage.getItem as jest.Mock).mockResolvedValue('true');
        await act(async () => listeners.focus());

        expect(screen.queryByText(BACKUP_TITLE)).not.toBeOnTheScreen();
    });

    it('stays visible when the view regains focus without a backup', async () => {
        const { listeners } = await renderPane();

        await act(async () => listeners.focus());

        expect(Storage.getItem).toHaveBeenCalledTimes(2);
        expect(screen.getByText(BACKUP_TITLE)).toBeOnTheScreen();
    });

    it('keeps the card when the backup status cannot be read on focus', async () => {
        const consoleError = jest
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        const { listeners } = await renderPane();

        (Storage.getItem as jest.Mock).mockRejectedValue(
            new Error('keychain error')
        );
        await act(async () => listeners.focus());

        expect(consoleError).toHaveBeenCalled();
        expect(screen.getByText(BACKUP_TITLE)).toBeOnTheScreen();
    });

    it('stops listening for focus on unmount', async () => {
        const { unsubscribe, unmount } = await renderPane();

        await unmount();

        expect(unsubscribe).toHaveBeenCalledTimes(1);
    });

    it.each([
        ['on other backends', { implementation: 'lnd' }],
        ['while syncing', { isSyncing: true }],
        [
            'without funds',
            {
                balances: { lightningBalance: 0, totalBlockchainBalance: 0 }
            }
        ],
        [
            'while the on-chain balance loads',
            { balances: { loadingBlockchainBalance: true } }
        ],
        [
            'while the Lightning balance loads',
            { balances: { loadingLightningBalance: true } }
        ]
    ])('is hidden %s', async (_label, options) => {
        await renderPane(options);

        expect(screen.queryByText(BACKUP_TITLE)).not.toBeOnTheScreen();
    });

    it.each([
        ['Lightning', { lightningBalance: 50_000, totalBlockchainBalance: 0 }],
        ['on-chain', { lightningBalance: 0, totalBlockchainBalance: 80_000 }]
    ])('is shown with only %s funds', async (_label, balances) => {
        await renderPane({ balances });

        expect(screen.getByText(BACKUP_TITLE)).toBeOnTheScreen();
    });
});

describe('BalancePane missing LND folder card', () => {
    it('shows the card for embedded LND', async () => {
        (Storage.getItem as jest.Mock).mockResolvedValue('true');
        await renderPane({ lndFolderMissing: true });

        expect(screen.getByText(FOLDER_MISSING_TITLE)).toBeOnTheScreen();
    });

    it('is hidden while the folder is present', async () => {
        await renderPane();

        expect(screen.queryByText(FOLDER_MISSING_TITLE)).not.toBeOnTheScreen();
    });

    it('is hidden on other backends', async () => {
        await renderPane({ implementation: 'lnd', lndFolderMissing: true });

        expect(screen.queryByText(FOLDER_MISSING_TITLE)).not.toBeOnTheScreen();
    });
});
