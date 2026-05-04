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

@inject('ConnectivityStore', 'SettingsStore')
@observer
export default class Networking extends React.Component<NetworkingProps> {
    async componentDidMount() {
        await this.props.SettingsStore.getSettings();
    }

    render() {
        const { navigation, ConnectivityStore, SettingsStore } = this.props;
        const { settings, updateSettings } = SettingsStore;
        const disableOfflineCheck =
            settings?.networking?.disableOfflineCheck || false;

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

                    <View
                        style={{
                            flexDirection: 'row',
                            justifyContent: 'center',
                            marginTop: 30
                        }}
                    >
                        <Text
                            style={{
                                color: themeColor('text'),
                                fontSize: 17,
                                fontFamily: 'PPNeueMontreal-Book'
                            }}
                        >
                            {`${localeString('general.status')}: `}
                        </Text>
                        <Text
                            style={{
                                color: ConnectivityStore.isOffline
                                    ? themeColor('error')
                                    : themeColor('success'),
                                fontSize: 17,
                                fontFamily: 'PPNeueMontreal-Book'
                            }}
                        >
                            {ConnectivityStore.isOffline
                                ? localeString('general.offline')
                                : localeString('general.online')}
                        </Text>
                    </View>

                    {ConnectivityStore.isOffline && (
                        <View style={{ marginTop: 15, marginBottom: 20 }}>
                            <Button
                                title={localeString(
                                    'views.Settings.Networking.resetOfflineDetection'
                                )}
                                onPress={() => {
                                    ConnectivityStore.reset();
                                    if (!disableOfflineCheck) {
                                        ConnectivityStore.start();
                                    }
                                }}
                                secondary
                            />
                        </View>
                    )}
                </ScrollView>
            </Screen>
        );
    }
}
