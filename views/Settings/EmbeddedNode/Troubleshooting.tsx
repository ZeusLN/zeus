import * as React from 'react';
import { NativeModules, ScrollView, Text, View } from 'react-native';
import { ListItem } from '@rneui/themed';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';

import Button from '../../../components/Button';
import Header from '../../../components/Header';
import LoadingIndicator from '../../../components/LoadingIndicator';
import Screen from '../../../components/Screen';
import Switch from '../../../components/Switch';

import SettingsStore from '../../../stores/SettingsStore';

import { localeString } from '../../../utils/LocaleUtils';
import { restartNeeded } from '../../../utils/RestartUtils';
import { sleep } from '../../../utils/SleepUtils';
import { themeColor } from '../../../utils/ThemeUtils';

import { resetMissionControl } from '../../../lndmobile';

interface EmbeddedNodeTroubleshootingProps {
    navigation: StackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
}

interface EmbeddedNodeTroubleshootingState {
    expressGraphSync: boolean | undefined;
    resetExpressGraphSyncOnStartup: boolean | undefined;
    compactDb: boolean | undefined;
    resetMissionControlSuccess: boolean | undefined;
    deleteNeutrinoLoading: boolean;
    deleteNeutrinoSuccess: boolean;
    deleteNeutrinoError: string | null;
}

@inject('SettingsStore')
@observer
export default class EmbeddedNodeTroubleshooting extends React.Component<
    EmbeddedNodeTroubleshootingProps,
    EmbeddedNodeTroubleshootingState
> {
    state = {
        expressGraphSync:
            this.props.SettingsStore.settings.expressGraphSync ?? false,
        resetExpressGraphSyncOnStartup:
            this.props.SettingsStore.settings.resetExpressGraphSyncOnStartup ??
            false,
        compactDb: this.props.SettingsStore.settings.compactDb ?? false,
        resetMissionControlSuccess: false,
        deleteNeutrinoLoading: false,
        deleteNeutrinoSuccess: false,
        deleteNeutrinoError: null
    };

    render() {
        const { navigation, SettingsStore } = this.props;
        const {
            expressGraphSync,
            resetExpressGraphSyncOnStartup,
            compactDb,
            resetMissionControlSuccess,
            deleteNeutrinoLoading,
            deleteNeutrinoSuccess,
            deleteNeutrinoError
        } = this.state;
        const { updateSettings, embeddedLndNetwork }: any = SettingsStore;

        return (
            <Screen>
                <View style={{ flex: 1 }}>
                    <Header
                        leftComponent="Back"
                        centerComponent={{
                            text: localeString(
                                'views.Settings.EmbeddedNode.Troubleshooting.title'
                            ),
                            style: {
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book'
                            }
                        }}
                        rightComponent={
                            deleteNeutrinoLoading ? (
                                <View>
                                    <LoadingIndicator size={30} />
                                </View>
                            ) : undefined
                        }
                        navigation={navigation}
                    />
                    <ScrollView>
                        <>
                            <ListItem
                                containerStyle={{
                                    borderBottomWidth: 0,
                                    backgroundColor: 'transparent'
                                }}
                            >
                                <ListItem.Title
                                    style={{
                                        color: themeColor('text'),
                                        fontFamily: 'PPNeueMontreal-Book'
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
                                        value={resetExpressGraphSyncOnStartup}
                                        onValueChange={async () => {
                                            this.setState({
                                                resetExpressGraphSyncOnStartup:
                                                    !resetExpressGraphSyncOnStartup
                                            });
                                            await updateSettings({
                                                resetExpressGraphSyncOnStartup:
                                                    !resetExpressGraphSyncOnStartup
                                            });
                                            restartNeeded();
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
                                        color: themeColor('secondaryText')
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.EmbeddedNode.resetExpressGraphSyncOnStartup.subtitle'
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
                                        color: themeColor('text'),
                                        fontFamily: 'PPNeueMontreal-Book'
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.EmbeddedNode.compactDb'
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
                                        value={compactDb}
                                        onValueChange={async () => {
                                            this.setState({
                                                compactDb: !compactDb
                                            });
                                            await updateSettings({
                                                compactDb: !compactDb
                                            });
                                            restartNeeded();
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
                                        'views.Settings.EmbeddedNode.compactDb.subtitle'
                                    )}
                                </Text>
                            </View>
                        </>
                        <>
                            <View style={{ marginTop: 20 }}>
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
                            <View style={{ marginTop: 25 }}>
                                <Button
                                    title={
                                        deleteNeutrinoLoading
                                            ? localeString('general.loading')
                                            : deleteNeutrinoSuccess
                                            ? localeString('general.success')
                                            : localeString(
                                                  'views.Settings.EmbeddedNode.stopLndDeleteNeutrino'
                                              )
                                    }
                                    disabled={deleteNeutrinoLoading}
                                    onPress={async () => {
                                        this.setState({
                                            deleteNeutrinoLoading: true,
                                            deleteNeutrinoError: null,
                                            deleteNeutrinoSuccess: false
                                        });

                                        try {
                                            await NativeModules.LndMobile.stopLnd();
                                            await sleep(5000); // Let lnd close down
                                        } catch (e: any) {
                                            // If lnd was closed down already
                                            if (
                                                e?.message?.includes?.('closed')
                                            ) {
                                                console.log('yes closed');
                                            } else {
                                                console.error(e.message);
                                                this.setState({
                                                    deleteNeutrinoLoading:
                                                        false,
                                                    deleteNeutrinoError:
                                                        e.message ||
                                                        localeString(
                                                            'general.error'
                                                        )
                                                });
                                                return;
                                            }
                                        }

                                        try {
                                            console.log(
                                                embeddedLndNetwork === 'Mainnet'
                                                    ? 'mainnet'
                                                    : 'testnet'
                                            );
                                            await NativeModules.LndMobileTools.DEBUG_deleteNeutrinoFiles(
                                                embeddedLndNetwork === 'Mainnet'
                                                    ? 'mainnet'
                                                    : 'testnet'
                                            );
                                            this.setState({
                                                deleteNeutrinoLoading: false,
                                                deleteNeutrinoSuccess: true
                                            });

                                            setTimeout(() => {
                                                this.setState({
                                                    deleteNeutrinoSuccess: false
                                                });
                                            }, 5000);

                                            restartNeeded();
                                        } catch (e: any) {
                                            console.error(e.message);
                                            this.setState({
                                                deleteNeutrinoLoading: false,
                                                deleteNeutrinoError:
                                                    e.message ||
                                                    localeString(
                                                        'general.error'
                                                    )
                                            });
                                        }
                                    }}
                                />
                            </View>
                            {deleteNeutrinoError && (
                                <View
                                    style={{
                                        margin: 10,
                                        marginTop: 10
                                    }}
                                >
                                    <Text
                                        style={{
                                            color: themeColor('error')
                                        }}
                                    >
                                        {deleteNeutrinoError}
                                    </Text>
                                </View>
                            )}
                            <View
                                style={{
                                    margin: 10,
                                    marginTop: deleteNeutrinoError ? 5 : 15
                                }}
                            >
                                <Text
                                    style={{
                                        color: themeColor('secondaryText')
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.EmbeddedNode.stopLndDeleteNeutrino.subtitle'
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
