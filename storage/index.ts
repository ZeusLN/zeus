import * as Keychain from 'react-native-keychain';

const KEY_PREFIX = 'zeus:';

class Storage {
    private prefixKey = (key: string) => `${KEY_PREFIX}${key}`;

    getItem = async (key: string) => {
        const prefixedKey = this.prefixKey(key);
        const response: any = await Keychain.getInternetCredentials(
            prefixedKey,
            {
                cloudSync: false
            }
        );

        if (response && response.password) {
            return response.password;
        }
        return false;
    };

    setItem = async (key: string, value: any) => {
        const prefixedKey = this.prefixKey(key);
        const stringValue =
            typeof value === 'string' ? value : JSON.stringify(value);

        const response = await Keychain.setInternetCredentials(
            prefixedKey,
            prefixedKey,
            stringValue,
            {
                cloudSync: false
            }
        );
        return response;
    };

    removeItem = async (key: string) => {
        const prefixedKey = this.prefixKey(key);
        const response = await Keychain.resetInternetCredentials({
            server: prefixedKey,
            cloudSync: false
        });
        return response;
    };
}

const storage = new Storage();
export default storage;
