import * as React from 'react';
import { ScrollView, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

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
    navigation: NativeStackNavigationProp<any, any>;
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
    constructor(props: NotificationsProps) {
        super(props);

        const { settings } = props.SettingsStore;

        this.state = {
            notifications:
                settings.lightningAddress?.notifications !== undefined
                    ? settings.lightningAddress.notifications
                    : 1
        };
    }

    render() {
        const { navigation, SettingsStore, LightningAddressStore } = this.props;
        const { notifications } = this.state;
        const { updateSettingsGroup } = SettingsStore;
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
                                    'views.Settings.LightningAddressSettings.notifications'
                                )}
                                selectedValue={notifications}
                                onValueChange={async (value: number) => {
                                    const prev = notifications;
                                    this.setState({ notifications: value });
                                    try {
                                        await update({
                                            notifications: value
                                        });
                                        await updateSettingsGroup(
                                            'lightningAddress',
                                            {
                                                notifications: value
                                            }
                                        );
                                        if (value === 1) {
                                            LightningAddressStore.updatePushCredentials().catch(
                                                (e) =>
                                                    console.log(
                                                        'Failed to update push credentials',
                                                        e
                                                    )
                                            );
                                        }
                                    } catch (e) {
                                        this.setState({ notifications: prev });
                                    }
                                }}
                                values={NOTIFICATIONS_PREF_KEYS}
                                disabled={
                                    loading ||
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
