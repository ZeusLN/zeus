import { NativeModules } from 'react-native';
const { TorMobile } = NativeModules;

interface TorMobileInterface {
    start: () => Promise<boolean>;
    restart: () => Promise<boolean>;
    stop: () => Promise<boolean>;
    getTorStatus: () => string;
    sendRequest: (
        action: string,
        url: string,
        headers: string,
        body: string
    ) => Promise<string>;
}

export default TorMobile as TorMobileInterface;
