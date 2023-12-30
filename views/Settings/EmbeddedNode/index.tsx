import * as React from 'react';
import { Platform, ScrollView, Text, View } from 'react-native';
import { Icon, ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import Button from '../../../components/Button';
import Screen from '../../../components/Screen';
import Header from '../../../components/Header';

import SettingsStore from '../../../stores/SettingsStore';

import { localeString } from '../../../utils/LocaleUtils';
import { themeColor } from '../../../utils/ThemeUtils';
import Switch from '../../../components/Switch';

import { stopLnd } from '../../../utils/LndMobileUtils';

interface EmbeddedNodeProps {
    navigation: any;
    SettingsStore: SettingsStore;
}

interface EmbeddedNodeState {
    rescan: boolean | undefined;
    embeddedTor: boolean | undefined;
    persistentMode: boolean | undefined;
}

const PERSISTENT_KEY = 'persistentServicesEnabled';

@inject('SettingsStore')
@observer
export default class EmbeddedNode extends React.Component<
    EmbeddedNodeProps,
    EmbeddedNodeState
> {
    state = {
        rescan: false,
        embeddedTor: false,
        persistentMode: false
    };

    async UNSAFE_componentWillMount() {
        const { SettingsStore } = this.props;
        const { settings } = SettingsStore;

        const persistentMode = await AsyncStorage.getItem(PERSISTENT_KEY);

        this.setState({
            rescan: settings.rescan,
            embeddedTor: settings.embeddedTor,
            persistentMode: persistentMode === 'true' ? true : false
        });
    }

    render() {
        const { navigation, SettingsStore } = this.props;
        const { rescan, embeddedTor, persistentMode } = this.state;
        const { updateSettings, embeddedLndNetwork, settings }: any =
            SettingsStore;
        const {
            automaticDisasterRecoveryBackup,
            bimodalPathfinding,
            expressGraphSync
        } = settings;

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
                            onPress={() =>
                                navigation.navigate('DisasterRecovery')
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
                                        'views.Settings.EmbeddedNode.DisasterRecovery.title'
                                    )}
                                </ListItem.Title>
                                <ListItem.Title
                                    style={{
                                        color: themeColor('secondaryText'),
                                        fontFamily: 'PPNeueMontreal-Book'
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.EmbeddedNode.DisasterRecovery.automaticBackups'
                                    )}
                                    :{' '}
                                    {automaticDisasterRecoveryBackup
                                        ? localeString('views.Settings.enabled')
                                        : localeString(
                                              'views.Settings.disabled'
                                          )}
                                </ListItem.Title>
                            </ListItem.Content>
                            <Icon
                                name="keyboard-arrow-right"
                                color={themeColor('secondaryText')}
                            />
                        </ListItem>
                        {embeddedLndNetwork === 'Mainnet' && (
                            <ListItem
                                containerStyle={{
                                    backgroundColor: 'transparent'
                                }}
                                onPress={() =>
                                    navigation.navigate('ExpressGraphSync')
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
                                            'views.Settings.EmbeddedNode.ExpressGraphSync.title'
                                        )}
                                    </ListItem.Title>
                                    <ListItem.Title
                                        style={{
                                            color: themeColor('secondaryText'),
                                            fontFamily: 'PPNeueMontreal-Book'
                                        }}
                                    >
                                        {expressGraphSync
                                            ? localeString(
                                                  'views.Settings.enabled'
                                              )
                                            : localeString(
                                                  'views.Settings.disabled'
                                              )}
                                    </ListItem.Title>
                                </ListItem.Content>
                                <Icon
                                    name="keyboard-arrow-right"
                                    color={themeColor('secondaryText')}
                                />
                            </ListItem>
                        )}
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
                        <ListItem
                            containerStyle={{
                                backgroundColor: 'transparent'
                            }}
                            onPress={() => navigation.navigate('Peers')}
                        >
                            <ListItem.Content>
                                <ListItem.Title
                                    style={{
                                        color: themeColor('text'),
                                        fontFamily: 'PPNeueMontreal-Book'
                                    }}
                                >
                                    {localeString(
                                        'general.peers'
                                    )[0].toUpperCase() +
                                        localeString('general.peers').slice(1)}
                                </ListItem.Title>
                            </ListItem.Content>
                            <Icon
                                name="keyboard-arrow-right"
                                color={themeColor('secondaryText')}
                            />
                        </ListItem>
                        <ListItem
                            containerStyle={{
                                backgroundColor: 'transparent'
                            }}
                            onPress={() => navigation.navigate('LNDLogs')}
                        >
                            <ListItem.Content>
                                <ListItem.Title
                                    style={{
                                        color: themeColor('text'),
                                        fontFamily: 'PPNeueMontreal-Book'
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.EmbeddedNode.LNDLogs.title'
                                    )}
                                </ListItem.Title>
                            </ListItem.Content>
                            <Icon
                                name="keyboard-arrow-right"
                                color={themeColor('secondaryText')}
                            />
                        </ListItem>
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
