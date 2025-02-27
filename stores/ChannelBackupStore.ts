import { action, observable, runInAction } from 'mobx';
import ReactNativeBlobUtil from 'react-native-blob-util';
import * as CryptoJS from 'crypto-js';

import NodeInfoStore from './NodeInfoStore';
import SettingsStore from './SettingsStore';

import lndMobile from '../lndmobile/LndMobileInjection';
const { channel } = lndMobile;
import {
    exportAllChannelBackups,
    restoreChannelBackups
} from '../lndmobile/channel';

import BackendUtils from '../utils/BackendUtils';
import { LndMobileEventEmitter } from '../utils/LndMobileUtils';
import Base64Utils from '../utils/Base64Utils';
import { errorToUserFriendly } from '../utils/ErrorUtils';

import Storage from '../storage';

const BACKUPS_HOST = 'https://backups.lnolymp.us';

export const LEGACY_LAST_CHANNEL_BACKUP_STATUS = 'LAST_CHANNEL_BACKUP_STATUS';
export const LEGACY_LAST_CHANNEL_BACKUP_TIME = 'LAST_CHANNEL_BACKUP_TIME';

export const LAST_CHANNEL_BACKUP_STATUS = 'zeus-last-channel-backup-status';
export const LAST_CHANNEL_BACKUP_TIME = 'zeus-last-channel-backup-time';

export default class ChannelBackupStore {
    @observable public channelEventsSubscription: any;
    @observable public backups: Array<any> = [];
    @observable public loading: boolean = false;
    @observable public error: boolean = false;
    @observable public error_msg: string;

    nodeInfoStore: NodeInfoStore;
    settingsStore: SettingsStore;

    constructor(nodeInfoStore: NodeInfoStore, settingsStore: SettingsStore) {
        this.nodeInfoStore = nodeInfoStore;
        this.settingsStore = settingsStore;
    }

    @action
    public reset = () => {
        this.channelEventsSubscription = null;
        this.error_msg = '';
        this.error = false;
        this.loading = false;
    };

    private logBackupStatus = async (status: string) => {
        await Storage.setItem(LAST_CHANNEL_BACKUP_STATUS, status);
        await Storage.setItem(LAST_CHANNEL_BACKUP_TIME, `${new Date()}`);
    };

    public backupChannels = async () => {
        const backup = await exportAllChannelBackups();
        if (!backup?.multi_chan_backup?.multi_chan_backup) {
            throw new Error();
        }
        const multi = backup.multi_chan_backup.multi_chan_backup;
        const multiString = Base64Utils.bytesToBase64(multi);

        const encryptedBackup = CryptoJS.AES.encrypt(
            multiString,
            this.settingsStore.seedPhrase.toString()
        ).toString();

        try {
            const authResponse = await ReactNativeBlobUtil.fetch(
                'POST',
                `${BACKUPS_HOST}/api/auth`,
                { 'Content-Type': 'application/json' },
                JSON.stringify({
                    pubkey: this.nodeInfoStore.nodeInfo.identity_pubkey
                })
            );

            if (authResponse.info().status !== 200) {
                this.logBackupStatus('ERROR');
                throw new Error();
            }

            const { verification } = authResponse.json();

            const messageSignData = await BackendUtils.signMessage(
                verification
            );
            const signature =
                messageSignData.zbase || messageSignData.signature;
            const backupResponse = await ReactNativeBlobUtil.fetch(
                'POST',
                `${BACKUPS_HOST}/api/backup`,
                { 'Content-Type': 'application/json' },
                JSON.stringify({
                    pubkey: this.nodeInfoStore.nodeInfo.identity_pubkey,
                    message: verification,
                    signature,
                    backup: encryptedBackup
                })
            );
            if (
                backupResponse.info().status === 200 &&
                backupResponse.json().success
            ) {
                // log success timestamp
                this.logBackupStatus('SUCCESS');
                return true;
            }

            this.logBackupStatus('ERROR');
            throw new Error();
        } catch {
            this.logBackupStatus('ERROR');
            throw new Error();
        }
    };

    public recoverStaticChannelBackup = async () => {
        const authResponse = await ReactNativeBlobUtil.fetch(
            'POST',
            `${BACKUPS_HOST}/api/auth`,
            { 'Content-Type': 'application/json' },
            JSON.stringify({
                pubkey: this.nodeInfoStore.nodeInfo.identity_pubkey
            })
        );
        const authResponseStatus = authResponse.info().status;
        if (authResponseStatus !== 200) {
            throw new Error(`Auth response status code: ${authResponseStatus}`);
        }
        const { verification } = authResponse.json();

        const messageSignData = await BackendUtils.signMessage(verification);
        const signature = messageSignData.zbase || messageSignData.signature;
        const recoverResponse = await ReactNativeBlobUtil.fetch(
            'POST',
            `${BACKUPS_HOST}/api/recover`,
            { 'Content-Type': 'application/json' },
            JSON.stringify({
                pubkey: this.nodeInfoStore.nodeInfo.identity_pubkey,
                message: verification,
                signature
            })
        );
        const data = recoverResponse.json();
        const { backup, created_at, success } = data;
        if (recoverResponse.info().status === 200 && success && backup) {
            await this.triggerRecovery(backup);
            return { backup, created_at };
        } else {
            throw new Error(data.error);
        }
    };

    @action
    public triggerRecovery = async (backup: string): Promise<void> => {
        this.error_msg = '';
        this.loading = true;

        try {
            const decryptedBytes = CryptoJS.AES.decrypt(
                backup,
                this.settingsStore.seedPhrase.toString()
            );
            const decryptedString = decryptedBytes.toString(CryptoJS.enc.Utf8);

            await restoreChannelBackups(decryptedString);

            runInAction(() => {
                this.error_msg = '';
                this.loading = false;
            });
        } catch (e: any) {
            runInAction(() => {
                this.error_msg = errorToUserFriendly(e);
                this.loading = false;
            });

            throw new Error(this.error_msg);
        }
    };

    @action
    public advancedRecoveryList = async () => {
        this.loading = true;
        this.error = false;
        this.backups = [];
        try {
            const authResponse = await ReactNativeBlobUtil.fetch(
                'POST',
                `${BACKUPS_HOST}/api/auth`,
                { 'Content-Type': 'application/json' },
                JSON.stringify({
                    pubkey: this.nodeInfoStore.nodeInfo.identity_pubkey
                })
            );
            const authResponseStatus = authResponse.info().status;
            if (authResponseStatus !== 200) {
                throw new Error(
                    `Auth response status code: ${authResponseStatus}`
                );
            }
            const { verification } = authResponse.json();

            const messageSignData = await BackendUtils.signMessage(
                verification
            );
            const signature =
                messageSignData.zbase || messageSignData.signature;
            const recoverResponse = await ReactNativeBlobUtil.fetch(
                'POST',
                `${BACKUPS_HOST}/api/recoverAdvanced`,
                { 'Content-Type': 'application/json' },
                JSON.stringify({
                    pubkey: this.nodeInfoStore.nodeInfo.identity_pubkey,
                    message: verification,
                    signature
                })
            );
            const data = recoverResponse.json();
            const { backups } = data;
            if (recoverResponse.info().status === 200 && backups) {
                runInAction(() => {
                    this.backups = backups;
                    this.loading = false;
                });
                return backups;
            }

            throw new Error(data.error);
        } catch (error) {
            runInAction(() => {
                this.error = true;
                this.loading = false;
            });
            throw error;
        }
    };

    public initSubscribeChannelEvents = async () => {
        // Check if latest channel backup status is success
        // or if it's over three days ago and trigger backup
        const status = await Storage.getItem(LAST_CHANNEL_BACKUP_STATUS);
        const time = await Storage.getItem(LAST_CHANNEL_BACKUP_TIME);
        if (
            (status && status === 'ERROR') ||
            (time && this.isOlderThanThreeDays(time)) ||
            (!time && !status)
        ) {
            this.backupChannels();
        }
        if (this.channelEventsSubscription?.remove)
            this.channelEventsSubscription.remove();
        this.channelEventsSubscription = LndMobileEventEmitter.addListener(
            'SubscribeChannelEvents',
            async (event: any) => {
                try {
                    const channelEvent = channel.decodeChannelEvent(event.data);
                    if (
                        channelEvent.open_channel ||
                        channelEvent.closed_channel
                    ) {
                        this.backupChannels();
                    }
                } catch (error: any) {
                    console.error(
                        'subscribe channel backups error: ' + error.message
                    );
                }
            }
        );

        await channel.subscribeChannelEvents();
    };

    private isOlderThanThreeDays(time: string) {
        const ONE_HOUR = 60 * 60 * 1000; /* ms */
        const THREE_DAYS = 36 * ONE_HOUR;
        return Number(new Date()) - Number(new Date(time)) > THREE_DAYS;
    }
}
