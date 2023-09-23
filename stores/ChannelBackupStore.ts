import { action, observable } from 'mobx';
import ReactNativeBlobUtil from 'react-native-blob-util';
import EncryptedStorage from 'react-native-encrypted-storage';
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

const BACKUPS_HOST = 'https://backups.lnolymp.us';

export default class ChannelBackupStore {
    @observable public channelEventsSubscription: any;

    nodeInfoStore: NodeInfoStore;
    settingsStore: SettingsStore;

    constructor(nodeInfoStore: NodeInfoStore, settingsStore: SettingsStore) {
        this.nodeInfoStore = nodeInfoStore;
        this.settingsStore = settingsStore;
    }

    @action
    public reset = () => {
        this.channelEventsSubscription = null;
    };

    logBackupStatus = async (status: string) => {
        await EncryptedStorage.setItem('LAST_CHANNEL_BACKUP_STATUS', status);
        await EncryptedStorage.setItem(
            'LAST_CHANNEL_BACKUP_TIME',
            `${new Date()}`
        );
    };

    @action
    public backupChannels = async () => {
        return new Promise(async (resolve, reject) => {
            const backup: any = await exportAllChannelBackups();
            if (backup) {
                if (backup?.multi_chan_backup?.multi_chan_backup) {
                    const multi = backup.multi_chan_backup.multi_chan_backup;
                    const multiString = Base64Utils.bytesToBase64(multi);

                    const encryptedBackup = CryptoJS.AES.encrypt(
                        multiString,
                        this.settingsStore.seedPhrase.toString()
                    ).toString();

                    ReactNativeBlobUtil.fetch(
                        'POST',
                        `${BACKUPS_HOST}/api/auth`,
                        {
                            'Content-Type': 'application/json'
                        },
                        JSON.stringify({
                            pubkey: this.nodeInfoStore.nodeInfo.identity_pubkey
                        })
                    )
                        .then((response: any) => {
                            const status = response.info().status;
                            if (status == 200) {
                                const data = response.json();
                                const { verification } = data;

                                BackendUtils.signMessage(verification)
                                    .then((data: any) => {
                                        const signature =
                                            data.zbase || data.signature;
                                        ReactNativeBlobUtil.fetch(
                                            'POST',
                                            `${BACKUPS_HOST}/api/backup`,
                                            {
                                                'Content-Type':
                                                    'application/json'
                                            },
                                            JSON.stringify({
                                                pubkey: this.nodeInfoStore
                                                    .nodeInfo.identity_pubkey,
                                                message: verification,
                                                signature,
                                                backup: encryptedBackup
                                            })
                                        )
                                            .then((response: any) => {
                                                const data = response.json();
                                                if (
                                                    status === 200 &&
                                                    data.success
                                                ) {
                                                    // log success timestamp
                                                    this.logBackupStatus(
                                                        'SUCCESS'
                                                    );
                                                    resolve(true);
                                                } else {
                                                    this.logBackupStatus(
                                                        'ERROR'
                                                    );
                                                    reject();
                                                }
                                            })
                                            .catch(() => {
                                                this.logBackupStatus('ERROR');
                                                reject();
                                            });
                                    })
                                    .catch(() => {
                                        this.logBackupStatus('ERROR');
                                        reject();
                                    });
                            }
                        })
                        .catch(() => {
                            this.logBackupStatus('ERROR');
                            reject();
                        });
                }
            }
        });
    };

    @action
    public recoverStaticChannelBackup = async () => {
        return new Promise((resolve, reject) => {
            ReactNativeBlobUtil.fetch(
                'POST',
                `${BACKUPS_HOST}/api/auth`,
                {
                    'Content-Type': 'application/json'
                },
                JSON.stringify({
                    pubkey: this.nodeInfoStore.nodeInfo.identity_pubkey
                })
            ).then((response: any) => {
                const status = response.info().status;
                if (status == 200) {
                    const data = response.json();
                    const { verification } = data;

                    BackendUtils.signMessage(verification)
                        .then((data: any) => {
                            const signature = data.zbase || data.signature;
                            ReactNativeBlobUtil.fetch(
                                'POST',
                                `${BACKUPS_HOST}/api/recover`,
                                {
                                    'Content-Type': 'application/json'
                                },
                                JSON.stringify({
                                    pubkey: this.nodeInfoStore.nodeInfo
                                        .identity_pubkey,
                                    message: verification,
                                    signature
                                })
                            )
                                .then(async (response: any) => {
                                    const data = response.json();
                                    const { backup, created_at, success } =
                                        data;
                                    if (status === 200 && success && backup) {
                                        const decryptedBytes =
                                            CryptoJS.AES.decrypt(
                                                backup,
                                                this.settingsStore.seedPhrase.toString()
                                            );
                                        const decryptedString =
                                            decryptedBytes.toString(
                                                CryptoJS.enc.Utf8
                                            );

                                        await restoreChannelBackups(
                                            decryptedString
                                        );
                                        resolve({
                                            backup: decryptedString,
                                            created_at
                                        });
                                    } else {
                                        reject(data.error);
                                    }
                                })
                                .catch((error: any) => {
                                    reject(error);
                                });
                        })
                        .catch((error: any) => {
                            reject(error);
                        });
                }
            });
        });
    };

    @action
    public initSubscribeChannelEvents = async () => {
        // Check if latest channel backup status is success
        // or if it's over three days ago and trigger backup
        const status = await EncryptedStorage.getItem(
            'LAST_CHANNEL_BACKUP_STATUS'
        );
        const time = await EncryptedStorage.getItem('LAST_CHANNEL_BACKUP_TIME');
        if (status && status === 'ERROR') this.backupChannels();
        if (time) {
            const ONE_HOUR = 60 * 60 * 1000; /* ms */
            const THREE_DAYS = 36 * ONE_HOUR;
            const olderThanThreeDays = new Date() - new Date(time) > THREE_DAYS;
            if (olderThanThreeDays) this.backupChannels();
        }
        if (!time && !status) this.backupChannels();
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
}
