const mockEncryptString = jest.fn();
const mockDecryptString = jest.fn();
const mockFetch = jest.fn();
const mockExportAllChannelBackups = jest.fn();
const mockRestoreChannelBackups = jest.fn();
const mockSignMessage = jest.fn();

jest.mock('../utils/ZipUtils', () => ({
    encryptString: (...args: any[]) => mockEncryptString(...args),
    decryptString: (...args: any[]) => mockDecryptString(...args)
}));
jest.mock('react-native-blob-util', () => ({
    fetch: (...args: any[]) => mockFetch(...args)
}));
jest.mock('../lndmobile/LndMobileInjection', () => ({
    channel: {
        decodeChannelEvent: jest.fn(),
        subscribeChannelEvents: jest.fn()
    }
}));
jest.mock('../lndmobile/channel', () => ({
    exportAllChannelBackups: (...args: any[]) =>
        mockExportAllChannelBackups(...args),
    restoreChannelBackups: (...args: any[]) =>
        mockRestoreChannelBackups(...args)
}));
jest.mock('../utils/BackendUtils', () => ({
    signMessage: (...args: any[]) => mockSignMessage(...args)
}));
jest.mock('../utils/LndMobileUtils', () => ({
    LndMobileEventEmitter: {
        addListener: jest.fn().mockReturnValue({ remove: jest.fn() })
    }
}));
jest.mock('../utils/ErrorUtils', () => ({
    errorToUserFriendly: (err: any) => err?.message || String(err)
}));
jest.mock('../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));
jest.mock('./NodeInfoStore', () => ({}));
jest.mock('./SettingsStore', () => ({}));
jest.mock('../storage', () => ({
    setItem: jest.fn().mockResolvedValue(true),
    getItem: jest.fn().mockResolvedValue(false),
    removeItem: jest.fn().mockResolvedValue(true)
}));

import * as CryptoJS from 'crypto-js';
import * as nodeCrypto from 'crypto';

import ChannelBackupStore, {
    LAST_CHANNEL_BACKUP_STATUS
} from './ChannelBackupStore';
import Storage from '../storage';

const SEED = Array(23).fill('abandon').concat(['about']);
const MULTI_BYTES = Buffer.from('mock-scb-payload-bytes-for-kat-test');
const MULTI_STRING = MULTI_BYTES.toString('base64');

// Generated once with the repo's crypto-js 4.2.0:
// CryptoJS.AES.encrypt(MULTI_STRING, SEED.toString()).toString()
// The salt is embedded in the blob, so decryption is deterministic.
// Pins compatibility with legacy blobs on the backup server.
const LEGACY_KAT_BLOB =
    'U2FsdGVkX19GAXJgnm/8B2VtF146JC/Pfgeb6mLsJ9kH143lgKFWPnJAEstQktmPhrSidjUx2J++zCSFuRheplzEcmT6VzzhGH4jIv355g4=';

// Reference implementation of the v1 native wire format:
// [0x01 version][16-byte salt][12-byte IV][ciphertext][16-byte GCM tag],
// PBKDF2-HMAC-SHA256 100,000 iterations, AES-256-GCM.
// Mirrors android ZipUtils.java and ios CryptoHelper.swift.
const referenceEncryptV1 = (
    plaintextBase64: string,
    passphrase: string
): string => {
    const salt = nodeCrypto.randomBytes(16);
    const iv = nodeCrypto.randomBytes(12);
    const key = nodeCrypto.pbkdf2Sync(passphrase, salt, 100000, 32, 'sha256');
    const cipher = nodeCrypto.createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([
        cipher.update(Buffer.from(plaintextBase64, 'base64')),
        cipher.final()
    ]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([
        Buffer.from([0x01]),
        salt,
        iv,
        ciphertext,
        tag
    ]).toString('base64');
};

const referenceDecryptV1 = (dataBase64: string, passphrase: string): string => {
    const data = Buffer.from(dataBase64, 'base64');
    if (data[0] !== 0x01) {
        throw new Error(`Unsupported encryption version: ${data[0]}`);
    }
    const salt = data.subarray(1, 17);
    const iv = data.subarray(17, 29);
    const ciphertext = data.subarray(29, data.length - 16);
    const tag = data.subarray(data.length - 16);
    const key = nodeCrypto.pbkdf2Sync(passphrase, salt, 100000, 32, 'sha256');
    const decipher = nodeCrypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([
        decipher.update(ciphertext),
        decipher.final()
    ]).toString('base64');
};

const makeStore = (settingsStore: any = { seedPhrase: [...SEED] }) =>
    new ChannelBackupStore(
        { nodeInfo: { identity_pubkey: 'pubkey123' } } as any,
        settingsStore
    );

describe('ChannelBackupStore', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('triggerRecovery', () => {
        it('decrypts a legacy CryptoJS blob with the comma-joined seed', async () => {
            const blob = CryptoJS.AES.encrypt(
                MULTI_STRING,
                SEED.toString()
            ).toString();

            await makeStore().triggerRecovery(blob);

            expect(mockRestoreChannelBackups).toHaveBeenCalledWith(
                MULTI_STRING
            );
            expect(mockDecryptString).not.toHaveBeenCalled();
        });

        it('decrypts the hardcoded legacy known-answer blob', async () => {
            await makeStore().triggerRecovery(LEGACY_KAT_BLOB);

            expect(mockRestoreChannelBackups).toHaveBeenCalledWith(
                MULTI_STRING
            );
            expect(mockDecryptString).not.toHaveBeenCalled();
        });

        it('routes v1 blobs to decryptString with the space-joined seed', async () => {
            const blob = Buffer.concat([
                Buffer.from([0x01]),
                Buffer.alloc(44)
            ]).toString('base64');
            mockDecryptString.mockResolvedValue('DECRYPTED_B64');

            await makeStore().triggerRecovery(blob);

            expect(mockDecryptString).toHaveBeenCalledWith(
                blob,
                SEED.join(' ')
            );
            expect(mockRestoreChannelBackups).toHaveBeenCalledWith(
                'DECRYPTED_B64'
            );
        });

        it('round-trips the v1 wire format via the reference implementation', async () => {
            mockDecryptString.mockImplementation((blob, passphrase) =>
                Promise.resolve(referenceDecryptV1(blob, passphrase))
            );
            const blob = referenceEncryptV1(MULTI_STRING, SEED.join(' '));

            await makeStore().triggerRecovery(blob);

            expect(mockRestoreChannelBackups).toHaveBeenCalledWith(
                MULTI_STRING
            );
        });

        it('rejects blobs with an unrecognized format byte', async () => {
            const store = makeStore();
            const blob = Buffer.concat([
                Buffer.from([0x02]),
                Buffer.alloc(44)
            ]).toString('base64');

            await expect(store.triggerRecovery(blob)).rejects.toThrow(
                'stores.ChannelBackupStore.unrecognizedBackupFormat'
            );
            expect(mockRestoreChannelBackups).not.toHaveBeenCalled();
            expect(mockDecryptString).not.toHaveBeenCalled();
            expect(store.error_msg).toBe(
                'stores.ChannelBackupStore.unrecognizedBackupFormat'
            );
            expect(store.loading).toBe(false);
        });

        it('rejects an empty backup string', async () => {
            const store = makeStore();

            await expect(store.triggerRecovery('')).rejects.toThrow(
                'stores.ChannelBackupStore.unrecognizedBackupFormat'
            );
            expect(mockRestoreChannelBackups).not.toHaveBeenCalled();
        });
    });

    describe('backupChannels', () => {
        const mockBackupExport = () =>
            mockExportAllChannelBackups.mockResolvedValue({
                multi_chan_backup: {
                    multi_chan_backup: Uint8Array.from(MULTI_BYTES)
                }
            });

        it('encrypts with the v1 format and uploads the blob', async () => {
            mockBackupExport();
            mockEncryptString.mockResolvedValue('ENCRYPTED_BLOB');
            mockSignMessage.mockResolvedValue({ zbase: 'sig123' });
            mockFetch
                .mockResolvedValueOnce({
                    info: () => ({ status: 200 }),
                    json: () => ({ verification: 'challenge' })
                })
                .mockResolvedValueOnce({
                    info: () => ({ status: 200 }),
                    json: () => ({ success: true })
                });

            const result = await makeStore().backupChannels();

            expect(result).toBe(true);
            expect(mockEncryptString).toHaveBeenCalledWith(
                MULTI_STRING,
                SEED.join(' ')
            );
            const backupCall = mockFetch.mock.calls[1];
            expect(backupCall[1]).toContain('/api/backup');
            expect(JSON.parse(backupCall[3])).toMatchObject({
                pubkey: 'pubkey123',
                backup: 'ENCRYPTED_BLOB'
            });
            expect(Storage.setItem).toHaveBeenCalledWith(
                LAST_CHANNEL_BACKUP_STATUS,
                'SUCCESS'
            );
        });

        it('logs ERROR and throws a proper Error when the seed is unavailable', async () => {
            mockBackupExport();
            const store = makeStore({ seedPhrase: undefined });

            await expect(store.backupChannels()).rejects.toThrow(
                'stores.ChannelBackupStore.seedUnavailable'
            );
            expect(Storage.setItem).toHaveBeenCalledWith(
                LAST_CHANNEL_BACKUP_STATUS,
                'ERROR'
            );
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('logs ERROR and rethrows when native encryption fails', async () => {
            mockBackupExport();
            mockEncryptString.mockRejectedValue(new Error('native failure'));

            await expect(makeStore().backupChannels()).rejects.toThrow(
                'native failure'
            );
            expect(Storage.setItem).toHaveBeenCalledWith(
                LAST_CHANNEL_BACKUP_STATUS,
                'ERROR'
            );
            expect(mockFetch).not.toHaveBeenCalled();
        });
    });
});
