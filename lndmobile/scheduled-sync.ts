import { NativeModules } from 'react-native';
import { WorkInfo } from './LndMobile';
const { LndMobileScheduledSync } = NativeModules;

export const checkScheduledSyncWorkStatus = async (): Promise<WorkInfo> => {
    return await LndMobileScheduledSync.checkScheduledSyncWorkStatus();
};
