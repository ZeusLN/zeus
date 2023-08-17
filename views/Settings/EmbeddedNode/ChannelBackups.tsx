import * as React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import Clipboard from '@react-native-clipboard/clipboard';
import * as base64 from 'base64-js';
import EncryptedStorage from 'react-native-encrypted-storage';

import Button from '../../../components/Button';
import Screen from '../../../components/Screen';
import Header from '../../../components/Header';

import SettingsStore from '../../../stores/SettingsStore';

import { localeString } from '../../../utils/LocaleUtils';
import { themeColor } from '../../../utils/ThemeUtils';
import Switch from '../../../components/Switch';

import { exportAllChannelBackups } from '../../../lndmobile/channel';
import stores from '../../../stores/Stores';
import KeyValue from '../../../components/KeyValue';

interface ChannelBackupsProps {
    navigation: any;
    SettingsStore: SettingsStore;
}

interface ChannelBackupsState {
    automaticChannelBackups: boolean | undefined;
    channelBackupCopied: boolean | undefined;
    channelBackupRecovered: boolean | undefined;
    channelBackupRecoveredError: boolean | undefined;
    channelBackupRecoveredErrorMessage: string;
    channelBackupOlympus: boolean | undefined;
    channelBackupOlympusError: boolean | undefined;
    lastChannelBackupStatus: string;
    lastChannelBackupTime: string;
}

@inject('SettingsStore')
@observer
export default class ChannelBackups extends React.Component<
    ChannelBackupsProps,
    ChannelBackupsState
> {
    state = {
        automaticChannelBackups: true,
        channelBackupCopied: false,
        channelBackupRecovered: false,
        channelBackupRecoveredError: false,
        channelBackupRecoveredErrorMessage: '',
        channelBackupOlympus: false,
        channelBackupOlympusError: false,
        lastChannelBackupStatus: '',
        lastChannelBackupTime: ''
    };

    UNSAFE_componentWillMount() {
        const { SettingsStore } = this.props;
        const { settings } = SettingsStore;

        this.setState({
            automaticChannelBackups: settings.automaticChannelBackups
        });

        this.getLastBackupStatus();
    }

    getLastBackupStatus = async () => {
        const lastChannelBackupStatus =
            (await EncryptedStorage.getItem('LAST_CHANNEL_BACKUP_STATUS')) ||
            '';
        const lastChannelBackupTime =
            (await EncryptedStorage.getItem('LAST_CHANNEL_BACKUP_TIME')) || '';

        this.setState({
            lastChannelBackupStatus,
            lastChannelBackupTime
        });
    };

    render() {
        const { navigation, SettingsStore } = this.props;
        const {
            automaticChannelBackups,
            channelBackupCopied,
            channelBackupOlympus,
            channelBackupOlympusError,
            channelBackupRecovered,
            channelBackupRecoveredError,
            channelBackupRecoveredErrorMessage,
            lastChannelBackupStatus,
            lastChannelBackupTime
        } = this.state;
        const { updateSettings }: any = SettingsStore;

        const setChannelBackupRecoveredError = () => {
            this.setState({
                channelBackupRecoveredError: true
            });

            setTimeout(() => {
                this.setState({
                    channelBackupRecoveredError: false
                });
            }, 5000);
        };

        const setChannelBackupRecoveredErrorMessage = (error: string) => {
            this.setState({
                channelBackupRecoveredErrorMessage: error
            });

            setTimeout(() => {
                this.setState({
                    channelBackupRecoveredErrorMessage: ''
                });
            }, 5000);
        };

        return (
            <Screen>
                <View style={{ flex: 1 }}>
                    <Header
                        leftComponent="Back"
                        centerComponent={{
                            text: localeString(
                                'views.Settings.EmbeddedNode.ChannelBackups.title'
                            ),
                            style: {
                                color: themeColor('text'),
                                fontFamily: 'Lato-Regular'
                            }
                        }}
                        navigation={navigation}
                    />
                    <ScrollView>
                        <>
                            {lastChannelBackupStatus && (
                                <View style={{ margin: 10 }}>
                                    <KeyValue
                                        keyValue={localeString(
                                            'views.Settings.EmbeddedNode.ChannelBackups.lastStatus'
                                        )}
                                        value={
                                            lastChannelBackupStatus ===
                                            'SUCCESS'
                                                ? localeString(
                                                      'general.success'
                                                  )
                                                : localeString('general.error')
                                        }
                                        color={
                                            lastChannelBackupStatus ===
                                            'SUCCESS'
                                                ? 'green'
                                                : 'red'
                                        }
                                    />
                                    <KeyValue
                                        keyValue={localeString(
                                            'views.Settings.EmbeddedNode.ChannelBackups.lastTime'
                                        )}
                                        value={lastChannelBackupTime}
                                    />
                                </View>
                            )}
                            <ListItem
                                containerStyle={{
                                    borderBottomWidth: 0,
                                    backgroundColor: 'transparent'
                                }}
                            >
                                <ListItem.Title
                                    style={{
                                        color: themeColor('secondaryText'),
                                        fontFamily: 'Lato-Regular'
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.EmbeddedNode.automaticChannelBackups'
                                    )}
                                </ListItem.Title>
                                <View
                                    style={{
                                        flex: 1,
                                        flexDirection: 'row',
                                        justifyContent: 'flex-end'
                                    }}
                                >
                                    <Switch
                                        value={automaticChannelBackups}
                                        onValueChange={async () => {
                                            this.setState({
                                                automaticChannelBackups:
                                                    !automaticChannelBackups
                                            });
                                            await updateSettings({
                                                automaticChannelBackups:
                                                    !automaticChannelBackups
                                            });
                                        }}
                                    />
                                </View>
                            </ListItem>
                            <View
                                style={{
                                    margin: 10
                                }}
                            >
                                <Text
                                    style={{
                                        color: themeColor('secondaryText')
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.EmbeddedNode.automaticChannelBackups.subtitle'
                                    )}
                                </Text>
                            </View>
                        </>
                        <>
                            <View style={{ margin: 10 }}>
                                <Button
                                    title={
                                        channelBackupCopied
                                            ? localeString(
                                                  'components.CopyButton.copied'
                                              )
                                            : localeString(
                                                  'views.Settings.EmbeddedNode.exportAllChannelBackups'
                                              )
                                    }
                                    onPress={async () => {
                                        try {
                                            const backup: any =
                                                await exportAllChannelBackups();
                                            if (backup) {
                                                if (
                                                    backup?.multi_chan_backup
                                                        ?.multi_chan_backup
                                                ) {
                                                    const multi =
                                                        backup.multi_chan_backup
                                                            .multi_chan_backup;
                                                    const multiString =
                                                        base64.fromByteArray(
                                                            multi
                                                        );

                                                    Clipboard.setString(
                                                        multiString
                                                    );

                                                    this.setState({
                                                        channelBackupCopied:
                                                            true
                                                    });

                                                    setTimeout(() => {
                                                        this.setState({
                                                            channelBackupCopied:
                                                                false
                                                        });
                                                    }, 5000);
                                                }
                                            }
                                        } catch (e) {
                                            console.log(
                                                'Error on exportAllChannelBackups:',
                                                e
                                            );
                                        }
                                    }}
                                />
                            </View>
                            <View
                                style={{
                                    margin: 10
                                }}
                            >
                                <Text
                                    style={{
                                        color: themeColor('secondaryText')
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.EmbeddedNode.exportAllChannelBackups.subtitle1'
                                    )}
                                </Text>
                            </View>
                            <View
                                style={{
                                    margin: 10
                                }}
                            >
                                <Text
                                    style={{
                                        color: themeColor('secondaryText')
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.EmbeddedNode.exportAllChannelBackups.subtitle2'
                                    )}
                                </Text>
                            </View>
                        </>
                        <>
                            <View style={{ margin: 10 }}>
                                <Button
                                    title={
                                        channelBackupOlympusError
                                            ? localeString('general.error')
                                            : channelBackupOlympus
                                            ? localeString('general.success')
                                            : localeString(
                                                  'views.Settings.EmbeddedNode.exportAllChannelBackupsOlympus'
                                              )
                                    }
                                    onPress={async () => {
                                        try {
                                            await stores.channelBackupStore.backupChannels();

                                            this.setState({
                                                channelBackupOlympus: true
                                            });

                                            setTimeout(() => {
                                                this.setState({
                                                    channelBackupOlympus: false
                                                });
                                            }, 5000);

                                            this.getLastBackupStatus();
                                        } catch (e) {
                                            this.setState({
                                                channelBackupOlympusError: true
                                            });

                                            setTimeout(() => {
                                                this.setState({
                                                    channelBackupOlympusError:
                                                        false
                                                });
                                            }, 5000);

                                            this.getLastBackupStatus();
                                        }
                                    }}
                                />
                            </View>
                            <View
                                style={{
                                    margin: 10
                                }}
                            >
                                <Text
                                    style={{
                                        color: themeColor('secondaryText')
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.EmbeddedNode.exportAllChannelBackupsOlympus.subtitle'
                                    )}
                                </Text>
                            </View>
                        </>
                        <>
                            <View style={{ margin: 10 }}>
                                <Button
                                    title={
                                        channelBackupRecoveredErrorMessage
                                            ? channelBackupRecoveredErrorMessage
                                            : channelBackupRecoveredError
                                            ? localeString('general.error')
                                            : channelBackupRecovered
                                            ? localeString('general.success')
                                            : localeString(
                                                  'views.Settings.EmbeddedNode.recoverChannelBackupsOlympus'
                                              )
                                    }
                                    onPress={async () => {
                                        try {
                                            const { backup, created_at }: any =
                                                await stores.channelBackupStore.recoverStaticChannelBackup();
                                            if (backup && created_at) {
                                                this.setState({
                                                    channelBackupRecovered: true
                                                });

                                                setTimeout(() => {
                                                    this.setState({
                                                        channelBackupRecovered:
                                                            false
                                                    });
                                                }, 5000);
                                            } else {
                                                setChannelBackupRecoveredError();
                                            }
                                        } catch (e) {
                                            setChannelBackupRecoveredErrorMessage(
                                                e
                                            );
                                        }
                                    }}
                                    containerStyle={{
                                        borderColor: themeColor('delete')
                                    }}
                                    titleStyle={{
                                        color: themeColor('delete')
                                    }}
                                    secondary
                                />
                            </View>
                            <View
                                style={{
                                    margin: 10
                                }}
                            >
                                <Text
                                    style={{
                                        color: themeColor('secondaryText')
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.EmbeddedNode.recoverChannelBackupsOlympus.subtitle1'
                                    )}
                                </Text>
                            </View>
                            <View
                                style={{
                                    margin: 10
                                }}
                            >
                                <Text
                                    style={{
                                        color: themeColor('secondaryText')
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.EmbeddedNode.recoverChannelBackupsOlympus.subtitle2'
                                    )}
                                </Text>
                            </View>
                        </>
                    </ScrollView>
                </View>
            </Screen>
        );
    }
}
