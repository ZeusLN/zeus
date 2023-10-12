import { NativeModules } from 'react-native';
import type { WorkInfo } from './LndMobile.d.ts';
const { LndMobileScheduledSync } = NativeModules;

export const checkScheduledSyncWorkStatus = async (): Promise<WorkInfo> => {
    return await LndMobileScheduledSync.checkScheduledSyncWorkStatus();
};
