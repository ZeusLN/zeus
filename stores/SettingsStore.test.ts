// Mock React Native modules
jest.mock('react-native-blob-util', () => ({}));
jest.mock('react-native-encrypted-storage', () => ({}));
jest.mock('react-native-biometrics', () => ({}));
jest.mock('../utils/BiometricUtils', () => ({}));
jest.mock('../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));
jest.mock('../utils/MigrationUtils', () => ({}));
jest.mock('../utils/TorUtils', () => ({}));
jest.mock('../storage', () => ({}));
jest.mock('../utils/BackendUtils', () => ({}));
jest.mock('../models/LoginRequest', () => ({}));

import SettingsStore from './SettingsStore';

describe('SettingsStore', () => {
    describe('default settings', () => {
        it('Express Graph Sync defaults to false', () => {
            const settingsStore = new SettingsStore();
            expect(settingsStore.settings.expressGraphSync).toBe(false);
        });

        it('Other embedded node settings maintain expected defaults', () => {
            const settingsStore = new SettingsStore();
            const settings = settingsStore.settings;

            expect(settings.automaticDisasterRecoveryBackup).toBe(true);
            expect(settings.resetExpressGraphSyncOnStartup).toBe(false);
            expect(settings.bimodalPathfinding).toBe(true);
            expect(settings.dontAllowOtherPeers).toBe(false);
        });

        it('Settings structure contains expressGraphSync property', () => {
            const settingsStore = new SettingsStore();
            expect(settingsStore.settings).toHaveProperty('expressGraphSync');
            expect(typeof settingsStore.settings.expressGraphSync).toBe(
                'boolean'
            );
        });
    });
});
