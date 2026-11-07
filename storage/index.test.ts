jest.mock('react-native', () => ({
    NativeModules: {},
    Platform: { OS: 'ios' }
}));

import { NativeModules, Platform } from 'react-native';
import Storage, {
    getInternetPasswordServers,
    getRawItem,
    removeRawItem,
    setRawItemForDevelopment,
    setRawLocalItem,
    wipeSecureStorage
} from './index';

const local = new Map<string, string>();
const cloud = new Map<string, string>();
const partition = (cloudSync: boolean) => (cloudSync ? cloud : local);

const mockModule = {
    get: jest.fn(async (server: string, cloudSync: boolean) => {
        const value = partition(cloudSync).get(server);
        return value === undefined ? null : value;
    }),
    set: jest.fn(async (server: string, value: string, cloudSync: boolean) => {
        partition(cloudSync).set(server, value);
        return true;
    }),
    remove: jest.fn(async (server: string, cloudSync: boolean) => {
        partition(cloudSync).delete(server);
        return true;
    }),
    listServers: jest.fn(async (cloudSync: boolean) => [
        ...partition(cloudSync).keys()
    ]),
    wipe: jest.fn(async () => true)
};

describe('storage', () => {
    beforeEach(() => {
        local.clear();
        cloud.clear();
        jest.clearAllMocks();
        (NativeModules as any).ZeusSecureStorage = mockModule;
        (Platform as any).OS = 'ios';
    });

    describe('Storage', () => {
        it('reads and writes the zeus: prefixed device-local entry', async () => {
            await Storage.setItem('zeus-settings-v2', { nodes: [] });

            expect(local.get('zeus:zeus-settings-v2')).toBe('{"nodes":[]}');
            expect(mockModule.set).toHaveBeenCalledWith(
                'zeus:zeus-settings-v2',
                '{"nodes":[]}',
                false
            );
            await expect(Storage.getItem('zeus-settings-v2')).resolves.toBe(
                '{"nodes":[]}'
            );
        });

        it('returns false for a missing entry and for an empty one', async () => {
            local.set('zeus:empty', '');

            await expect(Storage.getItem('absent')).resolves.toBe(false);
            await expect(Storage.getItem('empty')).resolves.toBe(false);
        });

        it('deletes the entry when asked to store an empty value', async () => {
            local.set('zeus:a', 'value');

            await Storage.setItem('a', '');

            expect(local.has('zeus:a')).toBe(false);
            expect(mockModule.set).not.toHaveBeenCalled();
        });

        it('passes a read error on instead of reporting a miss', async () => {
            mockModule.get.mockRejectedValueOnce(new Error('errSecAuthFailed'));

            await expect(Storage.getItem('a')).rejects.toThrow(
                'errSecAuthFailed'
            );
        });

        it('refuses writes once blocked for a wipe', async () => {
            const blocked = new (Storage.constructor as any)();
            jest.spyOn(console, 'warn').mockImplementationOnce(() => {});
            blocked.blockWrites();

            await expect(blocked.setItem('a', 'value')).resolves.toBe(false);
            expect(mockModule.set).not.toHaveBeenCalled();
        });
    });

    describe('raw items', () => {
        it('addresses exact servers in an exact partition', async () => {
            cloud.set('zeus:a', 'synced');

            await expect(getRawItem('zeus:a', true)).resolves.toBe('synced');
            await expect(getRawItem('zeus:a', false)).resolves.toBeNull();

            await removeRawItem('zeus:a', true);
            expect(cloud.has('zeus:a')).toBe(false);
        });

        it('writes raw items to the device-local partition only', async () => {
            await expect(setRawLocalItem('zeus:a', 'v')).resolves.toBe(true);

            expect(local.get('zeus:a')).toBe('v');
            expect(cloud.size).toBe(0);
        });

        it('reports a write the module answers with false as failed', async () => {
            mockModule.set.mockResolvedValueOnce(false);

            await expect(setRawLocalItem('zeus:a', 'v')).resolves.toBe(false);
        });

        it('only writes the iCloud partition in development', async () => {
            const original = (global as any).__DEV__;
            try {
                (global as any).__DEV__ = false;
                await expect(
                    setRawItemForDevelopment('zeus-settings', 'v', true)
                ).rejects.toThrow('development only');
                expect(cloud.size).toBe(0);

                (global as any).__DEV__ = true;
                await setRawItemForDevelopment('zeus-settings', 'v', true);
                expect(cloud.get('zeus-settings')).toBe('v');
            } finally {
                (global as any).__DEV__ = original;
            }
        });

        it('wipes through the module', async () => {
            await wipeSecureStorage();

            expect(mockModule.wipe).toHaveBeenCalledTimes(1);
        });
    });

    describe('getInternetPasswordServers', () => {
        it('lists one partition on iOS', async () => {
            local.set('zeus:a', '1');
            cloud.set('zeus:b', '2');

            await expect(getInternetPasswordServers(false)).resolves.toEqual([
                'zeus:a'
            ]);
            await expect(getInternetPasswordServers(true)).resolves.toEqual([
                'zeus:b'
            ]);
        });

        it('returns nothing on Android, which has no partitions', async () => {
            (Platform as any).OS = 'android';

            await expect(getInternetPasswordServers(true)).resolves.toEqual([]);
            expect(mockModule.listServers).not.toHaveBeenCalled();
        });

        it('throws rather than listing nothing when the module is missing', async () => {
            delete (NativeModules as any).ZeusSecureStorage;

            await expect(getInternetPasswordServers(false)).rejects.toThrow(
                'ZeusSecureStorage native module is not available'
            );
        });
    });
});
