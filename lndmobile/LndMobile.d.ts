export enum ELndMobileStatusCodes {
    STATUS_SERVICE_BOUND = 1,
    STATUS_PROCESS_STARTED = 2,
    STATUS_WALLET_UNLOCKED = 4
}

export interface ILndMobile {
    // General
    initialize(): Promise<{ data: string }>;
    startLnd(args: string): Promise<{ data: string }>;
    stopLnd(): Promise<{ data: string }>;
    initWallet(
        seed: string[],
        password: string,
        recoveryWindow: number,
        channelBackupsBase64: string | null
    ): Promise<{ data: string }>;
    unlockWallet(password: string): Promise<{ data: string }>;

    checkStatus(): Promise<ELndMobileStatusCodes>;

    // Send gRPC LND API request
    sendCommand(
        method: string,
        base64Payload: string
    ): Promise<{ data: string }>;
    sendStreamCommand(
        method: string,
        base64Payload: string,
        streamOnlyOnce: boolean
    ): Promise<'done'>;
    sendBidiStreamCommand(
        method: string,
        streamOnlyOnce: boolean
    ): Promise<'done'>;
    writeToStream(method: string, payload: string): Promise<boolean>;

    // Android-specific
    unbindLndMobileService(): Promise<void>; // TODO(hsjoberg): function looks broken
    sendPongToLndMobileservice(): Promise<{ data: string }>;
    checkLndMobileServiceConnected(): Promise<boolean>;
    gossipSync(networkType: string): Promise<{ data: string }>;
}

export interface ILndMobileTools {
    writeConfig(data: string): Promise<string>;
    killLnd(): Promise<boolean>;
    log(level: 'v' | 'd' | 'i' | 'w' | 'e', tag: string, msg: string): void;
    saveLogs(): Promise<string>;
    copyLndLog(network: string): Promise<boolean>;
    tailLog(numberOfLines: number, network: string): Promise<string>;
    observeLndLogFile(network: string): Promise<boolean>;
    saveChannelsBackup(base64Backups: string): Promise<string>;
    saveChannelBackupFile(network: string): Promise<boolean>;
    DEBUG_getWalletPasswordFromKeychain(): Promise<string>;
    DEBUG_deleteSpeedloaderLastrunFile(): boolean;
    DEBUG_deleteSpeedloaderDgraphDirectory(): null;

    // Android-specific
    getIntentStringData(): Promise<string | null>;
    getIntentNfcData(): Promise<string | null>;
    DEBUG_deleteWallet(network: string): Promise<boolean>;
    DEBUG_deleteDatafolder(): Promise<null>;
    DEBUG_listProcesses(): Promise<string>;
    checkLndProcessExist(): Promise<boolean>;
    deleteTLSCerts(): Promise<boolean>;
    restartApp(): void;

    // iOS-specific
    checkICloudEnabled(): Promise<boolean>;
    checkApplicationSupportExists(): Promise<boolean>;
    checkLndFolderExists(): Promise<boolean>;
    createIOSApplicationSupportAndLndDirectories(): Promise<boolean>;
    excludeLndICloudBackup(): Promise<boolean>;
    TEMP_moveLndToApplicationSupport(): Promise<boolean>;

    // macOS-specific
    macosOpenFileDialog(): Promise<string | undefined>;
}

export type WorkInfo =
    | 'BLOCKED'
    | 'CANCELLED'
    | 'ENQUEUED'
    | 'FAILED'
    | 'RUNNING'
    | 'SUCCEEDED'
    | 'WORK_NOT_EXIST';

export interface ILndMobileScheduledSync {
    setupScheduledSyncWork: () => Promise<boolean>;
    removeScheduledSyncWork: () => Promise<boolean>;
    checkScheduledSyncWorkStatus: () => Promise<WorkInfo>;
}

export interface IGossipFileScheduledSync {
    setupScheduledSyncWork: () => Promise<boolean>;
    removeScheduledSyncWork: () => Promise<boolean>;
    checkScheduledSyncWorkStatus: () => Promise<WorkInfo>;
}

declare module 'react-native' {
    interface NativeModulesStatic {
        LndMobile: ILndMobile;
        LndMobileTools: ILndMobileTools;
        LndMobileScheduledSync: ILndMobileScheduledSync;
        GossipFileScheduledSync: IGossipFileScheduledSync;
    }
}
