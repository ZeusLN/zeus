import { NativeModules } from 'react-native';
import { WorkInfo } from './LndMobile';
const { GossipFileScheduledSync } = NativeModules;

export const checkScheduledGossipSyncWorkStatus =
    async (): Promise<WorkInfo> => {
        return await GossipFileScheduledSync.checkScheduledSyncWorkStatus();
    };
