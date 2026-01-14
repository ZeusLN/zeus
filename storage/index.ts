import * as Keychain from 'react-native-keychain';

class Storage {
    getItem = async (key: string) => {
        const response: any = await Keychain.getInternetCredentials(key, {
            cloudSync: false
        });

        if (response && response.password) {
            return response.password;
        }
        return false;
    };

    setItem = async (key: string, value: any) => {
        const stringValue =
            typeof value === 'string' ? value : JSON.stringify(value);

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
        const response = await Keychain.resetInternetCredentials({
            server: key,
            cloudSync: false
        });
        return response;
    };
}

const storage = new Storage();
export default storage;
