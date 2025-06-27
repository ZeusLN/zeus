import * as React from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';

import Header from '../../components/Header';
import Screen from '../../components/Screen';
import Switch from '../../components/Switch';
import TextInput from '../../components/TextInput';

import SettingsStore from '../../stores/SettingsStore';

import BackendUtils from '../../utils/BackendUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

interface ChannelsSettingsProps {
    navigation: StackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
}

interface ChannelsSettingsState {
    min_confs: number;
    privateChannel: boolean;
    scidAlias: boolean;
    simpleTaprootChannel: boolean;
    lsps1ShowPurchaseButton: boolean;
}

@inject('SettingsStore')
@observer
export default class ChannelsSettings extends React.Component<
    ChannelsSettingsProps,
    ChannelsSettingsState
> {
    state = {
        min_confs: 1,
        privateChannel: true,
        scidAlias: true,
        simpleTaprootChannel: false,
        lsps1ShowPurchaseButton: true
    };

    async UNSAFE_componentWillMount() {
        const { SettingsStore } = this.props;
        const { getSettings } = SettingsStore;
        const settings = await getSettings();

        this.setState({
            min_confs: settings?.channels?.min_confs || 1,
            privateChannel:
                settings?.channels?.privateChannel !== null
                    ? settings.channels.privateChannel
                    : true,
            scidAlias:
                settings?.channels?.scidAlias !== null
                    ? settings.channels.scidAlias
                    : true,
            simpleTaprootChannel:
                settings?.channels?.simpleTaprootChannel !== null
                    ? settings.channels.simpleTaprootChannel
                    : false,
            lsps1ShowPurchaseButton:
                settings?.lsps1ShowPurchaseButton !== null
                    ? settings.lsps1ShowPurchaseButton
                    : true
        });
    }

    renderSeparator = () => (
        <View
            style={{
                height: 1,
                backgroundColor: themeColor('separator')
            }}
        />
    );

    render() {
        const { navigation, SettingsStore } = this.props;
        const {
            min_confs,
            privateChannel,
            scidAlias,
            simpleTaprootChannel,
            lsps1ShowPurchaseButton
        } = this.state;
        const { settings, updateSettings }: any = SettingsStore;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Settings.Channels.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                />
                <ScrollView
                    style={{
                        flex: 1,
                        paddingHorizontal: 15,
                        marginTop: 5
                    }}
                >
                    <Text
                        style={{
                            ...styles.text,
                            color: themeColor('secondaryText')
                        }}
                    >
                        {localeString('views.OpenChannel.numConf')}
                    </Text>
                    <TextInput
                        keyboardType="numeric"
                        placeholder={'1'}
                        value={min_confs.toString()}
                        onChangeText={async (text: string) => {
                            const newMinConfs = Number(text);
                            this.setState({
                                min_confs: newMinConfs
                            });
                            await updateSettings({
                                channels: {
                                    ...settings.channels,
                                    min_confs: newMinConfs
                                }
                            });
                        }}
                    />

                    <View style={{ flexDirection: 'row', marginTop: 20 }}>
                        <View style={{ flex: 1 }}>
                            <Text
                                style={{
                                    color: themeColor('secondaryText'),
                                    fontSize: 17
                                }}
                            >
                                {localeString(
                                    'views.OpenChannel.announceChannel'
                                )}
                            </Text>
                        </View>
                        <View style={{ alignSelf: 'center', marginLeft: 5 }}>
                            <Switch
                                value={!privateChannel}
                                onValueChange={async () => {
                                    this.setState({
                                        privateChannel: !privateChannel
                                    });
                                    await updateSettings({
                                        channels: {
                                            ...settings.channels,
                                            privateChannel: !privateChannel
                                        }
                                    });
                                }}
                                disabled={
                                    simpleTaprootChannel ||
                                    SettingsStore.settingsUpdateInProgress
                                }
                            />
                        </View>
                    </View>

                    {BackendUtils.isLNDBased() && (
                        <View style={{ flexDirection: 'row', marginTop: 20 }}>
                            <View style={{ flex: 1 }}>
                                <Text
                                    style={{
                                        color: themeColor('secondaryText'),
                                        fontSize: 17
                                    }}
                                >
                                    {localeString(
                                        'views.OpenChannel.scidAlias'
                                    )}
                                </Text>
                            </View>
                            <View
                                style={{ alignSelf: 'center', marginLeft: 5 }}
                            >
                                <Switch
                                    value={scidAlias}
                                    disabled={
                                        SettingsStore.settingsUpdateInProgress
                                    }
                                    onValueChange={async () => {
                                        this.setState({
                                            scidAlias: !scidAlias
                                        });
                                        await updateSettings({
                                            channels: {
                                                ...settings.channels,
                                                scidAlias: !scidAlias
                                            }
                                        });
                                    }}
                                />
                            </View>
                        </View>
                    )}

                    {BackendUtils.supportsSimpleTaprootChannels() && (
                        <View style={{ flexDirection: 'row', marginTop: 20 }}>
                            <View style={{ flex: 1 }}>
                                <Text
                                    style={{
                                        color: themeColor('secondaryText'),
                                        fontSize: 17
                                    }}
                                >
                                    {localeString(
                                        'views.OpenChannel.simpleTaprootChannel'
                                    )}
                                </Text>
                            </View>
                            <View
                                style={{ alignSelf: 'center', marginLeft: 5 }}
                            >
                                <Switch
                                    value={simpleTaprootChannel}
                                    disabled={
                                        SettingsStore.settingsUpdateInProgress
                                    }
                                    onValueChange={async () => {
                                        this.setState({
                                            simpleTaprootChannel:
                                                !simpleTaprootChannel
                                        });

                                        if (!simpleTaprootChannel) {
                                            this.setState({
                                                privateChannel: true
                                            });
                                        }

                                        await updateSettings({
                                            channels: {
                                                ...settings.channels,
                                                privateChannel:
                                                    !simpleTaprootChannel
                                                        ? true
                                                        : privateChannel,
                                                simpleTaprootChannel:
                                                    !simpleTaprootChannel
                                            }
                                        });
                                    }}
                                />
                            </View>
                        </View>
                    )}

                    {(BackendUtils.supportsLSPScustomMessage() ||
                        BackendUtils.supportsLSPS1rest()) && (
                        <View style={{ flexDirection: 'row', marginTop: 20 }}>
                            <View style={{ flex: 1 }}>
                                <Text
                                    style={{
                                        color: themeColor('secondaryText'),
                                        fontSize: 17
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.Channels.lsps1ShowPurchaseButton'
                                    )}
                                </Text>
                            </View>
                            <View
                                style={{ alignSelf: 'center', marginLeft: 5 }}
                            >
                                <Switch
                                    value={lsps1ShowPurchaseButton}
                                    disabled={
                                        SettingsStore.settingsUpdateInProgress
                                    }
                                    onValueChange={async () => {
                                        this.setState({
                                            lsps1ShowPurchaseButton:
                                                !lsps1ShowPurchaseButton
                                        });

                                        await updateSettings({
                                            lsps1ShowPurchaseButton:
                                                !lsps1ShowPurchaseButton
                                        });
                                    }}
                                />
                            </View>
                        </View>
                    )}
                </ScrollView>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    text: {
        fontFamily: 'PPNeueMontreal-Book'
    }
});
