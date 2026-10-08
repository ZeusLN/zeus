import * as React from 'react';
import { Platform, View, ScrollView } from 'react-native';
import { inject, observer } from 'mobx-react';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Button from '../../components/Button';
import Header from '../../components/Header';
import Screen from '../../components/Screen';
import Switch from '../../components/Switch';
import Text from '../../components/Text';

import ConnectivityStore from '../../stores/ConnectivityStore';
import SettingsStore from '../../stores/SettingsStore';
import TorStore, { TOR_INDICATOR_COLORS } from '../../stores/TorStore';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

interface NetworkingProps {
    navigation: NativeStackNavigationProp<any, any>;
    ConnectivityStore: ConnectivityStore;
    SettingsStore: SettingsStore;
    TorStore: TorStore;
}

@inject('ConnectivityStore', 'SettingsStore', 'TorStore')
@observer
export default class Networking extends React.Component<
    NetworkingProps,
    { disableOfflineCheck: boolean | undefined }
> {
    state = { disableOfflineCheck: undefined as boolean | undefined };

    async componentDidMount() {
        await this.props.SettingsStore.getSettings();
    }

    render() {
        const { navigation, ConnectivityStore, SettingsStore, TorStore } =
            this.props;
        const { settings, updateSettings } = SettingsStore;
        const disableOfflineCheck =
            this.state.disableOfflineCheck ??
            settings?.networking?.disableOfflineCheck ??
            false;
        const torState = TorStore.status?.state;
        const showTorStatus =
            TorStore.torInUse || (!!torState && torState !== 'stopped');

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
                                    this.setState({
                                        disableOfflineCheck: undefined
                                    });
                                    if (newValue) {
                                        ConnectivityStore.stop();
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

                    {(showTorStatus || Platform.OS === 'android') && (
                        <Text
                            style={{
                                color: themeColor('text'),
                                fontSize: 20,
                                fontFamily: 'PPNeueMontreal-Book',
                                marginTop: 40
                            }}
                        >
                            {localeString('views.Settings.Networking.tor')}
                        </Text>
                    )}

                    {showTorStatus && (
                        <>
                            <View
                                style={{
                                    flexDirection: 'row',
                                    justifyContent: 'center',
                                    marginTop: 20
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
                                        color: themeColor(
                                            TOR_INDICATOR_COLORS[
                                                TorStore.indicator
                                            ]
                                        ),
                                        fontSize: 17,
                                        fontFamily: 'PPNeueMontreal-Book'
                                    }}
                                >
                                    {TorStore.statusText}
                                </Text>
                            </View>
                            {!!TorStore.actionError && (
                                <Text
                                    style={{
                                        color: themeColor('error'),
                                        fontSize: 14,
                                        fontFamily: 'PPNeueMontreal-Book',
                                        textAlign: 'center',
                                        marginTop: 10
                                    }}
                                >
                                    {TorStore.actionError}
                                </Text>
                            )}
                            <View style={{ marginTop: 20 }}>
                                <Button
                                    title={localeString(
                                        'views.Settings.Networking.Tor.newIdentity'
                                    )}
                                    onPress={() => TorStore.newIdentity()}
                                    disabled={
                                        torState !== 'running' ||
                                        !!TorStore.actionInFlight
                                    }
                                    secondary
                                />
                            </View>
                            <View style={{ marginTop: 15 }}>
                                <Button
                                    title={localeString(
                                        'views.Settings.Networking.Tor.restart'
                                    )}
                                    onPress={() => TorStore.restart()}
                                    disabled={!!TorStore.actionInFlight}
                                    secondary
                                />
                            </View>
                        </>
                    )}

                    {Platform.OS === 'android' && (
                        <>
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
                                            'views.Settings.Networking.Tor.persistentService'
                                        )}
                                    </Text>
                                </View>
                                <View
                                    style={{
                                        alignSelf: 'center',
                                        marginLeft: 5
                                    }}
                                >
                                    <Switch
                                        value={
                                            TorStore.persistentServiceEnabled
                                        }
                                        onValueChange={() =>
                                            TorStore.setPersistentServiceEnabled(
                                                !TorStore.persistentServiceEnabled
                                            )
                                        }
                                    />
                                </View>
                            </View>
                            <Text
                                style={{
                                    color: themeColor('secondaryText'),
                                    fontSize: 14,
                                    fontFamily: 'PPNeueMontreal-Book',
                                    marginTop: 8,
                                    marginBottom: 20
                                }}
                            >
                                {localeString(
                                    'views.Settings.Networking.Tor.persistentService.subtitle'
                                )}
                            </Text>
                        </>
                    )}
                </ScrollView>
            </Screen>
        );
    }
}
