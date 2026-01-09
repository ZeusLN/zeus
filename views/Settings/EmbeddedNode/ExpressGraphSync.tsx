import * as React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { ListItem } from '@rneui/themed';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';

import DropdownSetting from '../../../components/DropdownSetting';
import Header from '../../../components/Header';
import Screen from '../../../components/Screen';
import Switch from '../../../components/Switch';
import TextInput from '../../../components/TextInput';

import { localeString } from '../../../utils/LocaleUtils';
import { restartNeeded } from '../../../utils/RestartUtils';
import { themeColor } from '../../../utils/ThemeUtils';

import SettingsStore, {
    DEFAULT_SPEEDLOADER,
    SPEEDLOADER_KEYS
} from '../../../stores/SettingsStore';

interface ExpressGraphSyncProps {
    navigation: StackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
}

interface ExpressGraphSyncState {
    expressGraphSync: boolean | undefined;
    resetExpressGraphSyncOnStartup: boolean | undefined;
    speedloader: string;
    customSpeedloader: string;
}

@inject('SettingsStore')
@observer
export default class ExpressGraphSync extends React.Component<
    ExpressGraphSyncProps,
    ExpressGraphSyncState
> {
    state = {
        expressGraphSync:
            this.props.SettingsStore.settings.expressGraphSync || false,
        resetExpressGraphSyncOnStartup:
            this.props.SettingsStore.settings.resetExpressGraphSyncOnStartup ||
            false,
        speedloader:
            this.props.SettingsStore.settings.speedloader ||
            DEFAULT_SPEEDLOADER,
        customSpeedloader:
            this.props.SettingsStore.settings.customSpeedloader || ''
    };

    render() {
        const { navigation, SettingsStore } = this.props;
        const {
            expressGraphSync,
            resetExpressGraphSyncOnStartup,
            speedloader,
            customSpeedloader
        } = this.state;
        const { updateSettings }: any = SettingsStore;

        return (
            <Screen>
                <View style={{ flex: 1 }}>
                    <Header
                        leftComponent="Back"
                        centerComponent={{
                            text: localeString(
                                'views.Settings.EmbeddedNode.ExpressGraphSync.title'
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
                                            if (expressGraphSync) {
                                                this.setState({
                                                    resetExpressGraphSyncOnStartup:
                                                        false
                                                });
                                                await updateSettings({
                                                    resetExpressGraphSyncOnStartup:
                                                        false
                                                });
                                            }
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
                                        color: themeColor('secondaryText'),
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

                        <View style={{ margin: 10 }}>
                            <DropdownSetting
                                title={localeString(
                                    'views.Settings.EmbeddedNode.speedloader'
                                )}
                                selectedValue={speedloader}
                                onValueChange={async (value: string) => {
                                    this.setState({
                                        speedloader: value,
                                        resetExpressGraphSyncOnStartup: true
                                    });
                                    await updateSettings({
                                        speedloader: value,
                                        resetExpressGraphSyncOnStartup: true
                                    });
                                    restartNeeded();
                                }}
                                values={SPEEDLOADER_KEYS}
                            />

                            {speedloader === 'Custom' && (
                                <>
                                    <Text
                                        style={{
                                            color: themeColor('secondaryText'),
                                            fontFamily: 'PPNeueMontreal-Book'
                                        }}
                                    >
                                        {localeString(
                                            'views.Settings.EmbeddedNode.customSpeedloader'
                                        )}
                                    </Text>
                                    <TextInput
                                        value={customSpeedloader}
                                        placeholder={DEFAULT_SPEEDLOADER}
                                        onChangeText={async (text: string) => {
                                            this.setState({
                                                customSpeedloader: text
                                            });

                                            await updateSettings({
                                                customSpeedloader: text
                                            });
                                        }}
                                        autoCapitalize="none"
                                        error={!customSpeedloader}
                                    />
                                </>
                            )}
                        </View>
                    </ScrollView>
                </View>
            </Screen>
        );
    }
}
