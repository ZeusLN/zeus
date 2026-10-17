jest.mock('react-native-blob-util', () => ({
    __esModule: true,
    default: { fetch: jest.fn() }
}));
jest.mock('../lndmobile/LndMobileInjection', () => ({
    __esModule: true,
    default: { channel: {} }
}));
jest.mock('../lndmobile/channel', () => ({
    exportAllChannelBackups: jest.fn(),
    restoreChannelBackups: jest.fn(async () => undefined)
}));
jest.mock('../utils/BackendUtils', () => ({
    __esModule: true,
    default: {}
}));
jest.mock('../utils/LndMobileUtils', () => ({}));
jest.mock('../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));
jest.mock('../storage', () => ({
    __esModule: true,
    default: { setItem: jest.fn(async () => undefined) }
}));

import * as CryptoJS from 'crypto-js';

import ChannelBackupStore from './ChannelBackupStore';
import { restoreChannelBackups } from '../lndmobile/channel';

describe('ChannelBackupStore.triggerRecovery', () => {
    const seedPhrase = 'abandon ability able about above absent'.split(' ');
    const setup = () =>
        new ChannelBackupStore(
            { nodeInfo: { identity_pubkey: '02node' } } as any,
            { seedPhrase } as any
        );

    beforeEach(() => jest.clearAllMocks());

    it('restores the decrypted backup', async () => {
        const backup = CryptoJS.AES.encrypt(
            'c2Ni',
            seedPhrase.toString()
        ).toString();

        const store = setup();
        await store.triggerRecovery(backup);

        expect(restoreChannelBackups).toHaveBeenCalledWith('c2Ni');
        expect(store.error_msg).toBe('');
        expect(store.loading).toBe(false);
    });

    it('rejects a backup that is not a string before decrypting it', async () => {
        // CryptoJS would use the object as CipherParams and allocate
        // sigBytes bytes
        const decrypt = jest.spyOn(CryptoJS.AES, 'decrypt');
        const store = setup();

        await expect(
            store.triggerRecovery({
                ciphertext: { words: [], sigBytes: 1024 }
            } as any)
        ).rejects.toThrow('stores.ChannelBackupStore.invalidBackup');

        expect(decrypt).not.toHaveBeenCalled();
        expect(restoreChannelBackups).not.toHaveBeenCalled();
        expect(store.error_msg).toBe('stores.ChannelBackupStore.invalidBackup');
        expect(store.loading).toBe(false);
        decrypt.mockRestore();
    });

    it('rejects a backup longer than 1 MiB before decrypting it', async () => {
        const decrypt = jest.spyOn(CryptoJS.AES, 'decrypt');
        const store = setup();

        await expect(
            store.triggerRecovery('U2FsdGVkX1' + 'A'.repeat(1024 * 1024))
        ).rejects.toThrow('stores.ChannelBackupStore.invalidBackup');

        expect(decrypt).not.toHaveBeenCalled();
        expect(restoreChannelBackups).not.toHaveBeenCalled();
        decrypt.mockRestore();
    });
});
