import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { inject, observer } from 'mobx-react';

import Header from '../../components/Header';
import Screen from '../../components/Screen';
import Switch from '../../components/Switch';
import TextInput from '../../components/TextInput';

import SettingsStore from '../../stores/SettingsStore';

import BackendUtils from '../../utils/BackendUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

interface ChannelsSettingsProps {
    navigation: any;
    SettingsStore: SettingsStore;
}

interface ChannelsSettingsState {
    min_confs: number;
    privateChannel: boolean;
    scidAlias: boolean;
    simpleTaprootChannel: boolean;
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
        simpleTaprootChannel: false
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
                    : false
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
        const { min_confs, privateChannel, scidAlias, simpleTaprootChannel } =
            this.state;
        const { updateSettings }: any = SettingsStore;

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
                <View
                    style={{
                        padding: 20
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
                                    min_confs: newMinConfs,
                                    privateChannel,
                                    scidAlias,
                                    simpleTaprootChannel
                                }
                            });
                        }}
                    />

                    <>
                        <Text
                            style={{
                                top: 20,
                                color: themeColor('secondaryText')
                            }}
                        >
                            {localeString('views.OpenChannel.announceChannel')}
                        </Text>
                        <Switch
                            value={!privateChannel}
                            onValueChange={async () => {
                                this.setState({
                                    privateChannel: !privateChannel
                                });
                                await updateSettings({
                                    channels: {
                                        min_confs,
                                        privateChannel: !privateChannel,
                                        scidAlias,
                                        simpleTaprootChannel
                                    }
                                });
                            }}
                            disabled={simpleTaprootChannel}
                        />
                    </>

                    {BackendUtils.isLNDBased() && (
                        <>
                            <Text
                                style={{
                                    top: 20,
                                    color: themeColor('secondaryText')
                                }}
                            >
                                {localeString('views.OpenChannel.scidAlias')}
                            </Text>
                            <Switch
                                value={scidAlias}
                                onValueChange={async () => {
                                    this.setState({
                                        scidAlias: !scidAlias
                                    });
                                    await updateSettings({
                                        channels: {
                                            min_confs,
                                            privateChannel,
                                            scidAlias: !scidAlias,
                                            simpleTaprootChannel
                                        }
                                    });
                                }}
                            />
                        </>
                    )}

                    {BackendUtils.supportsSimpleTaprootChannels() && (
                        <>
                            <Text
                                style={{
                                    top: 20,
                                    color: themeColor('secondaryText')
                                }}
                            >
                                {localeString(
                                    'views.OpenChannel.simpleTaprootChannel'
                                )}
                            </Text>
                            <Switch
                                value={simpleTaprootChannel}
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
                                            min_confs,
                                            privateChannel:
                                                !simpleTaprootChannel
                                                    ? true
                                                    : privateChannel,
                                            scidAlias,
                                            simpleTaprootChannel:
                                                !simpleTaprootChannel
                                        }
                                    });
                                }}
                            />
                        </>
                    )}
                </View>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    text: {
        fontFamily: 'PPNeueMontreal-Book'
    }
});
