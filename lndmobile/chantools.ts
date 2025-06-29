import { NativeModules } from 'react-native';
const { LncModule } = NativeModules;

export const sweepRemoteClosed = async ({
    seed,
    apiUrl,
    sweepAddr,
    recoveryWindow,
    feeRate,
    sleepSeconds,
    publish,
    isTestNet
}: {
    seed: string;
    apiUrl: string;
    sweepAddr: string;
    recoveryWindow: number;
    feeRate: number;
    sleepSeconds: number;
    publish?: boolean;
    isTestNet?: boolean;
}): Promise<string> => {
    return await LncModule.sweepRemoteClosed(
        seed,
        apiUrl,
        sweepAddr,
        recoveryWindow,
        feeRate,
        sleepSeconds,
        publish,
        isTestNet
    );
};
