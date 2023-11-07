import * as React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import Clipboard from '@react-native-clipboard/clipboard';
import EncryptedStorage from 'react-native-encrypted-storage';

import Button from '../../../components/Button';
import Screen from '../../../components/Screen';
import Header from '../../../components/Header';
import Switch from '../../../components/Switch';
import KeyValue from '../../../components/KeyValue';

import SettingsStore from '../../../stores/SettingsStore';
import stores from '../../../stores/Stores';

import { localeString } from '../../../utils/LocaleUtils';
import { themeColor } from '../../../utils/ThemeUtils';
import Base64Utils from '../../../utils/Base64Utils';

import { exportAllChannelBackups } from '../../../lndmobile/channel';

interface DisasterRecoveryProps {
    navigation: any;
    SettingsStore: SettingsStore;
}

interface DisasterRecoveryState {
    automaticDisasterRecoveryBackup: boolean | undefined;
    disasterRecoveryCopied: boolean | undefined;
    disasterRecoveryFileRecovered: boolean | undefined;
    disasterRecoveryFileRecoveredError: boolean | undefined;
    disasterRecoveryFileRecoveredErrorMessage: string;
    disasterRecoveryBackupOlympus: boolean | undefined;
    disasterRecoveryBackupOlympusError: boolean | undefined;
    lastDisasterRecoveryBackupStatus: string;
    lastDisasterRecoveryBackupTime: string;
}

@inject('SettingsStore')
@observer
export default class DisasterRecovery extends React.Component<
    DisasterRecoveryProps,
    DisasterRecoveryState
> {
    state = {
        automaticDisasterRecoveryBackup: true,
        disasterRecoveryCopied: false,
        disasterRecoveryFileRecovered: false,
        disasterRecoveryFileRecoveredError: false,
        disasterRecoveryFileRecoveredErrorMessage: '',
        disasterRecoveryBackupOlympus: false,
        disasterRecoveryBackupOlympusError: false,
        lastDisasterRecoveryBackupStatus: '',
        lastDisasterRecoveryBackupTime: ''
    };

    UNSAFE_componentWillMount() {
        const { SettingsStore } = this.props;
        const { settings } = SettingsStore;

        this.setState({
            automaticDisasterRecoveryBackup:
                settings.automaticDisasterRecoveryBackup
        });

        this.getLastBackupStatus();
    }

    getLastBackupStatus = async () => {
        const lastDisasterRecoveryBackupStatus =
            (await EncryptedStorage.getItem('LAST_CHANNEL_BACKUP_STATUS')) ||
            '';
        const lastDisasterRecoveryBackupTime =
            (await EncryptedStorage.getItem('LAST_CHANNEL_BACKUP_TIME')) || '';

        this.setState({
            lastDisasterRecoveryBackupStatus,
            lastDisasterRecoveryBackupTime
        });
    };

    render() {
        const { navigation, SettingsStore } = this.props;
        const {
            automaticDisasterRecoveryBackup,
            disasterRecoveryCopied,
            disasterRecoveryBackupOlympus,
            disasterRecoveryBackupOlympusError,
            disasterRecoveryFileRecovered,
            disasterRecoveryFileRecoveredError,
            disasterRecoveryFileRecoveredErrorMessage,
            lastDisasterRecoveryBackupStatus,
            lastDisasterRecoveryBackupTime
        } = this.state;
        const { updateSettings }: any = SettingsStore;

        const setChannelBackupRecoveredError = () => {
            this.setState({
                disasterRecoveryFileRecoveredError: true
            });

            setTimeout(() => {
                this.setState({
                    disasterRecoveryFileRecoveredError: false
                });
            }, 5000);
        };

        const setChannelBackupRecoveredErrorMessage = (error: string) => {
            this.setState({
                disasterRecoveryFileRecoveredErrorMessage: error
            });

            setTimeout(() => {
                this.setState({
                    disasterRecoveryFileRecoveredErrorMessage: ''
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
                                'views.Settings.EmbeddedNode.DisasterRecovery.title'
                            ),
                            style: {
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book'
                            }
                        }}
                        navigation={navigation}
                    />
                    <ScrollView>
                        <>
                            {lastDisasterRecoveryBackupStatus && (
                                <View style={{ margin: 10 }}>
                                    <KeyValue
                                        keyValue={localeString(
                                            'views.Settings.EmbeddedNode.DisasterRecovery.lastStatus'
                                        )}
                                        value={
                                            lastDisasterRecoveryBackupStatus ===
                                            'SUCCESS'
                                                ? localeString(
                                                      'general.success'
                                                  )
                                                : localeString('general.error')
                                        }
                                        color={
                                            lastDisasterRecoveryBackupStatus ===
                                            'SUCCESS'
                                                ? 'green'
                                                : 'red'
                                        }
                                    />
                                    <KeyValue
                                        keyValue={localeString(
                                            'views.Settings.EmbeddedNode.DisasterRecovery.lastTime'
                                        )}
                                        value={lastDisasterRecoveryBackupTime}
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
                                        fontFamily: 'PPNeueMontreal-Book'
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.EmbeddedNode.automaticDisasterRecoveryBackup'
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
                                        value={automaticDisasterRecoveryBackup}
                                        onValueChange={async () => {
                                            this.setState({
                                                automaticDisasterRecoveryBackup:
                                                    !automaticDisasterRecoveryBackup
                                            });
                                            await updateSettings({
                                                automaticDisasterRecoveryBackup:
                                                    !automaticDisasterRecoveryBackup
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
                                        'views.Settings.EmbeddedNode.automaticDisasterRecoveryBackup.subtitle'
                                    )}
                                </Text>
                            </View>
                        </>
                        <>
                            <View style={{ margin: 10 }}>
                                <Button
                                    title={
                                        disasterRecoveryCopied
                                            ? localeString(
                                                  'components.CopyButton.copied'
                                              )
                                            : localeString(
                                                  'views.Settings.EmbeddedNode.clipboardDisasterRecovery'
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
                                                        Base64Utils.bytesToBase64(
                                                            multi
                                                        );

                                                    Clipboard.setString(
                                                        multiString
                                                    );

                                                    this.setState({
                                                        disasterRecoveryCopied:
                                                            true
                                                    });

                                                    setTimeout(() => {
                                                        this.setState({
                                                            disasterRecoveryCopied:
                                                                false
                                                        });
                                                    }, 5000);
                                                }
                                            }
                                        } catch (e) {
                                            console.log(
                                                'Error on clipboardDisasterRecovery:',
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
                                        'views.Settings.EmbeddedNode.clipboardDisasterRecovery.subtitle1'
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
                                        'views.Settings.EmbeddedNode.clipboardDisasterRecovery.subtitle2'
                                    )}
                                </Text>
                            </View>
                        </>
                        <>
                            <View style={{ margin: 10 }}>
                                <Button
                                    title={
                                        disasterRecoveryBackupOlympusError
                                            ? localeString('general.error')
                                            : disasterRecoveryBackupOlympus
                                            ? localeString('general.success')
                                            : localeString(
                                                  'views.Settings.EmbeddedNode.exportDisasterRecoveryOlympus'
                                              )
                                    }
                                    onPress={async () => {
                                        try {
                                            await stores.channelBackupStore.backupChannels();

                                            this.setState({
                                                disasterRecoveryBackupOlympus:
                                                    true
                                            });

                                            setTimeout(() => {
                                                this.setState({
                                                    disasterRecoveryBackupOlympus:
                                                        false
                                                });
                                            }, 5000);

                                            this.getLastBackupStatus();
                                        } catch (e) {
                                            this.setState({
                                                disasterRecoveryBackupOlympusError:
                                                    true
                                            });

                                            setTimeout(() => {
                                                this.setState({
                                                    disasterRecoveryBackupOlympusError:
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
                                        'views.Settings.EmbeddedNode.exportDisasterRecoveryOlympus.subtitle'
                                    )}
                                </Text>
                            </View>
                        </>
                        <>
                            <View style={{ margin: 10 }}>
                                <Button
                                    title={
                                        disasterRecoveryFileRecoveredErrorMessage
                                            ? disasterRecoveryFileRecoveredErrorMessage
                                            : disasterRecoveryFileRecoveredError
                                            ? localeString('general.error')
                                            : disasterRecoveryFileRecovered
                                            ? localeString('general.success')
                                            : localeString(
                                                  'views.Settings.EmbeddedNode.initiateDisasterRecoveryOlympus'
                                              )
                                    }
                                    onPress={async () => {
                                        try {
                                            const { backup, created_at }: any =
                                                await stores.channelBackupStore.recoverStaticChannelBackup();
                                            if (backup && created_at) {
                                                this.setState({
                                                    disasterRecoveryFileRecovered:
                                                        true
                                                });

                                                setTimeout(() => {
                                                    this.setState({
                                                        disasterRecoveryFileRecovered:
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
                                        'views.Settings.EmbeddedNode.initiateDisasterRecoveryOlympus.subtitle1'
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
                                        'views.Settings.EmbeddedNode.initiateDisasterRecoveryOlympus.subtitle2'
                                    )}
                                </Text>
                            </View>
                        </>
                        <>
                            <View style={{ margin: 10 }}>
                                <Button
                                    title={localeString(
                                        'views.Settings.EmbeddedNode.initiateAdvancedDisasterRecoveryOlympus'
                                    )}
                                    onPress={() => {
                                        navigation.navigate(
                                            'DisasterRecoveryAdvanced'
                                        );
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
                                        'views.Settings.EmbeddedNode.initiateAdvancedDisasterRecoveryOlympus.subtitle'
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
                                        'views.Settings.EmbeddedNode.initiateDisasterRecoveryOlympus.subtitle2'
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
