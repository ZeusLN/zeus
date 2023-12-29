import * as React from 'react';
import {
    Alert,
    NativeModules,
    Platform,
    ScrollView,
    Text,
    View
} from 'react-native';
import { Icon, ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';

import Button from '../../../components/Button';
import Header from '../../../components/Header';
import Screen from '../../../components/Screen';
import Switch from '../../../components/Switch';

import SettingsStore from '../../../stores/SettingsStore';

import { localeString } from '../../../utils/LocaleUtils';
import { sleep } from '../../../utils/SleepUtils';
import { themeColor } from '../../../utils/ThemeUtils';

interface EmbeddedNodeAdvancedSettingsProps {
    navigation: any;
    SettingsStore: SettingsStore;
}

interface EmbeddedNodeAdvancedSettingsState {
    rescan: boolean | undefined;
    compactDb: boolean | undefined;
}

const restartNeeded = () => {
    const title = localeString('restart.title');
    const message = localeString('restart.msg');
    if (Platform.OS === 'android') {
        Alert.alert(title, message + '\n' + localeString('restart.msg1'), [
            {
                style: 'cancel',
                text: localeString('general.no')
            },
            {
                style: 'default',
                text: localeString('general.yes'),
                onPress: async () => {
                    try {
                        // await NativeModules.ZeusTor.stopTor();
                        await NativeModules.LndMobile.stopLnd();
                        await NativeModules.LndMobileTools.killLnd();
                    } catch (e) {
                        console.log(e);
                    }
                    NativeModules.LndMobileTools.restartApp();
                }
            }
        ]);
    } else {
        Alert.alert(title, message);
    }
};

@inject('SettingsStore')
@observer
export default class EmbeddedNodeAdvancedSettings extends React.Component<
    EmbeddedNodeAdvancedSettingsProps,
    EmbeddedNodeAdvancedSettingsState
> {
    state = {
        rescan: false,
        compactDb: false
    };

    async UNSAFE_componentWillMount() {
        const { SettingsStore } = this.props;
        const { settings } = SettingsStore;

        this.setState({
            rescan: settings.rescan,
            compactDb: settings.compactDb
        });
    }

    render() {
        const { navigation, SettingsStore } = this.props;
        const { rescan, compactDb } = this.state;
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
                            <View style={{ margin: 10 }}>
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
                    </ScrollView>
                </View>
            </Screen>
        );
    }
}
