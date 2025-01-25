import * as Keychain from 'react-native-keychain';

class Storage {
    getItem = async (key: string) => {
        const response: any = await Keychain.getInternetCredentials(key);
        if (response.password) {
            return response.password;
        }
        return false;
    };

    setItem = async (key: string, value: any) => {
        const response = await Keychain.setInternetCredentials(
            key,
            key,
            typeof value === 'string' ? value : JSON.stringify(value)
        );
        return response;
    };

    removeItem = async (key: string) => {
        const response = await Keychain.resetInternetCredentials(key);
        return response;
    };
}

const storage = new Storage();
export default storage;
