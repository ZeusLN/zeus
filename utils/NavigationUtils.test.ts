jest.mock('../stores/Stores', () => ({
    settingsStore: {
        posStatus: 'inactive',
        settings: {},
        setPosStatus: jest.fn(),
        loginMethodConfigured: jest.fn()
    }
}));

import { settingsStore } from '../stores/Stores';
import { protectedNavigation, reAuthNavigation } from './NavigationUtils';

const mockSettingsStore = settingsStore as any;

describe('NavigationUtils', () => {
    let navigation: any;

    beforeEach(() => {
        jest.clearAllMocks();
        navigation = { navigate: jest.fn() };
        mockSettingsStore.posStatus = 'inactive';
        mockSettingsStore.settings = {};
    });

    describe('reAuthNavigation', () => {
        it('routes via Lockscreen when a login method is configured', () => {
            mockSettingsStore.loginMethodConfigured.mockReturnValue(true);

            reAuthNavigation(navigation, 'Seed');

            expect(navigation.navigate).toHaveBeenCalledTimes(1);
            expect(navigation.navigate).toHaveBeenCalledWith('Lockscreen', {
                pendingNavigation: { screen: 'Seed', params: undefined }
            });
        });

        it('passes route params through the Lockscreen pendingNavigation', () => {
            mockSettingsStore.loginMethodConfigured.mockReturnValue(true);
            const params = {
                walletSeedPhrase: ['abandon', 'ability', 'able'],
                implementation: 'ldk-node',
                isTestNet: true
            };

            reAuthNavigation(navigation, 'Seed', params);

            expect(navigation.navigate).toHaveBeenCalledWith('Lockscreen', {
                pendingNavigation: { screen: 'Seed', params }
            });
        });

        it('navigates directly when no login method is configured', () => {
            mockSettingsStore.loginMethodConfigured.mockReturnValue(false);
            const params = { skipWarning: true };

            reAuthNavigation(navigation, 'Seed', params);

            expect(navigation.navigate).toHaveBeenCalledTimes(1);
            expect(navigation.navigate).toHaveBeenCalledWith('Seed', params);
        });

        it('does not consult POS status', () => {
            mockSettingsStore.posStatus = 'active';
            mockSettingsStore.loginMethodConfigured.mockReturnValue(true);

            reAuthNavigation(navigation, 'Seed');

            expect(navigation.navigate).toHaveBeenCalledWith(
                'Lockscreen',
                expect.anything()
            );
        });
    });

    describe('protectedNavigation', () => {
        // Credentials persist as verifier records post-migration; the gate
        // must read those, not the removed plaintext pin/passphrase fields.
        const verifier = {
            v: 1,
            kdf: 'scrypt',
            n: 32768,
            r: 8,
            p: 1,
            salt: 'aa'.repeat(16),
            hash: 'bb'.repeat(32)
        };

        it('routes via Lockscreen when POS is active and a pin verifier is set', async () => {
            mockSettingsStore.posStatus = 'active';
            mockSettingsStore.settings = { pinVerifier: verifier };

            await protectedNavigation(navigation, 'Menu');

            expect(navigation.navigate).toHaveBeenCalledWith('Lockscreen', {
                pendingNavigation: { screen: 'Menu', params: undefined }
            });
        });

        it('routes via Lockscreen when POS is active and a passphrase verifier is set', async () => {
            mockSettingsStore.posStatus = 'active';
            mockSettingsStore.settings = { passphraseVerifier: verifier };

            await protectedNavigation(navigation, 'Menu');

            expect(navigation.navigate).toHaveBeenCalledWith('Lockscreen', {
                pendingNavigation: { screen: 'Menu', params: undefined }
            });
        });

        it('navigates directly when POS is active but no credential is configured', async () => {
            mockSettingsStore.posStatus = 'active';
            mockSettingsStore.settings = {};

            await protectedNavigation(navigation, 'Menu');

            expect(navigation.navigate).toHaveBeenCalledWith('Menu', undefined);
        });

        it('navigates directly when POS is inactive', async () => {
            mockSettingsStore.posStatus = 'inactive';
            mockSettingsStore.settings = { pinVerifier: verifier };

            await protectedNavigation(navigation, 'Menu');

            expect(navigation.navigate).toHaveBeenCalledWith('Menu', undefined);
        });

        it('deactivates POS when requested on ungated navigation', async () => {
            mockSettingsStore.posStatus = 'inactive';
            mockSettingsStore.settings = {};

            await protectedNavigation(navigation, 'Wallet', true);

            expect(mockSettingsStore.setPosStatus).toHaveBeenCalledWith(
                'inactive'
            );
            expect(navigation.navigate).toHaveBeenCalledWith(
                'Wallet',
                undefined
            );
        });
    });
});
