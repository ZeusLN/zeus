import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import { Alert, Platform } from 'react-native';

import {
    LEGACY_EXPORT_CLEANUP_KEY,
    LEGACY_EXPORT_PROMPT_KEY,
    checkLegacyExportFiles,
    promptLegacyExportCleanup,
    resetLegacyExportPromptSession
} from './LegacyExportUtils';

jest.mock('react-native-fs', () => ({
    DownloadDirectoryPath: '/mock/download/path',
    DocumentDirectoryPath: '/mock/document/path',
    CachesDirectoryPath: '/mock/caches/path',
    exists: jest.fn(),
    unlink: jest.fn(),
    mkdir: jest.fn(),
    copyFile: jest.fn(),
    readDir: jest.fn()
}));

jest.mock('react-native-share', () => ({
    __esModule: true,
    default: { open: jest.fn() }
}));

jest.mock('react-native', () => ({
    Platform: { OS: 'ios' },
    Alert: { alert: jest.fn() }
}));

const mockStore: { [key: string]: string } = {};
jest.mock('react-native-encrypted-storage', () => ({
    getItem: jest.fn((key: string) =>
        Promise.resolve(key in mockStore ? mockStore[key] : null)
    ),
    setItem: jest.fn((key: string, value: string) => {
        mockStore[key] = value;
        return Promise.resolve();
    }),
    removeItem: jest.fn((key: string) => {
        delete mockStore[key];
        return Promise.resolve();
    })
}));

// NodeConfigUtils pulls in SettingsStore; only the extension is needed here
jest.mock('./NodeConfigUtils', () => ({
    NODE_CONFIG_EXPORT_EXT: '.zeus-wallet-config-backup'
}));

// The English strings, so the tests read the text the user sees
jest.mock('./LocaleUtils', () => {
    const en = require('../locales/en.json');
    return {
        localeString: (key: string, subs?: { [key: string]: any }) =>
            (en[key] as string).replace(/\{\{(\w+)\}\}/g, (match, name) =>
                subs && name in subs ? String(subs[name]) : match
            )
    };
});

const en = require('../locales/en.json');
const SHARE = en['general.share'];
const DELETE = en['general.delete'];
const NOT_NOW = en['views.Wallet.legacyExports.notNow'];
const CONFIG_WARNING = en['views.Wallet.legacyExports.configWarning'];

// Unlocked and outside the POS till
const unlocked = { loginRequired: () => false, posViewActive: () => false };
const inPos = { loginRequired: () => false, posViewActive: () => true };
const locked = { loginRequired: () => true, posViewActive: () => false };

const DOCS = '/mock/document/path';
const STAGING = '/mock/caches/path/csv-share-staging';

const file = (name: string) => ({
    name,
    path: `${DOCS}/${name}`,
    isFile: () => true
});

const LEGACY_ENTRIES = [
    file('20260101-120000.zeus-wallet-config-backup'),
    file('zeus_20250212_140719_ln_invoices.csv'),
    file('zeus_20250212_140719_onchain (1).csv'),
    // user files that must never be listed, shared or deleted
    file('zeus_20250212_140719_personal-tax.csv'),
    file('notes.txt'),
    { name: 'ldk-node', path: `${DOCS}/ldk-node`, isFile: () => false }
];

const LEGACY_PATHS = [
    `${DOCS}/20260101-120000.zeus-wallet-config-backup`,
    `${DOCS}/zeus_20250212_140719_ln_invoices.csv`,
    `${DOCS}/zeus_20250212_140719_onchain (1).csv`
];

const lastAlertButtons = () => {
    const calls = (Alert.alert as jest.Mock).mock.calls;
    return calls[calls.length - 1][2] as Array<{
        text: string;
        style?: string;
        onPress?: () => Promise<void> | void;
    }>;
};

const pressButton = async (text: string) => {
    const button = lastAlertButtons().find((b) => b.text === text);
    if (!button) throw new Error(`no ${text} button`);
    await button.onPress?.();
};

const unlinkedPaths = () =>
    (RNFS.unlink as jest.Mock).mock.calls.map((c: any[]) => c[0]);

const shareDir = () => (RNFS.mkdir as jest.Mock).mock.calls[0][0] as string;

// Documents lists the legacy entries; the share staging root is empty
const mockDocuments = (entries: any[]) =>
    (RNFS.readDir as jest.Mock).mockImplementation((dir: string) =>
        Promise.resolve(dir === DOCS ? entries : [])
    );

describe('LegacyExportUtils', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        for (const key of Object.keys(mockStore)) delete mockStore[key];
        (Platform.OS as any) = 'ios';
        mockDocuments(LEGACY_ENTRIES);
        (RNFS.exists as jest.Mock).mockResolvedValue(false);
        (RNFS.unlink as jest.Mock).mockResolvedValue(undefined);
        (RNFS.mkdir as jest.Mock).mockResolvedValue(undefined);
        (RNFS.copyFile as jest.Mock).mockResolvedValue(undefined);
        (Share.open as jest.Mock).mockResolvedValue({ success: true });
        resetLegacyExportPromptSession();
    });

    describe('checkLegacyExportFiles (startup migration)', () => {
        it('records a pending prompt with counts and deletes nothing', async () => {
            await checkLegacyExportFiles();

            expect(RNFS.readDir).toHaveBeenCalledWith(DOCS);
            expect(RNFS.unlink).not.toHaveBeenCalled();
            expect(JSON.parse(mockStore[LEGACY_EXPORT_PROMPT_KEY])).toEqual({
                config: 1,
                csv: 2
            });
            expect(mockStore[LEGACY_EXPORT_CLEANUP_KEY]).toBeUndefined();
        });

        it('sets the cleanup flag without a prompt when no legacy files exist', async () => {
            mockDocuments([
                file('notes.txt'),
                file('zeus_20250212_140719_personal-tax.csv')
            ]);

            await checkLegacyExportFiles();

            expect(mockStore[LEGACY_EXPORT_CLEANUP_KEY]).toBe('true');
            expect(mockStore[LEGACY_EXPORT_PROMPT_KEY]).toBeUndefined();
            expect(RNFS.unlink).not.toHaveBeenCalled();
        });

        it('does nothing once the cleanup flag is set', async () => {
            mockStore[LEGACY_EXPORT_CLEANUP_KEY] = 'true';

            await checkLegacyExportFiles();

            expect(RNFS.readDir).not.toHaveBeenCalledWith(DOCS);
            expect(mockStore[LEGACY_EXPORT_PROMPT_KEY]).toBeUndefined();
        });

        it('leaves Android alone and marks it done', async () => {
            (Platform.OS as any) = 'android';

            await checkLegacyExportFiles();

            expect(RNFS.readDir).not.toHaveBeenCalledWith(DOCS);
            expect(RNFS.unlink).not.toHaveBeenCalled();
            expect(mockStore[LEGACY_EXPORT_CLEANUP_KEY]).toBe('true');
        });

        it.each([
            ['on iOS before the cleanup', 'ios', false],
            ['on iOS after the cleanup', 'ios', true],
            ['on Android', 'android', true]
        ])(
            'sweeps stale share staging %s, keeping recent shares',
            async (_label, os, flagSet) => {
                (Platform.OS as any) = os;
                if (flagSet) mockStore[LEGACY_EXPORT_CLEANUP_KEY] = 'true';
                const stale = {
                    name: `${Date.now() - 2 * 60 * 60 * 1000}-1`,
                    path: `${STAGING}/stale`,
                    isDirectory: () => true
                };
                const recent = {
                    name: `${Date.now()}-2`,
                    path: `${STAGING}/recent`,
                    isDirectory: () => true
                };
                (RNFS.readDir as jest.Mock).mockImplementation((dir: string) =>
                    Promise.resolve(
                        dir === STAGING
                            ? [stale, recent]
                            : dir === DOCS
                            ? LEGACY_ENTRIES
                            : []
                    )
                );

                await checkLegacyExportFiles();

                expect(unlinkedPaths()).toEqual([stale.path]);
            }
        );

        it('retries next launch when Documents cannot be listed', async () => {
            (RNFS.readDir as jest.Mock).mockRejectedValue(new Error('EIO'));

            await checkLegacyExportFiles();

            expect(mockStore[LEGACY_EXPORT_CLEANUP_KEY]).toBeUndefined();
            expect(mockStore[LEGACY_EXPORT_PROMPT_KEY]).toBeUndefined();
        });
    });

    describe('promptLegacyExportCleanup', () => {
        beforeEach(async () => {
            await checkLegacyExportFiles();
            jest.clearAllMocks();
        });

        const lastMessage = () => {
            const calls = (Alert.alert as jest.Mock).mock.calls;
            return calls[calls.length - 1][1] as string;
        };

        it('shows one prompt with the counts and the credentials warning', async () => {
            await promptLegacyExportCleanup(unlocked);

            expect(Alert.alert).toHaveBeenCalledTimes(1);
            const [title, message] = (Alert.alert as jest.Mock).mock.calls[0];
            expect(title).toBe('Old export files');
            expect(message).toContain(
                'Older ZEUS versions left 3 export files (1 wallet config backup, 2 activity CSVs) in the ZEUS folder'
            );
            expect(message).toContain(CONFIG_WARNING);
            // nothing is touched until the user picks
            expect(RNFS.unlink).not.toHaveBeenCalled();
        });

        it('offers Share first: iOS moves the cancel action to the bottom, so it shows Share, Delete, Not now', async () => {
            await promptLegacyExportCleanup(unlocked);

            expect(
                lastAlertButtons().map(({ text, style }) => ({ text, style }))
            ).toEqual([
                { text: SHARE, style: undefined },
                { text: DELETE, style: 'destructive' },
                { text: NOT_NOW, style: 'cancel' }
            ]);
        });

        it('uses the singular for one file and one CSV, and omits the credentials warning without configs', async () => {
            mockDocuments([file('zeus_20250212_140719_ln_payments.csv')]);

            await promptLegacyExportCleanup(unlocked);

            const message = lastMessage();
            expect(message).toBe(
                'Older ZEUS versions left 1 export file (0 wallet config backups, 1 activity CSV) in the ZEUS folder of the Files app, which this version no longer shows. Share it now to keep a copy, or delete it. Both remove it from this device. If you choose Not now, ZEUS will ask again the next time it starts.'
            );
            expect(message).not.toContain(CONFIG_WARNING);
        });

        it('uses the singular throughout the message for one file', async () => {
            mockDocuments([file('20260101-120000.zeus-wallet-config-backup')]);

            await promptLegacyExportCleanup(unlocked);

            expect(lastMessage()).toBe(
                'Older ZEUS versions left 1 export file (1 wallet config backup, 0 activity CSVs) in the ZEUS folder of the Files app, which this version no longer shows. Share it now to keep a copy, or delete it. Both remove it from this device. If you choose Not now, ZEUS will ask again the next time it starts.' +
                    `\n\n${CONFIG_WARNING}`
            );
        });

        it('uses the plural throughout the message for several files', async () => {
            mockDocuments([
                file('20260101-120000.zeus-wallet-config-backup'),
                file('20260102-120000.zeus-wallet-config-backup'),
                file('zeus_20250212_140719_ln_invoices.csv'),
                file('zeus_20250212_140719_ln_payments.csv')
            ]);

            await promptLegacyExportCleanup(unlocked);

            expect(lastMessage()).toBe(
                'Older ZEUS versions left 4 export files (2 wallet config backups, 2 activity CSVs) in the ZEUS folder of the Files app, which this version no longer shows. Share them now to keep a copy, or delete them. Both remove them from this device. If you choose Not now, ZEUS will ask again the next time it starts.' +
                    `\n\n${CONFIG_WARNING}`
            );
        });

        it('stays quiet in the POS till, then prompts once when the user leaves it', async () => {
            // Wallet startup or a refresh while the till is up
            await promptLegacyExportCleanup(inPos);
            expect(Alert.alert).not.toHaveBeenCalled();
            expect(RNFS.readDir).not.toHaveBeenCalled();

            // unlocked out of POS into the wallet
            await promptLegacyExportCleanup(unlocked);
            expect(Alert.alert).toHaveBeenCalledTimes(1);

            // a second exit from POS or a later Wallet refresh this launch
            await promptLegacyExportCleanup(inPos);
            await promptLegacyExportCleanup(unlocked);
            expect(Alert.alert).toHaveBeenCalledTimes(1);
        });

        it('does not prompt before unlock, and still prompts after it', async () => {
            await promptLegacyExportCleanup(locked);
            expect(Alert.alert).not.toHaveBeenCalled();
            expect(RNFS.readDir).not.toHaveBeenCalled();

            await promptLegacyExportCleanup(unlocked);
            expect(Alert.alert).toHaveBeenCalledTimes(1);
        });

        it('Share: shares every legacy file, then deletes them and sets the flag', async () => {
            await promptLegacyExportCleanup(unlocked);
            await pressButton(SHARE);

            const dir = shareDir();
            expect(dir.startsWith(`${STAGING}/`)).toBe(true);
            const staged = [
                `${dir}/20260101-120000.zeus-wallet-config-backup`,
                `${dir}/zeus_20250212_140719_ln_invoices.csv`,
                `${dir}/zeus_20250212_140719_onchain (1).csv`
            ];
            expect(RNFS.copyFile).toHaveBeenCalledTimes(3);
            LEGACY_PATHS.forEach((path, i) =>
                expect(RNFS.copyFile).toHaveBeenCalledWith(path, staged[i])
            );
            expect(Share.open).toHaveBeenCalledWith({
                urls: staged.map((p) => `file://${p}`),
                failOnCancel: true
            });

            // originals deleted only after the share sheet reported success
            const shareOrder = (Share.open as jest.Mock).mock
                .invocationCallOrder[0];
            const unlinkOrders = (RNFS.unlink as jest.Mock).mock
                .invocationCallOrder;
            expect(unlinkedPaths()).toEqual(LEGACY_PATHS);
            unlinkOrders.forEach((order: number) =>
                expect(order).toBeGreaterThan(shareOrder)
            );
            expect(mockStore[LEGACY_EXPORT_CLEANUP_KEY]).toBe('true');
            expect(mockStore[LEGACY_EXPORT_PROMPT_KEY]).toBeUndefined();
        });

        it('Share cancelled: keeps the files and prompts again next launch', async () => {
            (Share.open as jest.Mock).mockRejectedValue(
                new Error('User did not share')
            );
            (RNFS.exists as jest.Mock).mockResolvedValue(true);

            await promptLegacyExportCleanup(unlocked);
            await pressButton(SHARE);

            // only this share's staging subdir is removed, never the
            // originals or another share's staging
            expect(unlinkedPaths()).toEqual([shareDir()]);
            expect(mockStore[LEGACY_EXPORT_CLEANUP_KEY]).toBeUndefined();
            expect(mockStore[LEGACY_EXPORT_PROMPT_KEY]).toBeDefined();

            resetLegacyExportPromptSession();
            await promptLegacyExportCleanup(unlocked);
            expect(Alert.alert).toHaveBeenCalledTimes(2);
        });

        it('Share: gives colliding staged names distinct files', async () => {
            mockDocuments([
                file('a:b.zeus-wallet-config-backup'),
                file('a_b.zeus-wallet-config-backup')
            ]);

            await promptLegacyExportCleanup(unlocked);
            await pressButton(SHARE);

            const dir = shareDir();
            expect((RNFS.copyFile as jest.Mock).mock.calls).toEqual([
                [
                    `${DOCS}/a:b.zeus-wallet-config-backup`,
                    `${dir}/a_b.zeus-wallet-config-backup`
                ],
                [
                    `${DOCS}/a_b.zeus-wallet-config-backup`,
                    `${dir}/a_b (2).zeus-wallet-config-backup`
                ]
            ]);
        });

        it('Share: keeps the originals when staging a copy fails', async () => {
            (RNFS.copyFile as jest.Mock).mockRejectedValueOnce(
                new Error('ENOSPC')
            );

            await promptLegacyExportCleanup(unlocked);
            await pressButton(SHARE);

            expect(Share.open).not.toHaveBeenCalled();
            expect(unlinkedPaths()).not.toEqual(
                expect.arrayContaining([LEGACY_PATHS[0]])
            );
            expect(mockStore[LEGACY_EXPORT_CLEANUP_KEY]).toBeUndefined();
        });

        it('Delete: deletes exactly the legacy files and sets the flag', async () => {
            await promptLegacyExportCleanup(unlocked);
            await pressButton(DELETE);

            expect(Share.open).not.toHaveBeenCalled();
            expect(unlinkedPaths()).toEqual(LEGACY_PATHS);
            expect(mockStore[LEGACY_EXPORT_CLEANUP_KEY]).toBe('true');
            expect(mockStore[LEGACY_EXPORT_PROMPT_KEY]).toBeUndefined();
        });

        it('Delete: sets the flag even when one unlink fails', async () => {
            (RNFS.unlink as jest.Mock).mockRejectedValueOnce(
                new Error('EPERM')
            );

            await promptLegacyExportCleanup(unlocked);
            await pressButton(DELETE);

            expect(unlinkedPaths()).toEqual(LEGACY_PATHS);
            expect(mockStore[LEGACY_EXPORT_CLEANUP_KEY]).toBe('true');
        });

        it('Not now: deletes nothing, stays quiet this session, prompts again next launch', async () => {
            await promptLegacyExportCleanup(unlocked);
            await pressButton(NOT_NOW);

            expect(RNFS.unlink).not.toHaveBeenCalled();
            expect(mockStore[LEGACY_EXPORT_CLEANUP_KEY]).toBeUndefined();

            // later Wallet refreshes in the same session
            await promptLegacyExportCleanup(unlocked);
            expect(Alert.alert).toHaveBeenCalledTimes(1);

            // next launch
            resetLegacyExportPromptSession();
            await checkLegacyExportFiles();
            await promptLegacyExportCleanup(unlocked);
            expect(Alert.alert).toHaveBeenCalledTimes(2);
        });

        it('marks the cleanup done without a prompt when the files are already gone', async () => {
            mockDocuments([]);

            await promptLegacyExportCleanup(unlocked);

            expect(Alert.alert).not.toHaveBeenCalled();
            expect(mockStore[LEGACY_EXPORT_CLEANUP_KEY]).toBe('true');
            expect(mockStore[LEGACY_EXPORT_PROMPT_KEY]).toBeUndefined();
        });

        it('does not prompt once the cleanup flag is set', async () => {
            mockStore[LEGACY_EXPORT_CLEANUP_KEY] = 'true';

            await promptLegacyExportCleanup(unlocked);

            expect(Alert.alert).not.toHaveBeenCalled();
            expect(RNFS.readDir).not.toHaveBeenCalled();
        });

        it('does not prompt on Android', async () => {
            (Platform.OS as any) = 'android';

            await promptLegacyExportCleanup(unlocked);

            expect(Alert.alert).not.toHaveBeenCalled();
        });
    });

    it('does not prompt when nothing was recorded as pending', async () => {
        await promptLegacyExportCleanup(unlocked);

        expect(Alert.alert).not.toHaveBeenCalled();
        expect(RNFS.readDir).not.toHaveBeenCalled();
    });
});
