import * as React from 'react';
import { ScrollView, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';

import DropdownSetting from '../../components/DropdownSetting';
import Header from '../../components/Header';
import Screen from '../../components/Screen';
import { ErrorMessage } from '../../components/SuccessErrorMessage';
import LoadingIndicator from '../../components/LoadingIndicator';

import SettingsStore, {
    NOTIFICATIONS_PREF_KEYS
} from '../../stores/SettingsStore';
import LightningAddressStore from '../../stores/LightningAddressStore';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

interface NotificationsProps {
    navigation: StackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
    LightningAddressStore: LightningAddressStore;
}

interface NotificationsState {
    notifications: number;
}

@inject('SettingsStore', 'LightningAddressStore')
@observer
export default class Notifications extends React.Component<
    NotificationsProps,
    NotificationsState
> {
    state = {
        notifications: 1
    };

    async UNSAFE_componentWillMount() {
        const { SettingsStore } = this.props;
        const { settings } = SettingsStore;

        this.setState({
            notifications:
                settings.lightningAddress?.notifications !== undefined
                    ? settings.lightningAddress.notifications
                    : 1
        });
    }

    render() {
        const { navigation, SettingsStore, LightningAddressStore } = this.props;
        const { notifications } = this.state;
        const { updateSettings, settings }: any = SettingsStore;
        const { loading, update, error_msg } = LightningAddressStore;

        return (
            <Screen>
                <View style={{ flex: 1 }}>
                    <Header
                        leftComponent="Back"
                        centerComponent={{
                            text: localeString('general.notifications'),
                            style: {
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book'
                            }
                        }}
                        rightComponent={
                            loading ? (
                                <View>
                                    <LoadingIndicator size={30} />
                                </View>
                            ) : undefined
                        }
                        navigation={navigation}
                    />
                    <ScrollView style={{ paddingHorizontal: 15, marginTop: 5 }}>
                        {error_msg && (
                            <ErrorMessage message={error_msg} dismissable />
                        )}

                        <View>
                            <DropdownSetting
                                title={localeString(
                                    'views.Settings.Notifications.notifications'
                                )}
                                selectedValue={notifications}
                                onValueChange={async (value: number) => {
                                    try {
                                        await update({
                                            notifications: value
                                        }).then(async () => {
                                            this.setState({
                                                notifications: value
                                            });
                                            await updateSettings({
                                                lightningAddress: {
                                                    ...settings.lightningAddress,
                                                    notifications: value
                                                }
                                            });
                                        });
                                    } catch (e) {}
                                }}
                                values={NOTIFICATIONS_PREF_KEYS}
                                disabled={
                                    SettingsStore.settingsUpdateInProgress
                                }
                            />
                        </View>
                    </ScrollView>
                </View>
            </Screen>
        );
    }
}
