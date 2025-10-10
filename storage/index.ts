import * as Keychain from 'react-native-keychain';

const cache: { [key: string]: any } = {};

class Storage {
    getItem = async (key: string) => {
        if (cache[key]) {
            return cache[key];
        }

        const response: any = await Keychain.getInternetCredentials(key);
        if (response.password) {
            cache[key] = response.password;
            return response.password;
        }
        return false;
    };

    setItem = async (key: string, value: any) => {
        const stringValue =
            typeof value === 'string' ? value : JSON.stringify(value);

        cache[key] = stringValue;

        const response = await Keychain.setInternetCredentials(
            key,
            key,
            stringValue,
            {
                cloudSync: false
            }
        );
        return response;
    };

    removeItem = async (key: string) => {
        delete cache[key];
        const response = await Keychain.resetInternetCredentials(key);
        return response;
    };
}

const storage = new Storage();
export default storage;
