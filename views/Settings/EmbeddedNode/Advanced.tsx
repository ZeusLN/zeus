import * as React from 'react';
import { Platform, NativeModules, ScrollView, Text, View } from 'react-native';
import { Icon, ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import Button from '../../../components/Button';
import Header from '../../../components/Header';
import Screen from '../../../components/Screen';
import Switch from '../../../components/Switch';

import SettingsStore from '../../../stores/SettingsStore';

import { localeString } from '../../../utils/LocaleUtils';
import { restartNeeded } from '../../../utils/RestartUtils';
import { sleep } from '../../../utils/SleepUtils';
import { themeColor } from '../../../utils/ThemeUtils';

import { stopLnd } from '../../../utils/LndMobileUtils';

interface EmbeddedNodeAdvancedSettingsProps {
    navigation: any;
    SettingsStore: SettingsStore;
}

interface EmbeddedNodeAdvancedSettingsState {
    rescan: boolean | undefined;
    embeddedTor: boolean | undefined;
    persistentMode: boolean | undefined;
    compactDb: boolean | undefined;
}

const PERSISTENT_KEY = 'persistentServicesEnabled';

@inject('SettingsStore')
@observer
export default class EmbeddedNodeAdvancedSettings extends React.Component<
    EmbeddedNodeAdvancedSettingsProps,
    EmbeddedNodeAdvancedSettingsState
> {
    state = {
        rescan: false,
        persistentMode: false,
        embeddedTor: false,
        compactDb: false
    };

    async UNSAFE_componentWillMount() {
        const { SettingsStore } = this.props;
        const { settings } = SettingsStore;

        const persistentMode = await AsyncStorage.getItem(PERSISTENT_KEY);

        this.setState({
            rescan: settings.rescan,
            persistentMode: persistentMode === 'true' ? true : false,
            embeddedTor: settings.embeddedTor,
            compactDb: settings.compactDb
        });
    }

    render() {
        const { navigation, SettingsStore } = this.props;
        const { rescan, persistentMode, embeddedTor, compactDb } = this.state;
        const { updateSettings, embeddedLndNetwork, settings }: any =
            SettingsStore;
        const { bimodalPathfinding } = settings;

        return (
            <Screen>
                <View style={{ flex: 1 }}>
                    <Header
                        leftComponent="Back"
                        centerComponent={{
                            text: localeString('general.advancedSettings'),
                            style: {
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book'
                            }
                        }}
                        navigation={navigation}
                    />
                    <ScrollView>
                        <ListItem
                            containerStyle={{
                                backgroundColor: 'transparent'
                            }}
                            onPress={() => navigation.navigate('Pathfinding')}
                        >
                            <ListItem.Content>
                                <ListItem.Title
                                    style={{
                                        color: themeColor('text'),
                                        fontFamily: 'PPNeueMontreal-Book'
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.EmbeddedNode.Pathfinding.title'
                                    )}
                                </ListItem.Title>
                                <ListItem.Title
                                    style={{
                                        color: themeColor('secondaryText'),
                                        fontFamily: 'PPNeueMontreal-Book'
                                    }}
                                >
                                    {bimodalPathfinding
                                        ? localeString(
                                              'views.Settings.EmbeddedNode.bimodal'
                                          )
                                        : localeString(
                                              'views.Settings.EmbeddedNode.apriori'
                                          )}
                                </ListItem.Title>
                            </ListItem.Content>
                            <Icon
                                name="keyboard-arrow-right"
                                color={themeColor('secondaryText')}
                            />
                        </ListItem>
                        {false && (
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
                                        {localeString('general.tor')}
                                    </ListItem.Title>
                                    <View
                                        style={{
                                            flex: 1,
                                            flexDirection: 'row',
                                            justifyContent: 'flex-end'
                                        }}
                                    >
                                        <Switch
                                            value={embeddedTor}
                                            onValueChange={async () => {
                                                this.setState({
                                                    embeddedTor: !embeddedTor
                                                });
                                                await updateSettings({
                                                    embeddedTor: !embeddedTor
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
                                        {`${localeString(
                                            'views.Settings.EmbeddedNode.embeddedTor.subtitle'
                                        )} ${localeString(
                                            'views.Settings.EmbeddedNode.embeddedTor.clearnetWarning'
                                        )} ${localeString(
                                            'views.Settings.EmbeddedNode.restart'
                                        )}`}
                                    </Text>
                                </View>
                            </>
                        )}
                        {Platform.OS === 'android' && (
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
                                            embeddedTor
                                                ? 'views.Settings.EmbeddedNode.persistentModeTor'
                                                : 'views.Settings.EmbeddedNode.persistentMode'
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
                                            value={persistentMode}
                                            onValueChange={async () => {
                                                this.setState({
                                                    persistentMode:
                                                        !persistentMode
                                                });
                                                await updateSettings({
                                                    persistentMode:
                                                        !persistentMode
                                                });
                                                const newValue =
                                                    !persistentMode;
                                                await AsyncStorage.setItem(
                                                    PERSISTENT_KEY,
                                                    newValue.toString()
                                                );
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
                                        {`${localeString(
                                            embeddedTor
                                                ? 'views.Settings.EmbeddedNode.persistentMode.subtitleTor'
                                                : 'views.Settings.EmbeddedNode.persistentMode.subtitle'
                                        )} ${localeString(
                                            'views.Settings.EmbeddedNode.restart'
                                        )}`}
                                    </Text>
                                </View>
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
                                        color: themeColor('text'),
                                        fontFamily: 'PPNeueMontreal-Book'
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
                                        'views.Settings.EmbeddedNode.rescan.subtitle'
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
                        <ListItem
                            containerStyle={{
                                backgroundColor: 'transparent'
                            }}
                            onPress={() =>
                                navigation.navigate('RestoreChannelBackups')
                            }
                        >
                            <ListItem.Content>
                                <ListItem.Title
                                    style={{
                                        color: themeColor('text'),
                                        fontFamily: 'PPNeueMontreal-Book'
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.EmbeddedNode.restoreChannelBackups'
                                    )}
                                </ListItem.Title>
                            </ListItem.Content>
                            <Icon
                                name="keyboard-arrow-right"
                                color={themeColor('secondaryText')}
                            />
                        </ListItem>
                        <>
                            <View style={{ marginTop: 20 }}>
                                <Button
                                    title={localeString(
                                        'views.Settings.EmbeddedNode.stopLndDeleteNeutrino'
                                    )}
                                    onPress={async () => {
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
                                                console.error(e.message, 10000);
                                                return;
                                            }
                                        }

                                        console.log(
                                            await NativeModules.LndMobileTools.DEBUG_deleteNeutrinoFiles(
                                                embeddedLndNetwork === 'Mainnet'
                                                    ? 'mainnet'
                                                    : 'testnet'
                                            )
                                        );
                                        restartNeeded();
                                    }}
                                />
                            </View>
                        </>
                        {false && persistentMode && (
                            <View style={{ margin: 15 }}>
                                <Button
                                    warning={true}
                                    title="Stop LND"
                                    onPress={() => stopLnd()}
                                />
                            </View>
                        )}
                    </ScrollView>
                </View>
            </Screen>
        );
    }
}
