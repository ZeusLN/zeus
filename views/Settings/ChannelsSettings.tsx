import * as React from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { inject, observer } from 'mobx-react';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Header from '../../components/Header';
import Screen from '../../components/Screen';
import Switch from '../../components/Switch';
import Text from '../../components/Text';
import TextInput from '../../components/TextInput';

import SettingsStore from '../../stores/SettingsStore';

import BackendUtils from '../../utils/BackendUtils';
import OpenChannelUtils from '../../utils/OpenChannelUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

interface ChannelsSettingsProps {
    navigation: NativeStackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
}

interface ChannelsSettingsState {
    min_confs?: number;
    privateChannel: boolean;
    scidAlias: boolean;
    simpleTaprootChannel: boolean;
}

const stateFromSettings = (settings: any): ChannelsSettingsState => {
    const channels = settings?.channels;
    return {
        min_confs: channels?.min_confs ?? 1,
        privateChannel: channels?.privateChannel ?? true,
        scidAlias: channels?.scidAlias ?? true,
        simpleTaprootChannel: channels?.simpleTaprootChannel ?? false
    };
};

@inject('SettingsStore')
@observer
export default class ChannelsSettings extends React.Component<
    ChannelsSettingsProps,
    ChannelsSettingsState
> {
    constructor(props: ChannelsSettingsProps) {
        super(props);
        // settings are loaded before this view opens, so the first render
        // already shows the saved values (a saved 0 does not flash 1)
        this.state = stateFromSettings(props.SettingsStore.settings);
    }

    async componentDidMount() {
        const { SettingsStore } = this.props;
        const { getSettings } = SettingsStore;
        const settings = await getSettings();

        this.setState(stateFromSettings(settings));
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
        const { min_confs, privateChannel, scidAlias, simpleTaprootChannel } =
            this.state;
        const { updateSettingsGroup } = SettingsStore;

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
                    {BackendUtils.supportsChannelOpenMinConfs() && (
                        <>
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
                                value={min_confs?.toString() ?? ''}
                                onChangeText={async (text: string) => {
                                    const newMinConfs =
                                        OpenChannelUtils.parseMinConfs(text);
                                    this.setState({
                                        min_confs: newMinConfs
                                    });
                                    await updateSettingsGroup('channels', {
                                        min_confs: newMinConfs
                                    });
                                }}
                            />
                        </>
                    )}

                    <View style={{ flexDirection: 'row', marginTop: 20 }}>
                        <View style={{ flex: 1 }}>
                            <Text
                                style={{
                                    color: themeColor('secondaryText'),
                                    fontSize: 17
                                }}
                                infoModalText={localeString(
                                    'views.OpenChannel.announceChannelExplainer'
                                )}
                            >
                                {localeString(
                                    'views.OpenChannel.announceChannel'
                                )}
                            </Text>
                        </View>
                        <View style={{ alignSelf: 'center', marginLeft: 5 }}>
                            <Switch
                                value={!privateChannel}
                                onValueChange={async (announce: boolean) => {
                                    this.setState({
                                        privateChannel: !announce
                                    });
                                    await updateSettingsGroup('channels', {
                                        privateChannel: !announce
                                    });
                                }}
                                disabled={simpleTaprootChannel}
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
                                    infoModalText={localeString(
                                        'views.OpenChannel.scidAliasExplainer'
                                    )}
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
                                    onValueChange={async (value: boolean) => {
                                        this.setState({
                                            scidAlias: value
                                        });
                                        await updateSettingsGroup('channels', {
                                            scidAlias: value
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
                                    infoModalText={localeString(
                                        'views.OpenChannel.simpleTaprootChannelExplainer'
                                    )}
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
                                    onValueChange={async (value: boolean) => {
                                        this.setState({
                                            simpleTaprootChannel: value
                                        });

                                        if (value) {
                                            this.setState({
                                                privateChannel: true
                                            });
                                        }

                                        // Taproot channels must be private
                                        await updateSettingsGroup('channels', {
                                            privateChannel: value
                                                ? true
                                                : privateChannel,
                                            simpleTaprootChannel: value
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
