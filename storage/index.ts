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
            JSON.stringify(value)
        );
        return response;
    };
}

const storage = new Storage();
export default storage;
