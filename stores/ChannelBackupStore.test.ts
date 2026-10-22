jest.mock('react-native-blob-util', () => ({ fetch: jest.fn() }));
jest.mock('./NodeInfoStore', () => ({}));
jest.mock('./SettingsStore', () => ({}));
jest.mock('../lndmobile/LndMobileInjection', () => ({
    __esModule: true,
    default: { channel: {} }
}));
jest.mock('../lndmobile/channel', () => ({
    exportAllChannelBackups: jest.fn(),
    restoreChannelBackups: jest.fn()
}));
jest.mock('../utils/BackendUtils', () => ({
    __esModule: true,
    default: { signMessage: jest.fn() }
}));
jest.mock('../utils/LndMobileUtils', () => ({
    LndMobileEventEmitter: { addListener: jest.fn() }
}));
jest.mock('../utils/Base64Utils', () => ({
    __esModule: true,
    default: { bytesToBase64: () => 'bXVsdGk=' }
}));
jest.mock('../utils/ErrorUtils', () => ({
    errorToUserFriendly: (e: any) => e?.message ?? String(e)
}));
jest.mock('../storage', () => ({
    __esModule: true,
    default: { setItem: jest.fn(), getItem: jest.fn() }
}));

import ReactNativeBlobUtil from 'react-native-blob-util';

import { exportAllChannelBackups } from '../lndmobile/channel';
import BackendUtils from '../utils/BackendUtils';
import ChannelBackupStore, { BACKUPS_HOST } from './ChannelBackupStore';

const NODE_PUBKEY = '03cd';
const CHALLENGE = 'a1'.repeat(64);
const CANONICAL_PHRASE =
    'DO NOT EVER SIGN THIS TEXT WITH YOUR PRIVATE KEYS! IT IS ONLY USED FOR DERIVATION OF LNURL-AUTH HASHING-KEY, DISCLOSING ITS SIGNATURE WILL COMPROMISE YOUR LNURL-AUTH IDENTITY AND MAY LEAD TO LOSS OF FUNDS!';

const fetchMock = ReactNativeBlobUtil.fetch as jest.Mock;
const signMessage = BackendUtils.signMessage as jest.Mock;

// Answers /api/auth with the given challenge and every other path with a
// successful empty-ish reply.
const serveChallenge = (verification: any) =>
    fetchMock.mockImplementation(async (_m: string, url: string) => {
        const path = url.replace(BACKUPS_HOST, '');
        const body =
            path === '/api/auth'
                ? { verification }
                : { success: true, backup: 'b', backups: [] };
        return { info: () => ({ status: 200 }), json: () => body };
    });

const paths = () =>
    fetchMock.mock.calls.map(([, url]) => url.replace(BACKUPS_HOST, ''));

const newStore = () =>
    new ChannelBackupStore(
        { nodeInfo: { identity_pubkey: NODE_PUBKEY } } as any,
        { seedPhrase: ['seed'] } as any
    );

describe('ChannelBackupStore auth challenge', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        signMessage.mockResolvedValue({ zbase: 'zsig' });
        (exportAllChannelBackups as jest.Mock).mockResolvedValue({
            multi_chan_backup: { multi_chan_backup: new Uint8Array([1]) }
        });
    });

    describe('backupChannels', () => {
        it('signs a hex challenge and uploads the backup', async () => {
            serveChallenge(CHALLENGE);

            await expect(newStore().backupChannels()).resolves.toBe(true);

            expect(signMessage).toHaveBeenCalledWith(CHALLENGE);
            expect(paths()).toEqual(['/api/auth', '/api/backup']);
        });

        it.each([
            ['the LNURL-auth canonical phrase', CANONICAL_PHRASE],
            ['uppercase hex', CHALLENGE.toUpperCase()],
            ['short hex', 'a1'.repeat(32)],
            ['a missing challenge', undefined]
        ])('refuses to sign %s', async (_label, verification) => {
            serveChallenge(verification);

            await expect(newStore().backupChannels()).rejects.toThrow();

            expect(signMessage).not.toHaveBeenCalled();
            expect(paths()).toEqual(['/api/auth']);
        });
    });

    describe('recoverStaticChannelBackup', () => {
        it('refuses to sign the LNURL-auth canonical phrase', async () => {
            serveChallenge(CANONICAL_PHRASE);

            await expect(
                newStore().recoverStaticChannelBackup()
            ).rejects.toThrow('Invalid auth challenge');

            expect(signMessage).not.toHaveBeenCalled();
            expect(paths()).toEqual(['/api/auth']);
        });

        it('signs a hex challenge', async () => {
            serveChallenge(CHALLENGE);
            const store = newStore();
            jest.spyOn(store, 'triggerRecovery').mockResolvedValue();

            await store.recoverStaticChannelBackup();

            expect(signMessage).toHaveBeenCalledWith(CHALLENGE);
            expect(paths()).toEqual(['/api/auth', '/api/recover']);
        });
    });

    describe('advancedRecoveryList', () => {
        it('refuses to sign the LNURL-auth canonical phrase', async () => {
            serveChallenge(CANONICAL_PHRASE);
            const store = newStore();

            await expect(store.advancedRecoveryList()).rejects.toThrow(
                'Invalid auth challenge'
            );

            expect(signMessage).not.toHaveBeenCalled();
            expect(paths()).toEqual(['/api/auth']);
            expect(store.error).toBe(true);
            expect(store.loading).toBe(false);
        });

        it('signs a hex challenge', async () => {
            serveChallenge(CHALLENGE);

            await newStore().advancedRecoveryList();

            expect(signMessage).toHaveBeenCalledWith(CHALLENGE);
            expect(paths()).toEqual(['/api/auth', '/api/recoverAdvanced']);
        });
    });
});
