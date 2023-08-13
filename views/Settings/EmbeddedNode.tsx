import * as React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import Clipboard from '@react-native-clipboard/clipboard';
import * as base64 from 'base64-js';

import Button from '../../components/Button';
import Screen from '../../components/Screen';
import Header from '../../components/Header';

import SettingsStore from '../../stores/SettingsStore';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import Switch from '../../components/Switch';

import { resetMissionControl } from '../../lndmobile';
import { exportAllChannelBackups } from '../../lndmobile/channel';

interface EmbeddedNodeProps {
    navigation: any;
    SettingsStore: SettingsStore;
}

interface EmbeddedNodeState {
    expressGraphSync: boolean | undefined;
    expressGraphSyncMobile: boolean | undefined;
    resetExpressGraphSyncOnStartup: boolean | undefined;
    bimodalPathfinding: boolean | undefined;
    rescan: boolean | undefined;
    resetMissionControlSuccess: boolean | undefined;
    channelBackupCopied: boolean | undefined;
}

@inject('SettingsStore')
@observer
export default class EmbeddedNode extends React.Component<
    EmbeddedNodeProps,
    EmbeddedNodeState
> {
    state = {
        expressGraphSync: false,
        expressGraphSyncMobile: false,
        resetExpressGraphSyncOnStartup: false,
        bimodalPathfinding: false,
        resetMissionControlSuccess: false,
        channelBackupCopied: false,
        rescan: false
    };

    async UNSAFE_componentWillMount() {
        const { SettingsStore } = this.props;
        const { settings } = SettingsStore;

        this.setState({
            expressGraphSync: settings.expressGraphSync,
            expressGraphSyncMobile: settings.expressGraphSyncMobile,
            resetExpressGraphSyncOnStartup:
                settings.resetExpressGraphSyncOnStartup,
            bimodalPathfinding: settings.bimodalPathfinding,
            rescan: settings.rescan
        });
    }

    render() {
        const { navigation, SettingsStore } = this.props;
        const {
            expressGraphSync,
            expressGraphSyncMobile,
            resetExpressGraphSyncOnStartup,
            bimodalPathfinding,
            resetMissionControlSuccess,
            channelBackupCopied,
            rescan
        } = this.state;
        const { updateSettings, embeddedLndNetwork }: any = SettingsStore;

        return (
            <Screen>
                <View style={{ flex: 1 }}>
                    <Header
                        leftComponent="Back"
                        centerComponent={{
                            text: localeString(
                                'views.Settings.EmbeddedNode.title'
                            ),
                            style: {
                                color: themeColor('text'),
                                fontFamily: 'Lato-Regular'
                            }
                        }}
                        navigation={navigation}
                    />
                    <ScrollView>
                        {embeddedLndNetwork === 'Mainnet' && (
                            <>
                                <>
                                    <ListItem
                                        containerStyle={{
                                            borderBottomWidth: 0,
                                            backgroundColor: 'transparent'
                                        }}
                                    >
                                        <ListItem.Title
                                            style={{
                                                color: themeColor(
                                                    'secondaryText'
                                                ),
                                                fontFamily: 'Lato-Regular'
                                            }}
                                        >
                                            {localeString(
                                                'views.Settings.EmbeddedNode.expressGraphSync'
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
                                                value={expressGraphSync}
                                                onValueChange={async () => {
                                                    this.setState({
                                                        expressGraphSync:
                                                            !expressGraphSync
                                                    });
                                                    await updateSettings({
                                                        expressGraphSync:
                                                            !expressGraphSync
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
                                                color: themeColor(
                                                    'secondaryText'
                                                )
                                            }}
                                        >
                                            {localeString(
                                                'views.Settings.EmbeddedNode.expressGraphSync.subtitle'
                                            )}
                                        </Text>
                                    </View>
                                </>
                                <>
                                    <ListItem
                                        containerStyle={{
                                            borderBottomWidth: 0,
                                            backgroundColor: 'transparent'
                                        }}
                                    >
                                        <ListItem.Title
                                            style={{
                                                color: themeColor(
                                                    'secondaryText'
                                                ),
                                                fontFamily: 'Lato-Regular'
                                            }}
                                        >
                                            {localeString(
                                                'views.Settings.EmbeddedNode.expressGraphSyncMobile'
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
                                                value={expressGraphSyncMobile}
                                                onValueChange={async () => {
                                                    this.setState({
                                                        expressGraphSyncMobile:
                                                            !expressGraphSyncMobile
                                                    });
                                                    await updateSettings({
                                                        expressGraphSyncMobile:
                                                            !expressGraphSyncMobile
                                                    });
                                                }}
                                                disabled={!expressGraphSync}
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
                                                color: themeColor(
                                                    'secondaryText'
                                                )
                                            }}
                                        >
                                            {localeString(
                                                'views.Settings.EmbeddedNode.expressGraphSyncMobile.subtitle'
                                            )}
                                        </Text>
                                    </View>
                                </>
                                <>
                                    <ListItem
                                        containerStyle={{
                                            borderBottomWidth: 0,
                                            backgroundColor: 'transparent'
                                        }}
                                    >
                                        <ListItem.Title
                                            style={{
                                                color: themeColor(
                                                    'secondaryText'
                                                ),
                                                fontFamily: 'Lato-Regular'
                                            }}
                                        >
                                            {localeString(
                                                'views.Settings.EmbeddedNode.resetExpressGraphSyncOnStartup'
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
                                                value={
                                                    resetExpressGraphSyncOnStartup
                                                }
                                                onValueChange={async () => {
                                                    this.setState({
                                                        resetExpressGraphSyncOnStartup:
                                                            !resetExpressGraphSyncOnStartup
                                                    });
                                                    await updateSettings({
                                                        resetExpressGraphSyncOnStartup:
                                                            !resetExpressGraphSyncOnStartup
                                                    });
                                                }}
                                                disabled={!expressGraphSync}
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
                                                color: themeColor(
                                                    'secondaryText'
                                                )
                                            }}
                                        >
                                            {localeString(
                                                'views.Settings.EmbeddedNode.resetExpressGraphSyncOnStartup.subtitle'
                                            )}
                                        </Text>
                                    </View>
                                </>
                            </>
                        )}
                        <>
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
                                        'views.Settings.EmbeddedNode.bimodalPathfinding'
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
                                        value={bimodalPathfinding}
                                        onValueChange={async () => {
                                            this.setState({
                                                bimodalPathfinding:
                                                    !bimodalPathfinding
                                            });
                                            await updateSettings({
                                                bimodalPathfinding:
                                                    !bimodalPathfinding
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
                                        'views.Settings.EmbeddedNode.bimodalPathfinding.subtitle'
                                    )}
                                </Text>
                            </View>
                        </>
                        <>
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
                                        'views.Settings.EmbeddedNode.rescan'
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
                                        value={rescan}
                                        onValueChange={async () => {
                                            this.setState({
                                                rescan: !rescan
                                            });
                                            await updateSettings({
                                                rescan: !rescan
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
                                        'views.Settings.EmbeddedNode.rescan.subtitle'
                                    )}
                                </Text>
                            </View>
                        </>
                        <>
                            <View style={{ margin: 10 }}>
                                <Button
                                    title={
                                        resetMissionControlSuccess
                                            ? localeString('general.success')
                                            : localeString(
                                                  'views.Settings.EmbeddedNode.resetMissionControl'
                                              )
                                    }
                                    onPress={async () => {
                                        try {
                                            await resetMissionControl();
                                            this.setState({
                                                resetMissionControlSuccess: true
                                            });

                                            setTimeout(() => {
                                                this.setState({
                                                    resetMissionControlSuccess:
                                                        false
                                                });
                                            }, 5000);
                                        } catch (e) {
                                            console.log(
                                                'Error on resetMissionControl:',
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
                                        'views.Settings.EmbeddedNode.resetMissionControl.subtitle'
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
                                                    console.log(
                                                        'yes',
                                                        multiString
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
                    </ScrollView>
                </View>
            </Screen>
        );
    }
}
