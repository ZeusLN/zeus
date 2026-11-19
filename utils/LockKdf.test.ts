import { NativeModules } from 'react-native';

import { pbkdf2Sha256 } from './LockKdf';

describe('LockKdf', () => {
    afterEach(() => {
        delete NativeModules.LockKdf;
    });

    it('passes the secret and salt to the native module as hex', async () => {
        const native = jest.fn(() => Promise.resolve('00ff10'));
        NativeModules.LockKdf = { pbkdf2Sha256: native };

        const key = await pbkdf2Sha256(
            Buffer.from('pä', 'utf8'),
            Buffer.from([1, 2]),
            100000,
            32
        );

        expect(native).toHaveBeenCalledWith('70c3a4', '0102', 100000, 32);
        expect(key).toEqual(Buffer.from([0x00, 0xff, 0x10]));
    });

    it('rejects when the native module is missing', async () => {
        await expect(
            pbkdf2Sha256(Buffer.from('1234'), Buffer.from('aa'), 1, 32)
        ).rejects.toThrow('LockKdf native module unavailable');
    });

    it('passes a native rejection through', async () => {
        NativeModules.LockKdf = {
            pbkdf2Sha256: () =>
                Promise.reject(new Error('Invalid PBKDF2 parameters'))
        };

        await expect(
            pbkdf2Sha256(Buffer.from('1234'), Buffer.from('aa'), 0, 32)
        ).rejects.toThrow('Invalid PBKDF2 parameters');
    });
});
