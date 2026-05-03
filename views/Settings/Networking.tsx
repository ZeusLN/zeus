import * as React from 'react';
import { View, ScrollView } from 'react-native';
import { inject, observer } from 'mobx-react';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Button from '../../components/Button';
import Header from '../../components/Header';
import Screen from '../../components/Screen';
import Switch from '../../components/Switch';
import Text from '../../components/Text';

import ConnectivityStore from '../../stores/ConnectivityStore';
import SettingsStore from '../../stores/SettingsStore';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

interface NetworkingProps {
    navigation: NativeStackNavigationProp<any, any>;
    ConnectivityStore: ConnectivityStore;
    SettingsStore: SettingsStore;
}

interface NetworkingState {
    disableOfflineCheck: boolean;
}

@inject('ConnectivityStore', 'SettingsStore')
@observer
export default class Networking extends React.Component<
    NetworkingProps,
    NetworkingState
> {
    state = {
        disableOfflineCheck: false
    };

    focusListener: any;

    async componentDidMount() {
        const { navigation, SettingsStore } = this.props;
        const { getSettings } = SettingsStore;
        const settings = await getSettings();

        this.setState({
            disableOfflineCheck:
                settings?.networking?.disableOfflineCheck || false
        });

        this.focusListener = navigation.addListener('focus', async () => {
            const refreshed = await getSettings();
            this.setState({
                disableOfflineCheck:
                    refreshed?.networking?.disableOfflineCheck || false
            });
        });
    }

    componentWillUnmount() {
        if (this.focusListener) {
            this.focusListener();
        }
    }

    render() {
        const { navigation, ConnectivityStore, SettingsStore } = this.props;
        const { disableOfflineCheck } = this.state;
        const { settings, updateSettings } = SettingsStore;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Settings.networking'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                />
                <ScrollView
                    style={{ flex: 1, paddingHorizontal: 15, marginTop: 5 }}
                    keyboardShouldPersistTaps="handled"
                >
                    <View
                        style={{
                            flexDirection: 'row',
                            marginTop: 20
                        }}
                    >
                        <View style={{ flex: 1 }}>
                            <Text
                                style={{
                                    color: themeColor('secondaryText'),
                                    fontSize: 17,
                                    fontFamily: 'PPNeueMontreal-Book'
                                }}
                            >
                                {localeString(
                                    'views.Settings.Networking.disableOfflineCheck'
                                )}
                            </Text>
                        </View>
                        <View style={{ alignSelf: 'center', marginLeft: 5 }}>
                            <Switch
                                value={disableOfflineCheck}
                                disabled={
                                    SettingsStore.settingsUpdateInProgress
                                }
                                onValueChange={async () => {
                                    const newValue = !disableOfflineCheck;
                                    this.setState({
                                        disableOfflineCheck: newValue
                                    });
                                    await updateSettings({
                                        networking: {
                                            ...settings.networking,
                                            disableOfflineCheck: newValue
                                        }
                                    });
                                    if (newValue) {
                                        ConnectivityStore.reset();
                                    } else {
                                        ConnectivityStore.start();
                                    }
                                }}
                            />
                        </View>
                    </View>
                    <Text
                        style={{
                            color: themeColor('secondaryText'),
                            fontSize: 14,
                            fontFamily: 'PPNeueMontreal-Book',
                            marginTop: 8
                        }}
                    >
                        {localeString(
                            'views.Settings.Networking.disableOfflineCheck.subtitle'
                        )}
                    </Text>

                    <View style={{ marginTop: 30, marginBottom: 20 }}>
                        <Button
                            title={localeString(
                                'views.Settings.Networking.resetOfflineDetection'
                            )}
                            onPress={() => ConnectivityStore.reset()}
                            secondary
                        />
                    </View>
                </ScrollView>
            </Screen>
        );
    }
}
